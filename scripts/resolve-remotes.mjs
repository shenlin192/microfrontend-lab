import { writeFile } from 'node:fs/promises';

const [catalogVersion, ordersVersion, outputFile] = process.argv.slice(2);
const account = process.env.CLOUDFLARE_ACCOUNT_ID;
const token = process.env.CLOUDFLARE_API_TOKEN;
if (!account || !token) throw new Error('Cloudflare account ID and API token are required.');

async function resolveVersion(name, version) {
  const alias = `https://v${version.replaceAll('.', '-')}.microfrontend-lab-${name}.pages.dev`;
  // Follow pagination so an older version remains selectable after many deployments.
  for (let page = 1; ; page++) {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${account}/pages/projects/microfrontend-lab-${name}/deployments?env=preview&page=${page}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(`Cannot resolve ${name}: Cloudflare HTTP ${response.status}, ${JSON.stringify(data.errors)}`);
    }
    const deployment = data.result.find((item) =>
      item.aliases?.includes(alias) && item.latest_stage.status === 'success');
    if (deployment) {
      // Store the fixed hash URL, so later alias changes cannot change this composition.
      const release = await fetch(`${deployment.url}/release.json`);
      if (!release.ok) throw new Error(`Missing release metadata for ${name} ${version}.`);
      const metadata = await release.json();
      if (metadata.app !== name || metadata.version !== version) {
        throw new Error(`The ${name} deployment does not match release ${version}.`);
      }
      return [name, { version, entry: `${deployment.url}/remoteEntry.js` }];
    }
    if (data.result.length === 0 || page >= data.result_info?.total_pages) break;
  }
  throw new Error(`${name} ${version} is not deployed. Run its Deploy preview workflow first.`);
}

const remotes = Object.fromEntries(await Promise.all(
  [resolveVersion('catalog', catalogVersion), resolveVersion('orders', ordersVersion)],
));
await writeFile(outputFile, `${JSON.stringify(remotes, null, 2)}\n`);
