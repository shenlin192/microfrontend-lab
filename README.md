# Fieldwork — a concrete microfrontend lab

A deliberately small React + TypeScript + Vite app: create an account, browse **three products**, place an order, view your own orders. No payment processing. No mock API, fake authentication, localStorage database, or simulated deployment.

- **Shell** owns navigation, session display, remote loading, error boundaries, and a learning panel.
- **Catalog remote** owns products and its local category filter.
- **Orders remote** owns the list and `/orders/:id` detail routes.
- **API** owns authentication, authorization, prices, and persistent order records.

The same API runs on Node 24 + SQLite on your desktop, or Cloudflare Workers + D1 in the cloud. Desktop and cloud databases are separate; data is not synchronized.

## Run it

Requirements: Node **24+**, npm. GitHub CLI is needed only for downloading releases; a Cloudflare account is needed only for cloud deployment.

```sh
npm ci
npm run setup
npm start
```

Open **http://localhost:4100**. Create your own account; there are no default passwords. Products are seeded database records. Registering does not send email.

## Learn by doing

1. **Routing:** open Catalog, then Orders. After ordering, open an order and refresh its detail URL. The shell selects the remote; Orders interprets its own subroute.
2. **Authentication:** create an account and refresh. Inspect the `mfl_session` cookie: HttpOnly, SameSite=Lax, Secure on HTTPS. Sign out, then try `/api/orders`: the API returns 401. Another account cannot read your order.
3. **State:** filter Catalog to Paper, navigate away, then return. The filter resets because it belongs to that component. Orders remain in the database across server restarts.
4. **Communication:** place an order. The live log shows `order:created` v1 from Catalog; the shell fetches the new count. Remotes never share a mutable store.
5. **Styling:** Catalog and Orders have different scoped CSS. Both import Button from `@lab/ui` and inherit shell design tokens. Inspect generated class names.
6. **Shared code:** read `packages/platform` for the TypeScript contract and `packages/ui` for build-time components. `loader.ts` supplies the shell's React singleton to remote containers.
7. **Failures:** select Failures in the learning panel and load a missing Orders release. This requests a real nonexistent JS file and gets a 404. The error boundary catches the failed lazy import. Catalog and navigation still work. Restore the release to recover.

## Develop only one app

Stop `npm start` first, because the development command starts the API server itself:

```sh
npm run dev -- --app=orders
# http://localhost:4100/orders?dev=orders
```

Only Orders runs a Vite dev server on port 4202. The shell and Catalog are existing built releases. For Catalog use `--app=catalog` (4201). For the shell use `--app=shell` (4200). The query override accepts only fixed local ports on localhost. Refresh the shell if a federated update does not hot-refresh; ordinary Fast Refresh and federation-boundary refresh are different mechanisms.

## Release only Orders locally

Keep `npm start` running in another terminal. Install the test browser once:

```sh
npx playwright install chromium
npm run release -- --app=orders --version=v2
npm run rollback -- --app=orders
```

The release command type-checks, tests the real API, builds **only Orders**, stages its files, browser-tests the candidate, promotes the manifest, and verifies the active result. A failed post-promotion smoke test restores the old pointer. Version identifiers cannot be reused. The badge shows the new version after refresh; the underlying feature is intentionally identical unless you edit the source.

The browser keeps already-loaded JS until refresh. This demo does not promise safe in-place replacement of arbitrary running React applications.

## Read the code

```text
apps/shell/src/App.tsx       routing, auth UI, learning panel, error boundary
apps/shell/src/loader.ts    runtime federation + shared React
apps/catalog/src/App.tsx   local filter, order command, domain event
apps/orders/src/App.tsx    nested route, account-owned order queries
packages/platform/src     public types, API helper, event bus
packages/ui/src           shared components + scoped styles
server/api.mjs            same real API on Node and Cloudflare
server/sqlite.mjs         small SQLite adapter for the D1 query interface
server/migrations         versioned SQL schema
scripts                   build, stage, promote, rollback, cloud deployment
.github/workflows         separate application and backend pipelines
```

Read [ARCHITECTURE](docs/ARCHITECTURE.md) for the runtime flow, [PIPELINES](docs/PIPELINES.md) for the separation, and [DEPLOYMENT](docs/DEPLOYMENT.md) for desktop/cloud release instructions.

## Verification

```sh
npm run typecheck
npm test
npm run setup
npx playwright install chromium
npm run test:e2e
```

API tests use actual temporary SQLite files, including reopen/persistence, account ownership, CSRF rejection, server-controlled prices, idempotency, and session revocation. Browser tests use the real local API and database on port 4110. No network responses are mocked. GitHub Actions runs these tests on Linux.

## Intentional boundaries

This is a learning application, not a commerce service: no payment, email verification, password reset, inventory, or account administration. Passwords use salted PBKDF2-SHA256 (100,000 iterations, compatible with Workers Web Crypto); session tokens are random, stored hashed, and expire after 24 hours. Production authentication would require additional hardening and account recovery. Business data never goes in browser storage.

Micro frontends share a JavaScript realm: error boundaries isolate render/load failures, not malicious code, infinite loops, or global CSS. All loaded remote code must be trusted. Framework sharing requires compatible versions; singleton does not make incompatible React versions safe.
