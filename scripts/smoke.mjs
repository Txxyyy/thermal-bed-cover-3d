import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {checkZones} from './zone-checks.mjs';
import {checkThermalRoute} from './check-thermal-route.mjs';
import {checkControllerPlacement} from './check-controller-placement.mjs';
const baseURL=process.env.THERMAL_TEST_URL||'http://127.0.0.1:5173';
fs.mkdirSync('output/qa',{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'});
const checks=[],errors=[];
const check=(label,condition)=>{assert.ok(condition,label);checks.push(label);};
try {
 checkThermalRoute(check);
 const page=await browser.newPage({viewport:{width:1500,height:1000}});
 page.on('pageerror',error=>errors.push(error.message));
 page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
 page.on('response',response=>{if(response.status()>=400)errors.push(`${response.status()} ${response.url()}`);});
 await page.goto(baseURL);await page.waitForFunction(()=>window.__thermalStudio?.snapshot().ready);
 const snapshot=()=>page.evaluate(()=>window.__thermalStudio.snapshot());
 await page.waitForTimeout(250);
 let initial=await snapshot();check('WebGL renders the source CAD and model',initial.render.triangles>12000&&initial.cadMeshes===42);
 checkControllerPlacement(initial,check);
 await checkZones(page,check,{output:'output/qa'});
 await page.locator('#cmf').selectOption('A');check('ID material A selectable',(await snapshot()).cmf==='A');await page.locator('#cmf').selectOption('B');
 for(const [view,file] of [['detail','fabric'],['hub','controller'],['overview','overview']]){
   await page.locator(`button[data-camera=${view}]`).click();await page.waitForTimeout(1600);check(`Camera ${view}`, (await snapshot()).camera===view);await page.screenshot({path:`output/qa/${file}.png`});
 }
 const before=await snapshot();await page.locator('#rotate').check();await page.waitForTimeout(300);
 check('Auto rotation moves the camera',JSON.stringify(before.cameraPosition)!==JSON.stringify((await snapshot()).cameraPosition));await page.locator('#reset').click();check('Reset disables rotation',!await page.locator('#rotate').isChecked());
 const box=await page.locator('canvas').boundingBox();await page.mouse.move(box.x+box.width*.5,box.y+box.height*.5);await page.mouse.down();await page.mouse.move(box.x+box.width*.5+100,box.y+box.height*.5+20,{steps:10});await page.mouse.up();
 check('Pointer orbit changes camera',JSON.stringify(before.cameraPosition)!==JSON.stringify((await snapshot()).cameraPosition));await page.locator('#reset').click();
 for(const width of [390,768]){
   await page.setViewportSize({width,height:844});await page.waitForTimeout(1600);
   check(`No horizontal overflow at ${width}px`,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   check(`Controls remain within viewport at ${width}px`,await page.locator('.panel').evaluate(el=>el.getBoundingClientRect().right<=innerWidth));
   await page.screenshot({path:`output/qa/${width===390?'mobile':'tablet'}.png`,fullPage:true});
 }
 check('No page, console or HTTP errors',errors.length===0);
 const motion=await browser.newPage({reducedMotion:'reduce'});await motion.goto(baseURL);await motion.waitForFunction(()=>window.__thermalStudio?.snapshot().ready);
 check('Reduced motion starts paused',await motion.evaluate(()=>window.__thermalStudio.snapshot().paused));await motion.close();
 const fallback=await browser.newPage();await fallback.route('**/models/controller.glb',route=>route.fulfill({status:404,body:'missing'}));await fallback.goto(baseURL);await fallback.locator('#error').waitFor({state:'visible'});
 check('Missing model shows an error, not a false success',await fallback.evaluate(()=>!window.__thermalStudio.snapshot().ready&&!!window.__thermalStudio.snapshot().error));await fallback.close();
 const manifest=JSON.parse(fs.readFileSync('public/models/controller-manifest.json','utf8'));
 check('CAD source hash matches conversion record',crypto.createHash('sha256').update(fs.readFileSync('references/source/controller-0916.stp')).digest('hex')===manifest.sourceSHA256);
 const report={date:new Date().toISOString(),baseURL,checks:checks.length,passed:checks,errors};fs.writeFileSync('output/qa/checks.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
} finally {await browser.close();}
