import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { federation } from '@module-federation/vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, import.meta.dirname);

  return {
    plugins: [
      react(),
      federation({
        name: 'shell',
        dev: { remoteHmr: true },
        remotes: {
          catalog: { type: 'module', name: 'catalog', entry: env.VITE_CATALOG_ENTRY || 'http://localhost:4101/remoteEntry.js' },
          orders: { type: 'module', name: 'orders', entry: env.VITE_ORDERS_ENTRY || 'http://localhost:4102/remoteEntry.js' },
        },
        shared: { react: { singleton: true }, 'react-dom': { singleton: true } },
        dts: false,
      }),
    ],
    server: { port: 4100, strictPort: true, watch: { usePolling: true }, origin: 'http://localhost:4100' },
  };
});
