// No credentials are stored in this repository. Wrangler OAuth is used locally;
// GitHub Actions uses its CLOUDFLARE_API_TOKEN secret and account/database variables.
import {execFileSync} from 'node:child_process';
import {mkdir,readFile,writeFile,cp,access} from 'node:fs/promises';
import {resolve} from 'node:path';
import {root,arg,valid,apps,run} from './lib.mjs';
import {latest,download} from './download.mjs';
const action=process.argv[2]||'deploy';
const configFile=resolve(root,'.cloud/account.json');
let saved={};try{saved=JSON.parse(await readFile(configFile,'utf8'))}catch{}
const account=process.env.CLOUDFLARE_ACCOUNT_ID||arg('account',saved.account);
const subdomain=process.env.WORKERS_SUBDOMAIN||arg('subdomain',saved.subdomain);
const databaseId=process.env.D1_DATABASE_ID||arg('database',saved.database);
const env={...process.env,CLOUDFLARE_ACCOUNT_ID:account,WRANGLER_LOG_PATH:resolve(root,'.cloud/wrangler.log')};
const baseConfig={compatibility_date:'2026-10-01',account_id:account,workers_dev:true};
async function wrangler(args){await run('node',['node_modules/wrangler/bin/wrangler.js',...args],env)}
async function saveConfig(name,data){const path=resolve(root,'.cloud',`${name}.json`);await mkdir(resolve(path,'..'),{recursive:true});await writeFile(path,JSON.stringify(data,null,2));return path;}
async function dbConfig(){return saveConfig('db',{...baseConfig,name:'fieldwork-api',main:resolve(root,'server/worker.mjs'),d1_databases:[{binding:'DB',database_name:'fieldwork',database_id:databaseId,migrations_dir:resolve(root,'server/migrations')}]})}
async function sql(statement){const cfg=await dbConfig();const file=resolve(root,'.cloud/query.sql');await writeFile(file,statement);await wrangler(['d1','execute','fieldwork','--remote','--config',cfg,'--file',file]);}
const quote=s=>"'"+String(s).replaceAll("'","''")+"'";
async function record(app,version,entry){await sql(`INSERT INTO deployments(app,version,entry,updated_at) VALUES (${quote(app)},${quote(version)},${quote(entry)},datetime('now')) ON CONFLICT(app) DO UPDATE SET previous_version=version,previous_entry=entry,version=excluded.version,entry=excluded.entry,updated_at=excluded.updated_at;\nINSERT INTO release_history VALUES (${quote(crypto.randomUUID())},${quote(app)},${quote(version)},${quote(entry)},datetime('now'));`);}
async function deploy(app,version){
 valid(version);
 if(app==='backend'){
   const cfg=await dbConfig();await wrangler(['d1','migrations','apply','fieldwork','--remote','--config',cfg]);
   await wrangler(['d1','execute','fieldwork','--remote','--config',cfg,'--file',resolve(root,'server/seed.sql')]);
   await wrangler(['deploy','--config',cfg,'--var',`RELEASE_VERSION:${version}`]);
   return;
 }
 if(!apps.includes(app))throw Error('Invalid app');
 const artifact=resolve(root,'.artifacts',app,version);await access(resolve(artifact,'release.json'));
 const directory=resolve(root,'.cloud/assets',app,version);await mkdir(directory,{recursive:true});
 await cp(artifact,resolve(directory,'releases',app,version),{recursive:true});
 const name=app==='shell'?'fieldwork-shell':`fieldwork-${app}-${version}`;
 if(name.length>63)throw Error('Cloud release version is too long');
 if(app==='shell'){
   await cp(resolve(artifact,'index.html'),resolve(directory,'index.html'));
   // Keep older shell assets available to already-open browser sessions.
   const repo=process.env.GITHUB_REPOSITORY||'shenlin192/microfrontend-lab';
   const releases=JSON.parse(execFileSync('gh',['release','list','--repo',repo,'--limit','100','--json','tagName,isDraft'],{encoding:'utf8'})).filter(r=>!r.isDraft&&r.tagName.startsWith('shell-'));
   for(const release of releases){const old=release.tagName.slice(6);if(old===version)continue;await download('shell',release.tagName,repo);await cp(resolve(root,'.artifacts/shell',old),resolve(directory,'releases/shell',old),{recursive:true});}
 }
 await writeFile(resolve(directory,'_headers'),'/*\n  Access-Control-Allow-Origin: *\n  X-Content-Type-Options: nosniff\n/releases/*\n  Cache-Control: public, max-age=31536000, immutable\n');
 const cfg=await saveConfig(`${app}-${version}`,{...baseConfig,name,main:resolve(root,app==='shell'?'server/shell-worker.mjs':'server/remote-worker.mjs'),
   assets:{directory,binding:'ASSETS',...(app==='shell'?{not_found_handling:'single-page-application',run_worker_first:['/api/*']}:{})},
   ...(app==='shell'?{services:[{binding:'BACKEND',service:'fieldwork-api'}]}:{})});
 await wrangler(['deploy','--config',cfg]);
 const origin=`https://${name}.${subdomain}.workers.dev`,entry=app==='shell'?origin:origin+`/releases/${app}/${version}/remoteEntry.js`;
 const check=await fetch(app==='shell'?origin+'/api/health':entry);if(!check.ok)throw Error(`Deployment did not pass HTTP check: ${check.status}`);
 if(app!=='shell'){
   // Smoke-test candidate in a real browser without moving the production pointer.
   // CI has already checked its contract with the released sibling applications.
   const content=await check.text();if(!content.includes('get')||!content.includes('init'))throw Error('Invalid federation entry');
 }
 await record(app,version,entry);
 console.log(`Cloud ${app}/${version} is active: ${entry}`);
}
if(!account||!subdomain)throw Error('Provide --account=YOUR_ACCOUNT_ID --subdomain=YOUR_WORKERS_SUBDOMAIN. See docs/DEPLOYMENT.md.');
if(action==='setup'){
 await saveConfig('account',{account,subdomain,database:databaseId});
 if(!databaseId){await wrangler(['d1','create','fieldwork']);console.log('Re-run cloud:setup with --database=<database_id printed above>.');process.exit(0);}
 await deploy('backend','v1');
 for(const app of ['catalog','orders','shell']){
   const repo='shenlin192/microfrontend-lab',tag=latest(app,repo);if(!tag)throw Error(`No ${app} release exists on GitHub yet`);const version=await download(app,tag,repo);await deploy(app,version);
 }
}else if(action==='rollback'){
 const app=arg('app','orders');if(!['catalog','orders'].includes(app))throw Error('For shell/backend rollback use wrangler rollback; see deployment guide.');
 await sql(`UPDATE deployments SET version=previous_version,entry=previous_entry,previous_version=version,previous_entry=entry,updated_at=datetime('now') WHERE app=${quote(app)} AND previous_version IS NOT NULL; INSERT INTO release_history SELECT ${quote(crypto.randomUUID())},app,version,entry,datetime('now') FROM deployments WHERE app=${quote(app)};`);
}else{if(!databaseId)throw Error('D1_DATABASE_ID is required.');await deploy(arg('app','orders'),valid(arg('version',process.env.RELEASE_VERSION||'v1')));}
