import './style.css';
import './thermal-controls.css';
import {createViewer} from './viewer.js';
import {createThermalControls} from './thermal-controls.js';
let viewer;
const state={ready:false,paused:matchMedia('(prefers-reduced-motion: reduce)').matches,cutaway:false,camera:'overview',error:null};
const abort=new AbortController();
window.__thermalStudio={snapshot:()=>viewer?viewer.snapshot():{...state}};
function showError(error){state.error=error.message;document.querySelector('#loading').hidden=true;const notice=document.querySelector('#error');notice.hidden=false;notice.textContent='3D 视图未能加载。请检查模型文件或浏览器的 WebGL 2 支持后刷新。';}
try {
 const params=new URLSearchParams(location.search);
 viewer=await createViewer(document.querySelector('#viewport'),{
  signal:abort.signal,initialCamera:params.get('view')==='hub'?'hub':document.body.dataset.initialCamera||'overview',azimuth:params.get('azimuth'),onError:showError,
  onCamera(name){state.camera=name;document.querySelector('#rotate').checked=false;document.querySelector('.stage').dataset.camera=name;document.querySelectorAll('button[data-camera]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.camera===name)));},
 });
 const selectCamera=name=>viewer.selectCamera(name);
 document.querySelectorAll('button[data-camera]').forEach(button=>button.addEventListener('click',()=>selectCamera(button.dataset.camera)));
 function reflectFlow(){const allOff=Object.values(viewer.getState().zones).every(zone=>!zone.enabled);document.querySelector('#flow-state').textContent=allOff?'双区待机':state.paused?'动画已暂停':'双区独立运行';document.querySelector('#pause').textContent=state.paused?'继续动画':'暂停动画';document.querySelector('#pause').setAttribute('aria-pressed',String(state.paused));}
 createThermalControls(viewer,()=>{reflectFlow();if(state.camera==='hub')selectCamera('overview');});
 document.querySelector('#xray').addEventListener('click',event=>{state.cutaway=!state.cutaway;if(state.cutaway&&state.camera==='hub')selectCamera('overview');viewer.setXray(state.cutaway);event.currentTarget.setAttribute('aria-pressed',String(state.cutaway));document.querySelector('#xray-label').textContent=state.cutaway?'返回织物外观':'查看水循环';});
 document.querySelector('#rotate').addEventListener('change',event=>{viewer.setAutoRotate(event.target.checked);});
 document.querySelector('#pause').addEventListener('click',()=>{state.paused=!state.paused;viewer.setPaused(state.paused);reflectFlow();});
 document.querySelector('#reset').addEventListener('click',()=>{viewer.setAutoRotate(false);document.querySelector('#rotate').checked=false;selectCamera('overview');});
 document.querySelector('#cmf').addEventListener('change',event=>viewer.setCMF(event.target.value));reflectFlow();

 document.querySelector('#loading').hidden=true;state.ready=true;
} catch(error){showError(error);console.error(error);}
function dispose(){abort.abort();viewer?.dispose();}
window.addEventListener('pagehide',event=>{if(!event.persisted)dispose();});
if(import.meta.hot)import.meta.hot.dispose(dispose);
