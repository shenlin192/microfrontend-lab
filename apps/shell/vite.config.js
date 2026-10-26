import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { federation } from '@module-federation/vite';

export default defineConfig({
  plugins: [
    react(),
    federation({
      name: 'shell',
      remotes: {
        catalog: { type: 'module', name: 'catalog', entry: 'http://localhost:4101/remoteEntry.js' },
        orders: { type: 'module', name: 'orders', entry: 'http://localhost:4102/remoteEntry.js' },
      },
      shared: { react: { singleton: true }, 'react-dom': { singleton: true } },
      dts: false,
    }),
  ],
  server: { port: 4100, strictPort: true, origin: 'http://localhost:4100' },
});
