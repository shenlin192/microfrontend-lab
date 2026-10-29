import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { federation } from '@module-federation/vite';

export default defineConfig(({ command }) => {
  // Vite needs the dev addresses to connect the remotes' React Fast Refresh.
  // Production addresses are registered by main.jsx at runtime instead.
  const devRemotes = command === 'serve'
    ? JSON.parse(readFileSync(new URL('./public/remotes.json', import.meta.url), 'utf8'))
    : {};

  return {
    plugins: [
      react(),
      federation({
        name: 'shell',
        dev: { remoteHmr: true },
        remotes: Object.fromEntries(Object.entries(devRemotes).map(([name, { entry }]) => [
          name, { type: 'module', name, entry },
        ])),
        shared: { react: { singleton: true }, 'react-dom': { singleton: true } },
        dts: false,
      }),
    ],
    server: { port: 4100, strictPort: true, watch: { usePolling: true }, origin: 'http://localhost:4100' },
  };
});
