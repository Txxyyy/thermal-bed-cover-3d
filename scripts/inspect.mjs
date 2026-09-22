import {chromium} from '@playwright/test';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1500,height:1000},deviceScaleFactor:1});
 page.on('pageerror',error=>console.log('ERROR',error.stack));page.on('console',message=>{if(message.type()==='error')console.log('CONSOLE',message.text())});
 await page.goto('http://127.0.0.1:5173');await page.waitForFunction(()=>window.__thermalStudio?.snapshot().ready,{},{timeout:30000});await page.waitForTimeout(1500);
 await page.screenshot({path:'output/qa/overview.png'});console.log(await page.evaluate(()=>window.__thermalStudio.snapshot()));
 await page.getByRole('button',{name:'面料细节',exact:true}).click();await page.waitForTimeout(1800);await page.screenshot({path:'output/qa/fabric.png'});
 await page.getByRole('button',{name:'主机',exact:true}).click();await page.waitForTimeout(1800);await page.screenshot({path:'output/qa/controller.png'});
 await page.getByRole('button',{name:'整体',exact:true}).click();await page.getByRole('button',{name:'查看水循环'}).click();await page.waitForTimeout(1800);await page.screenshot({path:'output/qa/cooling.png'});
 await page.getByRole('button',{name:'水暖',exact:false}).click();await page.waitForTimeout(300);await page.screenshot({path:'output/qa/warming.png'});
 await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'返回织物外观'}).click();await page.waitForTimeout(1800);await page.screenshot({path:'output/qa/mobile.png',fullPage:true});
}finally{await browser.close();}
