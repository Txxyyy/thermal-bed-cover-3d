import {chromium} from '@playwright/test';
import fs from 'node:fs';
const browser=await chromium.launch({headless:true,channel:'chrome'});
const errors=[];fs.mkdirSync('output/qa-zones',{recursive:true});
try{
 const page=await browser.newPage({viewport:{width:1500,height:1050}});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto('http://127.0.0.1:5173/');await page.waitForFunction(()=>window.__thermalStudio?.snapshot().ready);await page.waitForTimeout(1400);
 await page.screenshot({path:'output/qa-zones/fabric-dual.png',fullPage:true});
 await page.locator('#pause').click();
 for(const [id,value] of [['left',18],['right',40]])await page.locator(`#temperature-${id}`).fill(String(value));
 await page.waitForTimeout(1600);await page.screenshot({path:'output/qa-zones/fabric-strong.png',fullPage:true});
 await page.locator('#fabric-glow').uncheck();await page.screenshot({path:'output/qa-zones/fabric-unlit.png',fullPage:true});await page.locator('#fabric-glow').check();
 await page.locator('#xray').click();await page.waitForTimeout(1400);await page.screenshot({path:'output/qa-zones/water-dual.png',fullPage:true});
 await page.locator('#xray').click();await page.locator('button[data-camera=detail]').click();await page.waitForTimeout(1600);await page.screenshot({path:'output/qa-zones/fabric-detail.png',fullPage:true});
 await page.locator('button[data-camera=overview]').click();await page.waitForTimeout(1600);
 const canvasBox=await page.locator('canvas').boundingBox(),startX=canvasBox.x+canvasBox.width*.7,startY=canvasBox.y+canvasBox.height*.5;
 await page.mouse.move(startX,startY);await page.mouse.down();await page.mouse.move(startX-canvasBox.height*.27,startY,{steps:24});await page.mouse.up();await page.waitForTimeout(1200);
 await page.screenshot({path:'output/qa-zones/head-connection.png',fullPage:true});
 await page.locator('#xray').click();await page.waitForTimeout(1400);await page.screenshot({path:'output/qa-zones/head-water.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});await page.goto('http://127.0.0.1:5180/');await page.waitForFunction(()=>window.__thermalStudio?.snapshot().ready);await page.waitForTimeout(1600);await page.screenshot({path:'output/qa-zones/mobile-dual.png',fullPage:true});
 console.log(JSON.stringify({errors,state:await page.evaluate(()=>window.__thermalStudio.snapshot())},null,2));
}finally{await browser.close();}
