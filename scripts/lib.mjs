import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {mkdir,readFile,writeFile,rename,cp,access} from 'node:fs/promises';
import {spawn} from 'node:child_process';
export const root=fileURLToPath(new URL('..',import.meta.url));
export const apps=['shell','catalog','orders'];
export function arg(name,fallback){const entry=process.argv.find(a=>a.startsWith(`--${name}=`));return entry?entry.slice(name.length+3):fallback;}
export function valid(value){if(!/^[a-z0-9][a-z0-9-]{0,63}$/.test(value))throw Error(`Invalid release identifier: ${value}`);return value;}
export function appName(value){if(!apps.includes(value))throw Error('App must be shell, catalog, or orders.');return value;}
export async function run(command,args=[],env={}){await new Promise((ok,no)=>{const p=spawn(command,args,{cwd:root,stdio:'inherit',env:{...process.env,...env}});p.on('error',no);p.on('exit',code=>code===0?ok():no(Error(`${command} exited ${code}`)));});}
export async function readManifest(){try{return JSON.parse(await readFile(resolve(root,'.deploy/manifest.json'),'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;return {apps:{}};}}
export async function readHistory(){try{return JSON.parse(await readFile(resolve(root,'.deploy/history.json'),'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;return [];}}
export async function atomic(file,data){await mkdir(resolve(file,'..'),{recursive:true});const temp=file+`.${process.pid}.tmp`;await writeFile(temp,JSON.stringify(data,null,2));await rename(temp,file);}
export async function stage(app,version){
  appName(app);valid(version);const from=resolve(root,'.artifacts',app,version),to=resolve(root,'.deploy/releases',app,version);
  await access(resolve(from,'release.json'));
  try{await access(to);return;}catch{}
  const tmp=to+`.${process.pid}.tmp`;await cp(from,tmp,{recursive:true});await rename(tmp,to);
}
export async function promote(app,version){
  appName(app);valid(version);await access(resolve(root,'.deploy/releases',app,version,app==='shell'?'index.html':'remoteEntry.js'));
  const manifest=await readManifest(),previous=manifest.apps[app];
  const entry=`/releases/${app}/${version}/remoteEntry.js`;
  const release={app,version,entry,previous_version:previous?.version,previous_entry:previous?.entry,updated_at:new Date().toISOString()};
  manifest.apps[app]=release;
  await atomic(resolve(root,'.deploy/manifest.json'),manifest);
  const history=await readHistory();history.unshift({...release,created_at:release.updated_at});await atomic(resolve(root,'.deploy/history.json'),history.slice(0,100));
  console.log(`Promoted ${app}: ${previous?.version||'(none)'} → ${version}`);
}
