import { access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { root, apps, run, stage, promote, readManifest } from './lib.mjs';
for (const app of apps) {
  try {
    await access(resolve(root, '.artifacts', app, 'v1', 'release.json'));
  } catch {
    await run('node', ['scripts/build.mjs', `--app=${app}`, '--version=v1']);
  }
  await stage(app, 'v1');
  if (!(await readManifest()).apps[app]) await promote(app, 'v1');
}
console.log('Ready. Run npm start, then open http://localhost:4100');
