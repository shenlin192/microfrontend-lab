import React from 'react';
import * as ReactDOM from 'react-dom';
import { createInstance } from '@module-federation/enhanced/runtime';
import type { AppProps, Release } from '@lab/platform';
const runtime = createInstance({
  name: 'fieldwork_shell',
  remotes: [],
  shared: {
    react: {
      version: React.version,
      lib: () => React,
      shareConfig: { singleton: true, requiredVersion: React.version },
    },
    'react-dom': {
      version: React.version,
      lib: () => ReactDOM,
      shareConfig: { singleton: true, requiredVersion: React.version },
    },
  },
});
export async function loadApp(release: Release, trace: (message: string) => void) {
  const alias = `${release.app}_${release.version.replaceAll('-', '_')}`;
  const entry = new URL(release.entry, location.origin).href;
  trace(`LOAD ${release.app} ${release.version} → ${entry}`);
  runtime.registerRemotes([{ name: release.app, alias, entry, type: 'module' }], { force: true });
  const module = await runtime.loadRemote<{ default: React.ComponentType<AppProps> }>(
    `${alias}/App`,
  );
  if (!module?.default) throw new Error(`Remote ${release.app} did not expose ./App`);
  trace(`READY ${release.app} · shared React ${React.version}`);
  return module;
}
