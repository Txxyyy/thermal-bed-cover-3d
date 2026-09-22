import {chromium} from '@playwright/test';
import fs from 'node:fs';
const browser=await chromium.launch({headless:true,channel:'chrome'});
try {
 fs.mkdirSync('output/controller-study',{recursive:true});
 const page=await browser.newPage({viewport:{width:1100,height:950},deviceScaleFactor:1});page.on('pageerror',e=>console.log('ERROR',e.message));
 await page.goto('http://127.0.0.1:5173/?view=hub');await page.waitForFunction(()=>window.__thermalStudio?.snapshot().ready);await page.waitForTimeout(350);
 await page.screenshot({path:'output/controller-study/after.png'});
 // The canvas alone is the comparison evidence; controls and copy do not enter image diagnostics.
 for(const angle of [0,90,180,270]){
  await page.goto(`http://127.0.0.1:5173/?view=hub&azimuth=${angle}`);await page.waitForFunction(()=>window.__thermalStudio?.snapshot().ready);await page.waitForTimeout(300);await page.locator('canvas').screenshot({path:`output/controller-study/angle-${angle}.png`});
 }
 await page.goto('http://127.0.0.1:5173/?view=hub');await page.waitForFunction(()=>window.__thermalStudio?.snapshot().ready);await page.waitForTimeout(350);await page.locator('canvas').screenshot({path:'output/controller-study/three-quarter.png'});
 await page.setViewportSize({width:390,height:844});await page.goto('http://127.0.0.1:5180/');await page.waitForFunction(()=>window.__thermalStudio?.snapshot().ready);await page.waitForTimeout(350);await page.screenshot({path:'output/controller-study/mobile-controller.png',fullPage:true});
 await page.locator('#xray').click();await page.waitForTimeout(1600);await page.screenshot({path:'output/controller-study/mobile-system.png',fullPage:true});
 console.log(await page.evaluate(()=>window.__thermalStudio.snapshot()));
}finally{await browser.close()}
