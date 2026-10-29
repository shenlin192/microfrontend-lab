# Minimal React Module Federation

Three almost-empty React pages. Vite provides the dev servers, Module Federation loads the remote components, pnpm manages dependencies, and Nx runs the apps together.

## Run locally

Use Node 24+ and pnpm 11.

```sh
pnpm install
pnpm dev
```

Open **http://localhost:4100** and click Catalog or Orders.

| App | Address | Role |
| --- | --- | --- |
| Shell | http://localhost:4100 | Loads the remote components |
| Catalog | http://localhost:4101 | Exposes `catalog/App` |
| Orders | http://localhost:4102 | Exposes `orders/App` |

The remotes also work on their own URLs. Their links return to the shell.

## Read these files

1. `apps/catalog/vite.config.js`: `exposes` makes `./src/App.jsx` available as `./App`.
2. `apps/shell/vite.config.js`: `remotes` tells the shell where each `remoteEntry.js` lives.
3. `apps/shell/src/App.jsx`: `lazy(() => import('catalog/App'))` loads that component over the network. `Suspense` handles loading. Hash links choose which component to show.
4. All three Vite configs: `shared` requests one React/ReactDOM instance at runtime.
5. `nx.json` and the package scripts: Nx orchestrates ordinary Vite commands. Nx itself does not perform federation.

Open DevTools → Network, then click Catalog: its code comes from **port 4101**. Orders comes from **port 4102**. There is no source import between the apps.

## Useful commands

```sh
pnpm nx dev shell    # Start only the host
pnpm nx dev catalog  # Start only Catalog (another terminal)
pnpm nx dev orders   # Start only Orders (another terminal)
pnpm build           # Check all three independent production builds
```

`pnpm dev` runs the three commands together. Keep both remotes running when navigating through the host. `dev.remoteHmr: true` enables React Fast Refresh across the federation boundary. `server.watch.usePolling: true` makes Vite detect edits reliably in this local environment, where native file notifications were missed (polling uses more CPU). Restart `pnpm dev` after changing the Vite configs.

## Configure deployment URLs

Local development works without any environment variables. To use different addresses, set these variables when building:

| Variable | Used by | Default |
| --- | --- | --- |
| `VITE_CATALOG_ENTRY` | Shell | `http://localhost:4101/remoteEntry.js` |
| `VITE_ORDERS_ENTRY` | Shell | `http://localhost:4102/remoteEntry.js` |
| `VITE_SHELL_URL` | Catalog and Orders navigation | `http://localhost:4100/` |

For example (replace the example domains with your hosting URLs):

```sh
VITE_CATALOG_ENTRY=https://catalog.example.com/remoteEntry.js \
VITE_ORDERS_ENTRY=https://orders.example.com/remoteEntry.js \
VITE_SHELL_URL=https://shell.example.com/ \
pnpm build
```

Alternatively, copy each app's `.env.example` to `.env.local` in the same directory and edit its values. Those files are ignored by Git and affect both development and builds; remove them to return to the localhost defaults. Restart the dev servers after changing them.

These are public, build-time values. Changing them requires rebuilding the affected apps. Nx includes the URL variables in its build cache inputs so changing an address does not reuse a build with the old address. CI reads these three values from GitHub repository Actions variables, using the localhost defaults when they are unset.

## Continuous integration

`.github/workflows/ci.yml` runs on pull requests and pushes to `main`. A matrix creates three independent jobs: `Build shell`, `Build catalog`, and `Build orders`. Each has its own runner, installs dependencies with `pnpm install --frozen-lockfile`, and runs `pnpm nx build <app>` for only that app. The jobs use Node 24.15.0 and the pnpm version pinned in `package.json`. `fail-fast: false` ensures one app's failure does not cancel the others. There are no build-job dependencies between apps.

Each successful app job from a push to `main` uploads its own `dist` directory as `<app>-<commit SHA>-<run attempt>`, retained for 30 days. An Orders failure does not prevent Catalog's artifact from being uploaded. Pull requests do not produce deployable artifacts. The attempt suffix keeps reruns separate without overwriting earlier artifacts. These checks verify compilation; they do not test remote loading in a browser.

## Deploy Catalog and Orders

Each remote has its own manual release workflow, deployment concurrency group, Pages project, and CI artifact. Each deployment checks only its own app's build job; another app's failure does not block it.

| App | Workflow | Required CI job | Pages project |
| --- | --- | --- | --- |
| Catalog | `.github/workflows/deploy-catalog.yml` | `Build catalog` | `microfrontend-lab-catalog` |
| Orders | `.github/workflows/deploy-orders.yml` | `Build orders` | `microfrontend-lab-orders` |

The workflows download the selected app's artifact and upload those files to Cloudflare Pages. There is no source checkout, pnpm setup, application dependency install, or Vite build in deployment. Node.js is installed only to run the pinned Wrangler deployment CLI. Shell has an independent build artifact; its hosting and deployment workflow have not yet been configured.

One-time setup:

1. Create the Cloudflare Pages **Direct Upload** projects listed above, with `main` as their production branch.
2. Create a Cloudflare API token with **Account → Cloudflare Pages → Edit**, scoped to that account.
3. In GitHub → Settings → Secrets and variables → Actions, add repository secrets `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN`.
4. Once the shell is hosted, add a repository variable `VITE_SHELL_URL` with its HTTPS address. Until then, the remotes' navigation links return to the local shell.

To release:

1. Open a **CI** run from a push to `main` with a completed, successful build job for the app you want to release, and find that app's artifact. Copy the run ID (the number after `/actions/runs/` in the URL). The overall run can be failed or still in progress because of another app.
2. Open GitHub → Actions → **Deploy Catalog** or **Deploy Orders** → **Run workflow**, choose `main`, and enter that CI run ID.

The workflow verifies the selected run belongs to this repository's CI workflow and was triggered by a push to `main`. It then checks only the selected app's build job for that commit and selects its artifact using that job's run attempt (including when only failed jobs were rerun). It records the source commit, CI run, artifact name, and deployment URL in its summary. Missing or expired artifacts fail the deployment; it never silently rebuilds or selects the latest build. To roll back, select an older run with a successful job for that app whose artifact is still retained. Older runs with the previous `Build all apps` job are not accepted by this selector.

URL settings are baked into the CI artifact: changing `VITE_SHELL_URL` afterward does not change an existing artifact. A new CI build is needed to use the new value. Deployment is manual and only runs from `main`. The Catalog and Orders `remoteEntry.js` URLs become the shell's `VITE_CATALOG_ENTRY` and `VITE_ORDERS_ENTRY`, respectively.

There is no backend, authentication, styling, shared application package, or test framework.
