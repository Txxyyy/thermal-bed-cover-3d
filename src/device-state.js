export const PROTOCOL_VERSION=1;
const operations=['heating','cooling','idle','off','unknown','fault'];
const temperature=value=>value===null||Number.isFinite(value);
// Device temperatures are metadata, never a substitute for reported operating state.
export function normalizeDeviceState(input){
 if(!input||typeof input!=='object'||!input.zones)throw new Error('State must contain both zones');
 const zones={};
 for(const id of ['left','right']){
  const zone=input.zones[id];
  if(!zone||!temperature(zone.targetTemperature)||!temperature(zone.currentTemperature)||!operations.includes(zone.operatingState)||typeof zone.online!=='boolean'||typeof zone.stale!=='boolean')throw new Error(`Invalid device zone: ${id}`);
  const intensity=zone.visualIntensity??.6;
  if(!Number.isFinite(intensity)||intensity<0||intensity>1)throw new Error(`Invalid visualIntensity: ${id}`);
  zones[id]={targetTemperature:zone.targetTemperature,currentTemperature:zone.currentTemperature,operatingState:zone.operatingState,online:zone.online,stale:zone.stale,visualIntensity:intensity};
 }
 return {zones};
}
export function deviceVisual(zone){
 const active=zone.online&&!zone.stale&&['heating','cooling'].includes(zone.operatingState);
 return {...zone,temperature:zone.targetTemperature,enabled:active,mode:active?(zone.operatingState==='heating'?'warm':'cool'):'off',intensity:active?zone.visualIntensity:0};
}
export const EMPTY_DEVICE_STATE={zones:Object.fromEntries(['left','right'].map(id=>[id,{targetTemperature:null,currentTemperature:null,operatingState:'unknown',online:false,stale:true}]))};
