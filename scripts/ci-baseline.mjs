import {resolve} from 'node:path';
import {access} from 'node:fs/promises';
import {root,apps,run,stage,promote} from './lib.mjs';
import {latest,download} from './download.mjs';
const repo=process.env.GITHUB_REPOSITORY||'shenlin192/microfrontend-lab';
for(const app of apps){
 let tag=latest(app,repo),version;
 if(tag){version=await download(app,tag,repo)}
 else{version='baseline';await run('node',['scripts/build.mjs',`--app=${app}`,`--version=${version}`]);}
 await stage(app,version);await promote(app,version);
}
console.log('Integration environment uses existing released siblings; source-built baselines are only needed before their first release.');
