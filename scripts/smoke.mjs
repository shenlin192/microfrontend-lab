import {chromium} from '@playwright/test';
export async function smoke(url,app){
 const browser=await chromium.launch();
 try{const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(url);
 await page.getByRole('heading',{name:app==='orders'?'Small things, kept.':'Good things, simply made.'}).waitFor({timeout:20000});
 if(errors.length)throw Error(errors.join('\n'));
 }finally{await browser.close()}
}
