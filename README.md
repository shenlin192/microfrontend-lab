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
- **Production:** edit `config/remotes.production.json`, commit and push, then manually run **Deploy Shell preview** with the existing shell release version. The preview workflow reads the version selections from its own Git commit, resolves them to fixed remote deployment URLs, and generates `remotes.json`. The released JavaScript is reused without rebuilding. This creates a preview; production changes only when you explicitly promote it.

The production version selection is now just:

```json
{
  "catalog": "1.0.2",
  "orders": "1.0.1"
}
```

Deploy the selected remote releases as previews first. Each remote gets a version alias such as `https://v1-0-2.microfrontend-lab-catalog.pages.dev`. `scripts/resolve-remotes.mjs` uses the Cloudflare API to find the corresponding successful deployment and puts its fixed hash URL into the shell's runtime configuration. It follows pagination, checks the deployed release metadata, and fails if a selected version has not been deployed. No new lookup service is needed, and Cloudflare credentials stay inside GitHub Actions.

Version aliases can move if the same version is deployed again. The shell preview stores the fixed hash URLs instead, so its selected remote code stays the same. Keep referenced Cloudflare deployments; deleting one breaks compositions that use it.

To upgrade or roll back a remote, change only its version in this file, then deploy another shell preview using the same shell release. Review the preview and promote it. Promotion reuses the saved files and resolved configuration; it does not read the latest version selection or resolve aliases again.

`apps/shell/public/_headers` disables caching for `/remotes.json` on Cloudflare Pages. The configuration is public; never put secrets in it. The Vite federation config reads the same local JSON only during development to connect React Fast Refresh. Production builds have no configured remote URLs; the browser registers them from the served file. Restart `pnpm dev` if you change a local remote address, so its HMR connection follows the new address.

The shell no longer uses `VITE_CATALOG_ENTRY` or `VITE_ORDERS_ENTRY`. When rendering a remote, the shell passes its current URL as the optional `shellUrl` prop, so cross-navigation stays inside the preview or production shell. Standalone remotes fall back to the public build-time variable `VITE_SHELL_URL`, defaulting to `http://localhost:4100/`. To change it locally, copy the remote app's `.env.example` to `.env.local`. The release workflow reads `VITE_SHELL_URL` from repository Actions variables, and Nx includes it in build cache inputs.

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

Releasing requires no CI run ID, manual release form, or artifact search. Release assets stay in GitHub Releases; the separate preview bundles used for promotion are described below. Each version is built once for publication; deploying or rolling back uses the published files without rebuilding. This release build is independent of any earlier build you ran locally.

Release immutability is enabled for this repository. A single `gh release create` command uploads the assets and publishes the release. The CLI handles the temporary draft internally so all assets are uploaded before GitHub locks the published assets and tag. Existing versions are never overwritten. If an upload fails and leaves an unpublished draft, remove that draft before rerunning the failed workflow; keep the tag at the same commit. This demo accepts stable `MAJOR.MINOR.PATCH` versions, without prerelease suffixes.

Pushing the tag explicitly requests a release. **It does not deploy anything to Cloudflare.**

## Deploy a preview (manual)

The flow is **Release → Deploy preview → Review → Promote**. There is no permanent staging project. Every preview has its own review URL and leaves the production URL unchanged.

| App | Preview workflow | Example release input | Pages project |
| --- | --- | --- | --- |
| Shell | `Deploy Shell preview` | `1.0.1` | `microfrontend-lab-shell` |
| Catalog | `Deploy Catalog preview` | `1.0.2` | `microfrontend-lab-catalog` |
| Orders | `Deploy Orders preview` | `1.0.1` | `microfrontend-lab-orders` |

1. Run each remote's preview workflow from `main`, supplying an existing published version.
2. Select those remote versions in `config/remotes.production.json` and commit/push the file.
3. Run **Deploy Shell preview** from `main`, supplying the shell release version. It resolves the remote versions and assembles the composition without rebuilding.
4. Open the fixed hash URL in the workflow summary to review routing and remote loading. Use this review URL rather than a version alias, which a later preview might update.

Each preview workflow verifies and extracts the selected immutable GitHub Release, then uploads it with a version branch such as `v1-0-2` instead of `main`. Only that app is deployed. The shell workflow also checks out the version file and resolver; no application dependencies are installed and no Vite build runs. The optional `shellUrl` prop keeps remote navigation in the current shell; earlier releases without this support may navigate to the stable production shell instead.

After uploading successfully, the workflow saves an Actions artifact named `<app>-preview-<run ID>-<attempt>`, containing:

- `deployment.tar.gz`: the exact static files uploaded, including the shell's resolved `remotes.json`.
- `deployment.json`: app/version, source/configuration commits, preview URL, preview run ID, and bundle checksum.

These immutable preview artifacts are retained for **90 days**, subject to repository retention settings. They preserve the exact composition you reviewed. This storage serves promotion, independently of the permanent GitHub Release assets. If a preview bundle expires, deploy and review a new preview before promoting it.

## Promote to production (manual)

1. Open **Promote to production** in GitHub Actions and choose `main`.
2. Select the app and enter the successful preview run ID shown in its summary (also the number in its `/actions/runs/<ID>` URL).
3. The workflow verifies the run belongs to that app's preview workflow, downloads its frozen bundle, checks its checksum, and uploads those same files with `--branch=main`.

Promotion updates `https://microfrontend-lab-<app>.pages.dev`. It does not rebuild, read the current version file, or resolve remote aliases. Source commit, configuration commit, and preview URL are recorded in its summary. Concurrent promotions are serialized per app. To roll back, promote an earlier reviewed preview run whose bundle is still retained. No Git revert is needed.

For micro frontends, promoting the **shell composition** changes which versions users load. Promoting a remote's standalone production URL is optional: a shell that pins a fixed remote hash URL keeps that selection regardless of the standalone URL.

One-time hosting setup (already configured for this repository):

1. Create the Cloudflare Pages Direct Upload projects listed above, with `main` as their production branch.
2. Add GitHub Actions secrets `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` (Account → Cloudflare Pages → Edit).
3. Set repository Actions variable `VITE_SHELL_URL=https://microfrontend-lab-shell.pages.dev/` before building the hosted remotes. Shell remote versions are selected in `config/remotes.production.json` and resolved during preview deployment instead of during the release build.

Existing releases such as `catalog/v1.0.0` and `shell/v1.0.0` remain deployable. Their metadata records the earlier CI artifact; newer releases record their own release build run instead.

There is no backend, authentication, styling, shared application package, or test framework.
