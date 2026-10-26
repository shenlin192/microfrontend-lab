import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { federation } from '@module-federation/vite';

export default defineConfig({
  plugins: [
    react(),
    federation({
      name: 'orders',
      filename: 'remoteEntry.js',
      exposes: { './App': './src/App.jsx' },
      shared: { react: { singleton: true }, 'react-dom': { singleton: true } },
      dts: false,
    }),
  ],
  server: { port: 4102, strictPort: true, origin: 'http://localhost:4102' },
});
