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
2. `apps/shell/public/remotes.json`: selects the remote URLs for local development. `src/main.jsx` fetches this file and registers the remotes before rendering.
3. `apps/shell/src/App.jsx`: `lazy(() => loadRemote('catalog/App'))` loads that component over the network. `Suspense` handles loading. Hash links choose which component to show.
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

## Select remote versions at runtime

The shell fetches `/remotes.json` with `cache: 'no-store'` at startup, then calls Module Federation's `registerRemotes`. The URL determines the code that loads; `version` is a readable label. Refresh the page after changing the file. Already-open tabs keep their loaded code until refreshed. No configuration is fetched from GitHub in the browser.

- **Local:** edit `apps/shell/public/remotes.json`. Vite serves this file directly. Its defaults use Catalog on port 4101 and Orders on port 4102.
- **Production:** edit `config/remotes.production.json`, commit and push, then manually run **Deploy Shell** with the existing shell release version. The workflow reads the configuration from its own Git commit and copies it to the deployment as `remotes.json`. Only this configuration is replaced; the released JavaScript is reused without rebuilding.

For example (these domains are placeholders):

```json
{
  "catalog": {
    "version": "1.2.0",
    "entry": "https://<catalog-release-deployment>/remoteEntry.js"
  },
  "orders": {
    "version": "1.0.3",
    "entry": "https://<orders-release-deployment>/remoteEntry.js"
  }
}
```

Use the unique deployment URL printed by each remote's Cloudflare deployment, such as `https://<deployment-hash>.microfrontend-lab-catalog.pages.dev/remoteEntry.js`. Keep those deployments: deleting one breaks any shell configuration that selects it. A changing project URL such as `microfrontend-lab-catalog.pages.dev` follows future deployments and therefore does not pin a version. The checked-in production file selects Catalog release `1.0.0` and an existing Orders build identified by commit `bfb2d45` (Orders does not yet have a readable release).

To upgrade or roll back one remote, change only its `version` and `entry`, then redeploy the same shell release. The workflow summary records the shell code's commit, configuration commit, and selected remote configuration. This copies the static files to Pages again, but runs no Vite build. Updating a remote's production URL alone does not change the selected fixed deployment URL.

`apps/shell/public/_headers` disables caching for `/remotes.json` on Cloudflare Pages. The configuration is public; never put secrets in it. The Vite federation config reads the same local JSON only during development to connect React Fast Refresh. Production builds have no configured remote URLs; the browser registers them from the served file. Restart `pnpm dev` if you change a local remote address, so its HMR connection follows the new address.

The shell no longer uses `VITE_CATALOG_ENTRY` or `VITE_ORDERS_ENTRY`. Catalog and Orders still use the public build-time variable `VITE_SHELL_URL` for their navigation links, defaulting to `http://localhost:4100/`. To change it locally, copy the remote app's `.env.example` to `.env.local`. CI reads `VITE_SHELL_URL` from repository Actions variables, and Nx includes it in build cache inputs.

## Continuous integration

`.github/workflows/ci.yml` runs on pull requests and pushes to `main`. A matrix creates three independent jobs: `Build shell`, `Build catalog`, and `Build orders`. Each has its own runner, installs dependencies with `pnpm install --frozen-lockfile`, and runs `pnpm nx build <app>` for only that app. The jobs use Node 24.15.0 and the pnpm version pinned in `package.json`. `fail-fast: false` ensures one app's failure does not cancel the others. There are no build-job dependencies between apps.

Each successful app job from a push to `main` uploads its own `dist` directory as `<app>-<commit SHA>-<run attempt>`, retained for 30 days. An Orders failure does not prevent Catalog's artifact from being uploaded. Pull requests do not produce deployable artifacts. The attempt suffix keeps reruns separate without overwriting earlier artifacts. These checks verify compilation; they do not test remote loading in a browser.

## Release an app (manual)

CI never releases or deploys automatically. Each app has its own readable version, such as `catalog/v1.0.0`, `orders/v1.0.0`, or `shell/v1.0.0`. Versions do not need to advance together.

1. Open a CI run from a push to `main`. Copy its run ID and source commit SHA. Only the selected app's build job needs to have succeeded; another app may have failed or still be running.
2. Push a new lightweight version tag at that source commit (replace `<CI_COMMIT_SHA>` with the actual SHA):

   ```sh
   git tag catalog/v1.0.0 <CI_COMMIT_SHA>
   git push origin catalog/v1.0.0
   ```

3. Open GitHub → Actions → **Release app** → **Run workflow**, choose `main`, the app, version `1.0.0` (without `v`), and the CI run ID.
4. Find the resulting GitHub Release, for example `catalog/v1.0.0`.

Pushing a version tag does not build, release, or deploy automatically. Creating the tag explicitly also avoids granting an extra personal token to Actions just to tag an older commit.

The workflow verifies the CI source, the selected app's successful job, and that the version tag points to exactly that CI commit. It downloads the exact artifact and archives its files without rebuilding. The release workflow itself runs from `main`, so it can publish builds of older commits. Release assets are `<app>.tar.gz` and `release.json` (app, version, commit, CI run, artifact name, and archive SHA-256).

Enable **Settings → General → Releases → Enable release immutability** before publishing releases. GitHub then locks the published assets and tag. The workflow uploads assets to a draft before publishing. It rejects an existing release, and deployment accepts only published immutable releases. If an upload fails and leaves a draft, remove that unpublished draft before retrying; keep the tag at the same source commit. This demo accepts stable `MAJOR.MINOR.PATCH` versions; no prerelease suffixes yet.

CI artifacts expire after 30 days, so create a release while the artifact is available. Published release assets survive that CI artifact expiration. Creating a release does not contact Cloudflare or change the running app.

## Deploy a release (manual)

| App | Workflow | Example version input | Pages project |
| --- | --- | --- | --- |
| Shell | `.github/workflows/deploy-shell.yml` | `1.0.0` | `microfrontend-lab-shell` |
| Catalog | `.github/workflows/deploy-catalog.yml` | `1.0.0` | `microfrontend-lab-catalog` |
| Orders | `.github/workflows/deploy-orders.yml` | `1.0.0` | `microfrontend-lab-orders` |

Open GitHub → Actions → **Deploy Catalog**, **Deploy Orders**, or **Deploy Shell** → **Run workflow**, choose `main`, and enter a published version. The workflow downloads that app's GitHub Release assets, validates the metadata and archive checksum, and uploads the files to Cloudflare Pages. Shell deployment additionally applies the production remote configuration described above. It never rebuilds or selects the latest version implicitly. To roll back, run the same workflow with an earlier published version. No CI rerun or Git revert is needed.

Each app has its own deployment concurrency group and Pages project. Another app's build or deployment failure does not block it. There is no application checkout, pnpm setup, dependency install, or Vite build during release or deployment. Deployment installs Node.js only to run the pinned Wrangler CLI.

One-time hosting setup (already configured for this repository):

1. Create the Cloudflare Pages Direct Upload projects listed above, with `main` as their production branch.
2. Add GitHub Actions secrets `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` (Account → Cloudflare Pages → Edit).
3. Set repository Actions variable `VITE_SHELL_URL=https://microfrontend-lab-shell.pages.dev/` before building the hosted remotes. Shell remote URLs are selected in `config/remotes.production.json` at deployment time instead of in CI.

Release and deployment remain manual. The alternative tag-triggered build/release design discussed in the chat has not been applied; the workflow above still promotes existing CI artifacts.

There is no backend, authentication, styling, shared application package, or test framework.
