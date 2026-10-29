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

The shell no longer uses `VITE_CATALOG_ENTRY` or `VITE_ORDERS_ENTRY`. Catalog and Orders still use the public build-time variable `VITE_SHELL_URL` for their navigation links, defaulting to `http://localhost:4100/`. To change it locally, copy the remote app's `.env.example` to `.env.local`. The release workflow reads `VITE_SHELL_URL` from repository Actions variables, and Nx includes it in build cache inputs.

## Release an app

Push a readable app version tag to build and publish only that app:

```sh
git tag catalog/v1.2.0
git push origin catalog/v1.2.0
```

Use a new version each time. `catalog/v1.2.0` is an example; choose `orders/v1.0.0` or `shell/v1.1.0` to release those apps. Tag the commit you want to release. Only commits containing this tag-triggered workflow support the new process; older commits may still contain the previous workflow.

`.github/workflows/release.yml` reads the app and version from the tag, checks out that tagged source, installs dependencies with the pinned Node/pnpm versions, and runs `pnpm nx build <app>`. If the build fails, no release is published. Other apps are not built and do not gate this release. A normal branch push or pull request does not start a build: this small demo no longer has a separate CI workflow. Build failures are caught when releasing. You can still run `pnpm build` locally before tagging.

On success, find the named release under GitHub → **Releases** → **Assets**:

- `<app>.tar.gz`: the deployable build, used as-is by manual deployment.
- `release.json`: app, version, tag, source commit, release build run, and archive SHA-256.

There are no CI run IDs to copy, manual release form, artifact searches, or expiring Actions artifacts. Each version is built once for publication; deploying or rolling back uses the published files without rebuilding. This release build is independent of any earlier build you ran locally.

Release immutability is enabled for this repository. The workflow uploads assets to a draft before publishing, then GitHub locks the published assets and tag. Existing versions are never overwritten. If an upload fails and leaves an unpublished draft, remove that draft before rerunning the failed workflow; keep the tag at the same commit. This demo accepts stable `MAJOR.MINOR.PATCH` versions, without prerelease suffixes.

Pushing the tag explicitly requests a release. **It does not deploy anything to Cloudflare.**

## Deploy a release (manual)

| App | Workflow | Example version input | Pages project |
| --- | --- | --- | --- |
| Shell | `.github/workflows/deploy-shell.yml` | `1.0.0` | `microfrontend-lab-shell` |
| Catalog | `.github/workflows/deploy-catalog.yml` | `1.0.0` | `microfrontend-lab-catalog` |
| Orders | `.github/workflows/deploy-orders.yml` | `1.0.0` | `microfrontend-lab-orders` |

Open GitHub → Actions → **Deploy Catalog**, **Deploy Orders**, or **Deploy Shell** → **Run workflow**, choose `main`, and enter a published version. The workflow downloads that app's GitHub Release assets, validates the metadata and archive checksum, and uploads the files to Cloudflare Pages. Shell deployment additionally applies the production remote configuration described above. It never rebuilds or selects the latest version implicitly. To roll back, run the same workflow with an earlier published version. No CI rerun or Git revert is needed.

Each app has its own deployment concurrency group and Pages project. Another app's build or deployment failure does not block it. There is no application checkout, pnpm setup, dependency install, or Vite build during deployment. Deployment installs Node.js only to run the pinned Wrangler CLI.

One-time hosting setup (already configured for this repository):

1. Create the Cloudflare Pages Direct Upload projects listed above, with `main` as their production branch.
2. Add GitHub Actions secrets `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` (Account → Cloudflare Pages → Edit).
3. Set repository Actions variable `VITE_SHELL_URL=https://microfrontend-lab-shell.pages.dev/` before building the hosted remotes. Shell remote URLs are selected in `config/remotes.production.json` at deployment time instead of during the release build.

Existing releases such as `catalog/v1.0.0` and `shell/v1.0.0` remain deployable. Their metadata records the earlier CI artifact; newer releases record their own release build run instead.

There is no backend, authentication, styling, shared application package, or test framework.
