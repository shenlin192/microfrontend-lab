import { build } from 'vite';
import { resolve } from 'node:path';
import { mkdir, writeFile, access } from 'node:fs/promises';
import { root, apps, arg, appName, valid } from './lib.mjs';
const selected = arg('app') ? [appName(arg('app'))] : apps;
const version = valid(arg('version', process.env.RELEASE_VERSION || 'v1'));
for (const app of selected) {
  const out = resolve(root, '.artifacts', app, version);
  try {
    await access(out);
    throw Error(
      `Artifact ${app}/${version} already exists. Use a new version; releases are immutable.`,
    );
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  process.env.APP_NAME = app;
  process.env.RELEASE_VERSION = version;
  await build({ configFile: resolve(root, 'vite.config.ts') });
  await mkdir(out, { recursive: true });
  await writeFile(
    resolve(out, 'release.json'),
    JSON.stringify(
      {
        app,
        version,
        contract: 1,
        builtAt: new Date().toISOString(),
        commit: process.env.GITHUB_SHA || 'local',
      },
      null,
      2,
    ),
  );
}
