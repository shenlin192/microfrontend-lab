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

## How versions are selected

Each app has its own GitHub Release, such as `shell/v1.0.3`, `catalog/v1.0.2`, or `orders/v1.0.1`.

For a shell deployment, choose three release versions in GitHub Actions:

```text
Shell:   1.0.3
Catalog: 1.0.2
Orders:  1.0.1
```

The workflow downloads the shell archive, finds the already deployed Catalog and Orders versions, generates `remotes.json`, and uploads the shell. It does not rebuild or redeploy the remotes. Changing the remote selection does not require a new shell release.

The browser fetches `/remotes.json` at startup and registers those URLs with Module Federation. `version` is a readable label; `entry` selects the actual code. The file is public and contains no credentials. Refresh the page to load a new selection.

- Locally, edit `apps/shell/public/remotes.json`. Its defaults use ports 4101 and 4102. Restart `pnpm dev` if an address changes so React Fast Refresh reconnects.
- In hosted deployments, the workflow generates the file from its three version inputs. There is no `config/remotes.production.json` and shell releases do not freeze remote selections.

`scripts/resolve-remotes.mjs` looks up remote version aliases such as `v1-0-2.microfrontend-lab-catalog.pages.dev` through the Cloudflare API, then stores their fixed hash URLs. Keep referenced deployments: deleting one would break shells that select it. Credentials stay in Actions; the browser only receives the resolved URLs.

Remote navigation chooses its shell URL in this order:

1. The `shellUrl` prop supplied by the containing shell: keeps navigation inside that preview or production shell.
2. `VITE_SHELL_STANDALONE_FALLBACK_URL`: the configured address for a remote opened standalone.
3. `http://localhost:4100/`: the last-resort default so local development works without configuration.

The environment value is public and set at build time. The release workflow passes the GitHub repository variable directly; the localhost default lives only in the remote code. For local overrides, copy the remote app's `.env.example` to `.env.local`.

## 1. Release an app

Push a new app version tag:

```sh
git tag catalog/v1.2.0
git push origin catalog/v1.2.0
```

`release.yml` builds only the tagged app, then publishes these GitHub Release assets:

- `<app>.tar.gz`: the compiled app.
- `release.json`: app, version, source commit, and archive checksum.

A failed build does not publish a release. There is no separate CI workflow; ordinary branch pushes and pull requests do not build automatically. Use `pnpm build` locally whenever needed. Version tags must use stable `MAJOR.MINOR.PATCH` numbers. Tag commits containing the current release workflow.

Release immutability is enabled for this repository. The GitHub CLI handles uploading and publishing, and existing releases are never overwritten. If an upload fails and leaves an unpublished draft, remove the draft before rerunning the workflow; keep its tag at the same commit. Creating a release does not deploy it.

## 2. Deploy the remote versions

Run **Deploy Catalog preview** or **Deploy Orders preview** from `main` and enter that app's published version. The workflow downloads the archive and deploys it under its version alias. Each remote stays independently released and deployed.

Only deploy a remote again when needed; a shell deployment can reuse any compatible remote version that is already available. Earlier remote releases without the `shellUrl` prop may navigate back to the stable shell instead of staying inside a preview.

## 3. Preview a composition

Run **Deploy Shell preview** from `main` with the Shell, Catalog, and Orders versions you want to review.

Open the deployment URL in its summary and check navigation and remote loading. Production stays unchanged. Each run gets its own fixed review URL; the `preview` alias follows the latest shell preview.

## 4. Deploy Production

Run **Deploy Production** from `main` and enter the three desired versions. It deploys the selected composition to [the production shell](https://microfrontend-lab-shell.pages.dev/).

Preview and Production call the same `deploy-composition.yml` workflow; the target branch is `preview` or `main`. There is no rebuild, promotion record, separate deployment version, or preview artifact to manage. The workflow checks archive checksums and relies on normal GitHub/Cloudflare errors for missing releases or credentials. Summaries show only versions and URLs.

Production can assemble any selected combination. Reviewing the same three versions first is a manual practice, not an enforced promotion gate. To roll back, run Deploy Production with the previous three versions. Keep a record of those values in the workflow summaries.

Existing runtime-configurable shell releases remain usable. If an older archive contains frozen remote configuration, deployment replaces it with the versions you select now. The archive and GitHub Release stay unchanged.

## One-time hosting setup

Already configured for this repository:

1. Three Cloudflare Pages Direct Upload projects: `microfrontend-lab-shell`, `microfrontend-lab-catalog`, and `microfrontend-lab-orders`, with `main` as the production branch.
2. GitHub Actions secrets `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` (Account → Cloudflare Pages → Edit).
3. Repository Actions variable `VITE_SHELL_STANDALONE_FALLBACK_URL=https://microfrontend-lab-shell.pages.dev/` for standalone remote links.

There is no backend, authentication, styling, shared application package, or test framework.
