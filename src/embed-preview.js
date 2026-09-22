const frame=document.querySelector('#viewer'),status=document.querySelector('#status'),events=document.querySelector('#events');
let sessionId,revision=0,id=0,camera='overview',cutaway=false,paused=false,visible=true;
const zones={left:{targetTemperature:26,currentTemperature:null,operatingState:'heating',online:true,stale:false,visualIntensity:.6},right:{targetTemperature:34,currentTemperature:null,operatingState:'cooling',online:true,stale:false,visualIntensity:.6}};
function send(type,payload){if(!sessionId)return;return frame.contentWindow.Thermal3D.receive({protocolVersion:1,sessionId,id:`preview-${++id}`,revision:++revision,type,payload});}
function sync(){send('applyState',{zones});}
document.querySelector('#zones').innerHTML=['left','right'].map(side=>`<fieldset data-side="${side}"><legend>${side==='left'?'左侧':'右侧'}</legend><label>目标温度 <input type="range" min="18" max="40" value="${zones[side].targetTemperature}"><output>${zones[side].targetTemperature}℃</output></label><label>模拟设备运行状态 <select>${['heating','cooling','idle','off','unknown','fault'].map(value=>`<option ${value===zones[side].operatingState?'selected':''}>${value}</option>`).join('')}</select></label><label>设备在线<input type="checkbox" data-field="online" checked></label><label>数据过期<input type="checkbox" data-field="stale"></label></fieldset>`).join('');
for(const field of document.querySelectorAll('fieldset')){
 const zone=zones[field.dataset.side];
 field.addEventListener('input',event=>{const el=event.target;if(el.type==='range'){zone.targetTemperature=Number(el.value);field.querySelector('output').textContent=`${el.value}℃`;}else if(el.tagName==='SELECT')zone.operatingState=el.value;else zone[el.dataset.field]=el.checked;sync();});
}
function connect(){
 const child=frame.contentWindow;
 child.addEventListener('thermal3d',event=>{
  const message=event.detail;events.textContent=JSON.stringify(message,null,2);
  if(message.type==='ready'&&sessionId!==message.sessionId){sessionId=message.sessionId;status.textContent='3D 已就绪 · 独立页面通信正常';sync();send('setView',{camera,cutaway});send('setPresentation',{paused});send('setVisible',{visible});}
  if(message.type==='error')status.textContent=`3D 异常：${message.payload.message}`;
 });
 child.Thermal3D?.receive({protocolVersion:1,id:'preview-hello',type:'hello'});
}
frame.addEventListener('load',connect);
if(frame.contentWindow.Thermal3D)connect();
for(const button of document.querySelectorAll('[data-camera]'))button.onclick=()=>{camera=button.dataset.camera;send('setView',{camera,cutaway});};
document.querySelector('#cutaway').onclick=()=>{cutaway=!cutaway;camera='overview';send('setView',{camera,cutaway});};
document.querySelector('#pause').onclick=()=>{paused=!paused;send('setPresentation',{paused});};
document.querySelector('#visibility').onclick=()=>{visible=!visible;send('setVisible',{visible});frame.style.visibility=visible?'visible':'hidden';};
document.querySelector('#reload').onclick=()=>{sessionId=null;status.textContent='正在重新加载…';frame.contentWindow.location.reload();};
