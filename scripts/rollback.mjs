import {appName,arg,readManifest,promote} from './lib.mjs';
const app=appName(arg('app','orders')),current=(await readManifest()).apps[app];
const version=arg('version',current?.previous_version);if(!version)throw Error('No previous release.');
await promote(app,version);
