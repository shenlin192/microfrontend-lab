import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {Readable} from 'node:stream';
import {database} from './sqlite.mjs';
import {api} from './api.mjs';
import {root,readManifest,readHistory} from '../scripts/lib.mjs';
const port=Number(process.env.PORT||4100), db=database(process.env.DB_PATH||resolve(root,'.data/lab.sqlite'));
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.map':'application/json'};
async function staticFile(res,file,immutable=false){const data=await readFile(file);res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream','Cache-Control':immutable?'public,max-age=31536000,immutable':'no-store','X-Content-Type-Options':'nosniff'});res.end(data);}
async function handler(req,res){
  try {
    const origin=`http://localhost:${port}`,url=new URL(req.url,origin);
    if(url.pathname.startsWith('/api/')){
      const request=new Request(url,{method:req.method,headers:req.headers,...(!['GET','HEAD'].includes(req.method)?{body:Readable.toWeb(req),duplex:'half'}:{})});
      const response=await api(request,db,{storage:'SQLite',devOrigin:process.env.DEV_ORIGIN,manifest:readManifest,releases:readHistory});
      res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));return;
    }
    if(url.pathname.startsWith('/releases/')){
      const base=resolve(root,'.deploy/releases'),file=resolve(base,'.'+decodeURIComponent(url.pathname.slice('/releases'.length)));
      if(!file.startsWith(base+'/')){res.writeHead(403);res.end();return;}
      await staticFile(res,file,true);return;
    }
    const manifest=await readManifest(),shell=manifest.apps.shell;
    if(!shell){res.writeHead(503);res.end('Run npm run setup first.');return;}
    const base=resolve(root,'.deploy/releases/shell',shell.version);
    const file=resolve(base,'.'+decodeURIComponent(url.pathname));
    if(!file.startsWith(base+'/')&&file!==base){res.writeHead(403);res.end();return;}
    const candidate=await stat(file).catch(()=>null);
    await staticFile(res,candidate?.isFile()?file:resolve(base,'index.html'));
  }catch(error){res.writeHead(error.code==='ENOENT'?404:500,{'Content-Type':'text/plain'});res.end(error.code==='ENOENT'?'Release asset not found':'Server error');}
}
const server=http.createServer(handler);server.listen(port,'127.0.0.1',()=>console.log(`Microfrontend Lab → http://localhost:${port}`));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>{db.close();process.exit(0);}));
