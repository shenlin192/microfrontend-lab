# Desktop and free-tier cloud deployment

## Desktop

```sh
npm ci
npm run setup
npx playwright install chromium
npm start
```

The database is `.data/lab.sqlite`. Keep `.data` when upgrading or restarting. In a second terminal:

```sh
# Download and activate a tested GitHub release; no rebuilding.
gh auth login
npm run deploy:desktop -- --app=orders
# Or select an exact release tag from GitHub Releases:
npm run deploy:desktop -- --app=orders --tag=orders-RELEASE_ID
npm run rollback -- --app=orders
```

App release commands require the running server. Backend updates are separate: stop the server, back up `.data` (including WAL files, or use SQLite's backup facility), update the checkout to the tested backend release commit, run `npm ci`, and restart. Existing versioned frontend artifacts and the active manifest stay in `.deploy`. The local API applies the initial idempotent schema on startup; future migrations must be added to both adapters before using this as a longer-lived service.

Browser smoke tests require a normal desktop terminal able to launch Chromium. Restricted agent sandboxes may block browser process startup; GitHub Actions runs the complete suite on Linux.

## Why Cloudflare Workers + D1?

The free plan supports this app without a paid VM or an ephemeral database:

- Workers: 100,000 dynamic requests/day on the free plan.
- Static asset requests: free and unlimited; no extra storage charge.
- D1: 5 GB total storage, 5 million rows read/day and 100,000 rows written/day.
- Free Workers account: 100 Workers. This demo uses two stable Workers plus one per remote release, so retain only the releases you need before reaching that limit. Keep current/previous versions and any still needed by open sessions. Cleanup is manual to avoid silently breaking existing clients.

Verify current limits before enabling a paid plan: [Workers limits](https://developers.cloudflare.com/workers/platform/limits/), [static asset pricing](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/), [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/). No paid service is enabled by these scripts. Free-tier capacity is finite; this is a small demo, not an availability promise.

## One-time cloud setup

A Cloudflare account is required. The repository contains no account credentials.

1. Sign up/sign in at https://dash.cloudflare.com and select Workers Free. Set your `workers.dev` subdomain in Workers & Pages. Copy the account ID.
2. Authenticate locally with `npx wrangler login`.
3. Run `npm run cloud:setup -- --account=ACCOUNT_ID --subdomain=SUBDOMAIN`. The command creates the `fieldwork` D1 database and prints its ID. If it already exists, use its existing ID.
4. Run `npm run cloud:setup -- --account=ACCOUNT_ID --subdomain=SUBDOMAIN --database=DATABASE_ID`. This applies the schema, seeds the three products, deploys the API, downloads the tested frontend releases from GitHub, and deploys the app. The URL is `https://fieldwork-shell.SUBDOMAIN.workers.dev`.

Account identifiers are saved in ignored `.cloud/account.json`. Passwords and session data stay in D1. Desktop and cloud have separate user accounts and records.

## Enable automatic GitHub cloud deployments

In repository Settings → Secrets and variables → Actions, add:

| Type     | Name                    | Value                                                                                                     |
| -------- | ----------------------- | --------------------------------------------------------------------------------------------------------- |
| Secret   | `CLOUDFLARE_API_TOKEN`  | Account-scoped token with Workers Scripts Edit, D1 Edit and Account Settings Read for your target account |
| Variable | `CLOUDFLARE_ACCOUNT_ID` | Your account ID                                                                                           |
| Variable | `D1_DATABASE_ID`        | Your existing fieldwork database ID                                                                       |
| Variable | `WORKERS_SUBDOMAIN`     | Your workers.dev subdomain, without `.workers.dev`                                                        |
| Variable | `CLOUD_ENABLED`         | `true`, **after initial setup succeeds**                                                                  |

Use Cloudflare's token creation UI and store the token directly in GitHub Secrets; do not put it in code, chat, a shell command argument, or an env file committed to Git. [Cloudflare's GitHub Actions guide](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/) describes the authentication model.

A subsequent Orders-only commit runs only Orders CI, publishes its release, deploys its static Worker, and updates its D1 manifest row. The other apps and backend stay deployed as before.

## Cloud rollback

For Catalog/Orders, run the **Roll back cloud remote** workflow or:

```sh
npm run cloud:rollback -- --app=orders
```

For shell or API, use Cloudflare's deployment history or `npx wrangler rollback --name fieldwork-shell` / `--name fieldwork-api`. Rollback does not erase or revert D1 data. The retained shell asset strategy covers the latest 100 GitHub release records; increase the release listing/retention approach before using this for a long-lived application.
