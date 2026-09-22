import './embed.css';
import {createViewer} from './viewer.js';
import {EMPTY_DEVICE_STATE,PROTOCOL_VERSION,normalizeDeviceState} from './device-state.js';

const sessionId=globalThis.crypto?.randomUUID?.()??`${Date.now()}-${Math.random().toString(36).slice(2)}`;
const abort=new AbortController();
let viewer,disposed=false,revision=-1;
const lifecycle={ready:false,error:null};
function emit(type,payload={},id=null){
 const event={protocolVersion:PROTOCOL_VERSION,sessionId,id,type,payload};
 const encoded=JSON.stringify(event);
 if(window.ThermalBridge?.postMessage)window.ThermalBridge.postMessage(encoded);
 window.dispatchEvent(new CustomEvent('thermal3d',{detail:event}));
 return event;
}
function fail(error,id=null,code='INVALID_MESSAGE'){
 return emit('error',{code,message:error.message},id);
}
function receive(message){
 let m=message;
 try {
  if(typeof m==='string'){if(m.length>16384)throw new Error('Message too large');m=JSON.parse(m);}
  if(!m||m.protocolVersion!==PROTOCOL_VERSION||typeof m.id!=='string'||m.id.length>128)throw new Error('Invalid envelope');
  if(m.type==='hello')return emit(lifecycle.ready?'ready':'loading',{revision},m.id);
  if(m.sessionId!==sessionId)throw new Error('Session mismatch');
  if(disposed)throw new Error('Viewer disposed');
  if(m.type==='dispose'){dispose();return emit('applied',{command:'dispose'},m.id);}
  if(!viewer||!lifecycle.ready)return fail(new Error('Wait for ready before commands'),m.id,'NOT_READY');
  const p=m.payload;
  switch(m.type){
   case 'applyState':
    if(!Number.isSafeInteger(m.revision)||m.revision<0)throw new Error('Invalid revision');
    if(m.revision<=revision)return emit('ignored',{reason:'STALE_REVISION',revision},m.id);
    viewer.applyState(normalizeDeviceState(p));revision=m.revision;break;
   case 'setView':
    if(!p||!['overview','detail','hub'].includes(p.camera))throw new Error('Invalid camera');
    if(p.cutaway!==undefined&&typeof p.cutaway!=='boolean')throw new Error('Invalid cutaway');
    viewer.setXray(p.cutaway??false);viewer.selectCamera(p.camera);break;
   case 'setVisible':
    if(typeof p?.visible!=='boolean')throw new Error('Invalid visibility');viewer.setVisible(p.visible);break;
   case 'setPresentation':
    if(!p||Object.keys(p).some(key=>!['paused','glow'].includes(key))||Object.values(p).some(value=>typeof value!=='boolean'))throw new Error('Invalid presentation');
    if(p.paused!==undefined)viewer.setPaused(p.paused);if(p.glow!==undefined)viewer.setGlow(p.glow);break;
   default:throw new Error('Unknown command');
  }
  // Applied is acceptance by the renderer, not a device ACK or a completed transition.
  return emit('applied',{command:m.type,revision},m.id);
 } catch(error){return fail(error,typeof m?.id==='string'?m.id:null);}
}
function dispose(){if(disposed)return;disposed=true;lifecycle.ready=false;abort.abort();viewer?.dispose();window.removeEventListener('pagehide',pagehide);}
function pagehide(event){if(!event.persisted)dispose();}
window.Thermal3D=Object.freeze({receive});
window.__thermalStudio={snapshot:()=>({...viewer?.snapshot(),...lifecycle,sessionId,revision,disposed})};
window.addEventListener('pagehide',pagehide);
async function start(){
 try {
  viewer=await createViewer(document.querySelector('#viewport'),{initialState:EMPTY_DEVICE_STATE,signal:abort.signal,onError(error){lifecycle.ready=false;lifecycle.error=error.message;emit('error',error);}});
  if(disposed){viewer.dispose();return;}
  lifecycle.ready=true;emit('ready',{revision});
 } catch(error){if(disposed)return;lifecycle.error=error.message;fail(error,null,'LOAD_FAILED');}
}
start();
if(import.meta.hot)import.meta.hot.dispose(dispose);
