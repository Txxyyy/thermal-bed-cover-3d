import './theme-preview.css';

const root=document.documentElement,frame=document.querySelector('#viewer');
const status=document.querySelector('#viewer-status'),slider=document.querySelector('#temperature');
const zones={
 left:{targetTemperature:22,currentTemperature:null,operatingState:'cooling',online:true,stale:false,visualIntensity:.72},
 right:{targetTemperature:34,currentTemperature:null,operatingState:'heating',online:true,stale:false,visualIntensity:.72},
};
let theme='light',selected='left',sessionId=null,id=0,revision=0,frameVisible=true;
function send(type,payload){
 if(!sessionId||!frame.contentWindow.Thermal3D)return;
 return frame.contentWindow.Thermal3D.receive({protocolVersion:1,sessionId,id:`theme-preview-${++id}`,type,payload,...(type==='applyState'?{revision:++revision}:{})});
}
function syncState(){send('applyState',{zones});}
function renderControls(){
 const zone=zones[selected];
 document.querySelectorAll('[data-zone]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.zone===selected)));
 document.querySelectorAll('[data-mode]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.mode===zone.operatingState)));
 document.querySelector('#selected-zone').textContent=selected==='left'?'左侧':'右侧';
 document.querySelector('#temperature-value').innerHTML=`${zone.targetTemperature}<small>°C</small>`;
 slider.value=String(zone.targetTemperature);slider.style.setProperty('--fill',`${(zone.targetTemperature-18)/22*100}%`);slider.disabled=zone.operatingState==='idle';
}
function setTheme(value){
 theme=value;root.dataset.theme=theme;
 document.querySelector('#theme-caption').textContent=theme==='dark'?'DARK MODE':'LIGHT MODE';
 document.querySelectorAll('[data-theme-choice]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.themeChoice===theme)));
 send('setTheme',{theme});
}
function connect(){
 const child=frame.contentWindow;
 child.addEventListener('thermal3d',event=>{
  const message=event.detail;
  if(message.type==='ready'&&sessionId!==message.sessionId){sessionId=message.sessionId;status.textContent='';send('setTheme',{theme});syncState();send('setVisible',{visible:frameVisible&&!document.hidden});}
  if(message.type==='error')status.textContent='模型加载失败，请刷新页面重试';
 });
 child.Thermal3D?.receive({protocolVersion:1,id:'preview-hello',type:'hello'});
}
frame.addEventListener('load',connect);
if(frame.contentWindow.Thermal3D)connect();
document.querySelectorAll('[data-theme-choice]').forEach(button=>button.addEventListener('click',()=>setTheme(button.dataset.themeChoice)));
document.querySelectorAll('[data-zone]').forEach(button=>button.addEventListener('click',()=>{selected=button.dataset.zone;renderControls();}));
document.querySelectorAll('[data-mode]').forEach(button=>button.addEventListener('click',()=>{zones[selected].operatingState=button.dataset.mode;renderControls();syncState();}));
slider.addEventListener('input',()=>{zones[selected].targetTemperature=Number(slider.value);renderControls();syncState();});
new IntersectionObserver(entries=>{frameVisible=entries[0].isIntersecting;send('setVisible',{visible:frameVisible&&!document.hidden});}).observe(frame);
document.addEventListener('visibilitychange',()=>send('setVisible',{visible:frameVisible&&!document.hidden}));
document.querySelector('#clock').textContent=new Intl.DateTimeFormat('zh-CN',{hour:'numeric',minute:'2-digit',hour12:false}).format(new Date());
renderControls();setTheme('light');
