import {execFileSync} from 'node:child_process';
import {readFile,writeFile,mkdir,access} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {root,arg,appName,valid,run,stage,promote,readManifest} from './lib.mjs';
import {smoke} from './smoke.mjs';
export async function download(app,tag,repository='shenlin192/microfrontend-lab'){
 appName(app);if(!tag.startsWith(app+'-'))throw Error('Release tag does not match application');
 const version=valid(tag.slice(app.length+1)),cache=resolve(root,'.deploy/downloads',tag);
 await mkdir(cache,{recursive:true});
 await run('gh',['release','download',tag,'--repo',repository,'--dir',cache,'--pattern',`${app}.tar.gz`,'--pattern',`${app}.sha256`,'--clobber']);
 const archive=await readFile(resolve(cache,`${app}.tar.gz`)),expected=(await readFile(resolve(cache,`${app}.sha256`),'utf8')).trim().split(/\s/)[0];
 if(createHash('sha256').update(archive).digest('hex')!==expected)throw Error('Artifact checksum mismatch');
 const members=execFileSync('tar',['-tzf',resolve(cache,`${app}.tar.gz`)],{encoding:'utf8'}).split('\n').filter(Boolean);
 if(members.some(p=>p.startsWith('/')||p.split('/').includes('..')))throw Error('Unsafe archive paths');
 const destination=resolve(root,'.artifacts',app,version);
 try{await access(destination);return version;}catch{}
 await mkdir(destination,{recursive:true});await run('tar',['-xzf',resolve(cache,`${app}.tar.gz`),'-C',destination]);
 const release=JSON.parse(await readFile(resolve(destination,'release.json'),'utf8'));if(release.app!==app||release.version!==version||release.contract!==1)throw Error('Incompatible release metadata');
 return version;
}
export function latest(app,repo){const items=JSON.parse(execFileSync('gh',['release','list','--repo',repo,'--limit','100','--json','tagName,isDraft,isPrerelease'],{encoding:'utf8'}));return items.find(r=>!r.isDraft&&!r.isPrerelease&&r.tagName.startsWith(app+'-'))?.tagName;}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const app=appName(arg('app','orders')),repo=arg('repo','shenlin192/microfrontend-lab'),tag=arg('tag',latest(app,repo));if(!tag)throw Error('No published release found');
 const version=await download(app,tag,repo);await stage(app,version);
 if(process.argv.includes('--stage-only'))process.exit(0);
 const base=arg('url','http://localhost:4100'),previous=(await readManifest()).apps[app]?.version;
 if(app!=='shell')await smoke(`${base}/${app}?preview=${app}:${version}`,app);
 try{await promote(app,version);await smoke(`${base}/${app==='shell'?'catalog':app}`,app);}catch(error){if(previous)await promote(app,previous);throw error;}
 console.log(`Desktop now runs verified GitHub release ${tag}`);
}
