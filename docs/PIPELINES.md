# Independent development and releases

## What runs when?

| Change                                   | Pipelines              |
| ---------------------------------------- | ---------------------- |
| `apps/catalog/**`                        | Catalog only           |
| `apps/orders/**`                         | Orders only            |
| `apps/shell/**`                          | Shell only             |
| `server/**`                              | Backend only           |
| shared packages, lockfile, build tooling | All relevant pipelines |
| documentation                            | None                   |

Each frontend has a short workflow wrapper and calls `_frontend.yml`. This shares CI implementation without forcing a shared release. Concurrency is serialized per application. Pull requests run checks but do not publish.

## Frontend pipeline

```text
change → typecheck + API tests → build selected app
       → load already-published sibling artifacts
       → stage candidate → browser integration tests
       → package + SHA-256 → GitHub release
       → Cloudflare deploy + promote (when configured)
```

The integration environment downloads published siblings from GitHub releases. Before an application's first release exists, it builds a baseline from source just for tests. This bootstrap exception disappears once initial releases are published. Sibling test artifacts are never published by another application's pipeline.

Each release has `release.json`, versioned JS/CSS, source maps, and a SHA-256 checksum alongside its tarball. Identifiers combine commit, run number and attempt, so retries create new immutable artifacts. A release is never overwritten.

## Desktop deployment

`npm run deploy:desktop -- --app=orders` pulls the newest Orders GitHub release, verifies its checksum, stages it, smoke-tests it inside the running shell, changes only Orders in the manifest, and smoke-tests the promoted version. Failure restores the previous pointer.

`npm run release -- --app=orders --version=v2` does the equivalent from your local source, including build and API tests. This is useful for learning before pushing a commit.

The manifest lives at `.deploy/manifest.json`; assets live at `.deploy/releases/<app>/<version>/`. The backend reads the manifest on each request. Existing files are retained for open browser sessions. Manifest writes use a temporary file and atomic rename. Run local release commands serially; the teaching CLI does not implement multi-operator deployment locking.

## Cloud deployment

- `fieldwork-api`: independently released Worker + D1 database.
- `fieldwork-shell`: stable Worker + static shell assets; `/api` proxies via a service binding.
- `fieldwork-catalog-<version>` and `fieldwork-orders-<version>`: immutable static release hosts.
- D1 `deployments`: active remote URLs and previous pointers.
- D1 `release_history`: promotion and rollback history.

Changing Orders publishes its Worker and updates one manifest row. The shell and API are not rebuilt or redeployed. Shell deployments retain older shell assets from published releases. Frontend application data never moves during a release.

## Rollback

Desktop: `npm run rollback -- --app=orders` swaps the manifest to the previous existing release. Cloud: the manual **Roll back cloud remote** GitHub workflow swaps D1 pointers; it does not rebuild code. Refresh the browser to load the restored version.

Shell/API cloud rollbacks use Cloudflare's native Worker rollback. Database migrations are forward-only and additive; rolling back application code does not roll back database contents. Back up data before a schema change. Destructive migrations are outside this demo.

## What is intentionally not automatic?

Desktop deployment is a pull command: a cloud runner cannot reach your laptop's localhost. No self-hosted runner or persistent GitHub-to-desktop credential is installed. Cloud deployment is automatic after the one-time Cloudflare account/secret setup. Old release hosts are not deleted automatically; see the free-tier retention limit in DEPLOYMENT.md.
