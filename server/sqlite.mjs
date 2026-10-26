import { DatabaseSync } from 'node:sqlite';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
export function database(file) {
  if(file!==':memory:') mkdirSync(dirname(file),{recursive:true});
  const sqlite=new DatabaseSync(file); sqlite.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;');
  sqlite.exec(readFileSync(new URL('./migrations/0001.sql',import.meta.url),'utf8'));
  sqlite.exec(readFileSync(new URL('./seed.sql',import.meta.url),'utf8'));
  return {
    prepare(sql) {
      let args=[];
      return { bind(...values){args=values;return this;}, async first(){return sqlite.prepare(sql).get(...args)||null;}, async all(){return {results:sqlite.prepare(sql).all(...args)};}, async run(){return sqlite.prepare(sql).run(...args);} };
    },
    async batch(statements){sqlite.exec('BEGIN IMMEDIATE');try{const results=[];for(const statement of statements)results.push(await statement.run());sqlite.exec('COMMIT');return results;}catch(error){sqlite.exec('ROLLBACK');throw error;}},
    close(){sqlite.close();}
  };
}
