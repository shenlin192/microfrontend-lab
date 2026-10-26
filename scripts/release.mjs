import { appName, arg, valid, run, stage, promote, readManifest } from './lib.mjs';
import { smoke } from './smoke.mjs';
const app = appName(arg('app', 'orders')),
  version = valid(arg('version', 'v2')),
  base = arg('url', 'http://localhost:4100');
if (!(await fetch(base + '/api/health')).ok) throw Error('Start the local server first: npm start');
await run('npm', ['run', 'typecheck']);
await run('npm', ['test']);
await run('node', ['scripts/build.mjs', `--app=${app}`, `--version=${version}`]);
await stage(app, version);
const previous = (await readManifest()).apps[app]?.version;
// Candidate validation loads the staged app before changing the active pointer.
if (app !== 'shell') await smoke(`${base}/${app}?preview=${app}:${version}`, app);
try {
  await promote(app, version);
  await smoke(`${base}/${app === 'shell' ? 'catalog' : app}`, app);
} catch (error) {
  if (previous) await promote(app, previous);
  throw error;
}
console.log(`Release ${app}/${version} verified. Other applications were not rebuilt.`);
