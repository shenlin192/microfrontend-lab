import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {federation} from '@module-federation/vite';
import {resolve} from 'node:path';
const app=process.env.APP_NAME||'shell';
const version=process.env.RELEASE_VERSION||'dev';
const ports:Record<string,number>={shell:4200,catalog:4201,orders:4202};
export default defineConfig({
  root:resolve(import.meta.dirname,'apps',app),
  base:process.env.NODE_ENV==='development'?'/':`/releases/${app}/${version}/`,
  plugins:[react(),...(app==='shell'?[]:[federation({
    name:app,filename:'remoteEntry.js',manifest:true,dts:false,
    ...(app==='shell'?{remotes:{}}:{exposes:{'./App':'./src/App.tsx'}}),
    shared:{react:{singleton:true,requiredVersion:'19.3.1'},'react-dom':{singleton:true,requiredVersion:'19.3.1'}}
  })])],
  resolve:{alias:{'@lab/platform':resolve(import.meta.dirname,'packages/platform/src/index.ts'),'@lab/ui':resolve(import.meta.dirname,'packages/ui/src/index.tsx')}},
  define:{__APP_VERSION__:JSON.stringify(version)},
  server:{port:ports[app],strictPort:true,host:'127.0.0.1',origin:`http://localhost:${ports[app]}`,cors:true,
    proxy:{'/api':'http://localhost:4100','/releases':'http://localhost:4100'}},
  build:{outDir:resolve(import.meta.dirname,'.artifacts',app,version),emptyOutDir:true,target:'es2022',sourcemap:true}
});
