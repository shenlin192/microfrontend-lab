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
- **Production:** edit `config/remotes.production.json`, commit, and create a new shell release tag. The release workflow reads that tagged configuration, resolves the selected remote versions, and packages the resulting `remotes.json` with the shell. Preview and promotion use those frozen files without reading the latest configuration.

The production version selection is now just:

```json
{
  "catalog": "1.0.2",
  "orders": "1.0.1"
}
```

Deploy the selected remote releases as previews first. Each remote gets a version alias such as `https://v1-0-2.microfrontend-lab-catalog.pages.dev`. `scripts/resolve-remotes.mjs` runs during the shell release build. It uses the Cloudflare API to find the corresponding successful deployment and puts its fixed hash URL into the shell's runtime configuration. It follows pagination, checks the deployed release metadata, and fails if a selected version has not been deployed. No new lookup service is needed, and Cloudflare credentials stay inside GitHub Actions.

Version aliases can move if the same version is deployed again. The shell release archive stores the fixed hash URLs instead, so its selected remote code stays the same. Keep referenced Cloudflare deployments; deleting one breaks compositions that use it.

A shell version identifies **both its code and its remote selection**. Changing a remote version requires a new shell release tag. This deliberately rebuilds the small shell, while Catalog and Orders keep their independent releases. Preview and promotion never rebuild or resolve the configuration again. To roll back the whole composition, promote an earlier shell release that includes frozen remote configuration.

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

- `<app>.tar.gz`: the deployable build; shell archives also contain their resolved production `remotes.json`.
- `release.json`: app, version, tag, source commit, release build run, and archive SHA-256. For the shell it also records the frozen `remotes`.

Releasing requires no CI run ID, manual release form, or artifact search. Preview and promotion both download the same permanent GitHub Release assets; there are no separate deployment versions, preview bundles, or artifact retention deadlines. Each version is built once for publication; deploying or rolling back uses the published files without rebuilding. This release build is independent of any earlier build you ran locally.

Release immutability is enabled for this repository. A single `gh release create` command uploads the assets and publishes the release. The CLI handles the temporary draft internally so all assets are uploaded before GitHub locks the published assets and tag. Existing versions are never overwritten. If an upload fails and leaves an unpublished draft, remove that draft before rerunning the failed workflow; keep the tag at the same commit. This demo accepts stable `MAJOR.MINOR.PATCH` versions, without prerelease suffixes.

Pushing the tag explicitly requests a release. **It does not deploy anything to Cloudflare.**

## Deploy a preview (manual)

The flow is **Release → Deploy preview → Review → Promote**. There is no permanent staging project. Every preview has its own review URL and leaves the production URL unchanged.

| App | Preview workflow | Example release input | Pages project |
| --- | --- | --- | --- |
| Shell | `Deploy Shell preview` | `1.0.2` | `microfrontend-lab-shell` |
| Catalog | `Deploy Catalog preview` | `1.0.2` | `microfrontend-lab-catalog` |
| Orders | `Deploy Orders preview` | `1.0.1` | `microfrontend-lab-orders` |

1. Run each remote's preview workflow from `main`, supplying an existing published version.
2. Select those remote versions in `config/remotes.production.json`, commit the file, and push a **new shell release tag**. The release build freezes the resolved configuration inside the shell archive.
3. Run **Deploy Shell preview** from `main`, supplying that shell release version.
4. Open the fixed hash URL in the workflow summary to review routing and remote loading.

Each preview workflow verifies and extracts the selected immutable GitHub Release, then uploads its files with a version branch such as `v1-0-2` instead of `main`. The release metadata is served alongside the app as `/release.json`. No source checkout, dependency installation, Vite build, or configuration resolution runs during preview deployment. Deploying the same version again uploads the same files. The optional `shellUrl` prop keeps remote navigation in the current shell.

## Promote to production (manual)

1. Open **Promote to production** in GitHub Actions and choose `main`.
2. Select the app and enter the **release version**, for example `shell` and `1.0.2`.
3. The workflow downloads that immutable release and verifies its archive checksum. It checks that the version's preview URL serves the same release metadata, then uploads the same release files with `--branch=main`.

Promotion updates `https://microfrontend-lab-<app>.pages.dev`. It does not rebuild, read the current version file, or resolve remote aliases. The shell's remote configuration is already part of the archive you reviewed. Concurrent promotions are serialized per app. To roll back, select an earlier frozen release version; there is no run ID to find and no expiring preview bundle.

For example:

```text
Release shell/v1.0.2 → Preview 1.0.2 → Review → Promote 1.0.2
```

For micro frontends, promoting the **shell composition** changes which versions users load. Promoting a remote's standalone production URL is optional: a shell that pins a fixed remote hash URL keeps that selection regardless of the standalone URL.

One-time hosting setup (already configured for this repository):

1. Create the Cloudflare Pages Direct Upload projects listed above, with `main` as their production branch.
2. Add GitHub Actions secrets `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` (Account → Cloudflare Pages → Edit).
3. Set repository Actions variable `VITE_SHELL_URL=https://microfrontend-lab-shell.pages.dev/` before building the hosted remotes. Shell remote versions are selected in `config/remotes.production.json` and frozen during the shell release build.

Existing remote releases remain usable. **Shell releases `1.0.0` and `1.0.1` predate frozen production configuration and are rejected by the new version-only workflows. Use shell `1.0.2` or a newer release created with this process.** Existing production deployments remain available in Cloudflare history.

There is no backend, authentication, styling, shared application package, or test framework.
