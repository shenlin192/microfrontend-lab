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

These are public, build-time values. Changing them requires rebuilding the affected apps. Nx includes the URL variables in its build cache inputs so changing an address does not reuse a build with the old address. CI still builds with the localhost defaults until we configure a deployment destination.

## Continuous integration

`.github/workflows/ci.yml` runs on pull requests and pushes to `main`. It uses Node 24.15.0 and the pnpm version pinned in `package.json`, installs dependencies with `pnpm install --frozen-lockfile`, then runs `pnpm build` through Nx for all three apps. The `Build all apps` check verifies compilation; it does not yet test remote loading in a browser.

## Deploy Catalog

Catalog has its own manual release workflow: `.github/workflows/deploy-catalog.yml`. It builds only Catalog, uploads `apps/catalog/dist` to Cloudflare Pages, and records the commit and deployment URL in the workflow summary.

One-time setup:

1. Create a Cloudflare Pages **Direct Upload** project named `microfrontend-lab-catalog`, with `main` as its production branch.
2. Create a Cloudflare API token with **Account → Cloudflare Pages → Edit**, scoped to that account.
3. In GitHub → Settings → Secrets and variables → Actions, add repository secrets `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN`.
4. Once the shell is hosted, add a repository variable `VITE_SHELL_URL` with its HTTPS address. Until then, Catalog's navigation link returns to the local shell.

To release, open GitHub → Actions → **Deploy Catalog** → **Run workflow**, choosing `main`. The workflow only deploys from `main`. It is separate from CI and does not run automatically on pushes. The resulting `remoteEntry.js` URL can be used as the shell's `VITE_CATALOG_ENTRY`.

There is no backend, authentication, styling, shared application package, or test framework.
