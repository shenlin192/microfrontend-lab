# Minimal React Module Federation

Three almost-empty React pages. Vite provides the dev servers, Module Federation loads the remote components, pnpm manages dependencies, and Nx runs the apps together.

[Open the hosted demo](https://microfrontend-lab-shell.pages.dev/). The shell loads Catalog and Orders from their own Cloudflare Pages projects.

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

## Release an app (manual)

CI never releases or deploys automatically. Each app has its own readable version, such as `catalog/v1.0.0`, `orders/v1.0.0`, or `shell/v1.0.0`. Versions do not need to advance together.

1. Open a CI run from a push to `main`. Copy its run ID. Only the selected app's build job needs to have succeeded; another app may have failed or still be running.
2. Open GitHub → Actions → **Release app** → **Run workflow**, choose `main`, the app, a new version such as `1.0.0` (without `v`), and the CI run ID.
3. Find the resulting GitHub Release, for example `catalog/v1.0.0`.

The workflow verifies the CI source and the selected app's successful job, downloads its exact artifact, and archives its files without rebuilding. The tag points to the original CI commit, even if the release workflow runs from a newer commit. Release assets are `<app>.tar.gz` and `release.json` (app, version, commit, CI run, artifact name, and archive SHA-256).

Enable **Settings → General → Releases → Enable release immutability** before publishing releases. GitHub then locks the published assets and tag. The workflow uploads assets to a draft before publishing. It rejects an existing version, and deployment accepts only published immutable releases. If an upload fails and leaves a draft, remove that unpublished draft and its tag before retrying. This demo accepts stable `MAJOR.MINOR.PATCH` versions; no prerelease suffixes yet.

CI artifacts expire after 30 days, so create a release while the artifact is available. Published release assets survive that CI artifact expiration. Creating a release does not contact Cloudflare or change the running app.

## Deploy a release (manual)

| App | Workflow | Example version input | Pages project |
| --- | --- | --- | --- |
| Shell | `.github/workflows/deploy-shell.yml` | `1.0.0` | `microfrontend-lab-shell` |
| Catalog | `.github/workflows/deploy-catalog.yml` | `1.0.0` | `microfrontend-lab-catalog` |
| Orders | `.github/workflows/deploy-orders.yml` | `1.0.0` | `microfrontend-lab-orders` |

Open GitHub → Actions → **Deploy Catalog**, **Deploy Orders**, or **Deploy Shell** → **Run workflow**, choose `main`, and enter a published version. The workflow downloads that app's GitHub Release assets, validates the metadata and archive checksum, and uploads the preserved files to Cloudflare Pages. It never rebuilds or selects the latest version implicitly. To roll back, run the same workflow with an earlier published version. No CI rerun or Git revert is needed.

Each app has its own deployment concurrency group and Pages project. Another app's build or deployment failure does not block it. There is no application checkout, pnpm setup, dependency install, or Vite build during release or deployment. Deployment installs Node.js only to run the pinned Wrangler CLI.

One-time hosting setup (already configured for this repository):

1. Create the Cloudflare Pages Direct Upload projects listed above, with `main` as their production branch.
2. Add GitHub Actions secrets `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` (Account → Cloudflare Pages → Edit).
3. Set repository Actions variables `VITE_CATALOG_ENTRY=https://microfrontend-lab-catalog.pages.dev/remoteEntry.js`, `VITE_ORDERS_ENTRY=https://microfrontend-lab-orders.pages.dev/remoteEntry.js`, and `VITE_SHELL_URL=https://microfrontend-lab-shell.pages.dev/` before building the hosted apps.

For now, remote addresses are still build-time values and the production Pages URLs change on deployment. **Readable releases are implemented; choosing fixed remote versions from shell runtime configuration is the next step.** Publishing `catalog/v1.1.0` alone does not change the shell, but deploying it to Catalog's current production URL does affect shells using that URL.

There is no backend, authentication, styling, shared application package, or test framework.
