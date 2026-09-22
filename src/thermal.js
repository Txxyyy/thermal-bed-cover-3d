// Preview values only. Replace with the confirmed device range before APP integration.
export const THERMAL_DEMO={min:18,max:40,neutral:28,coolPreset:22,warmPreset:34};
export const ZONE_IDS=['left','right'];
export const THERMAL_PALETTE={
 cool:{water:'#46b6d3',emissive:'#257d9c',particle:'#c4f0ff',glow:'#0759ff',highlight:'#66e2ff',accent:'#437f93'},
 warm:{water:'#e7a26e',emissive:'#bf6234',particle:'#ffe7c5',glow:'#ff3014',highlight:'#ffc16b',accent:'#b57a52'},
 off:{water:'#526064',emissive:'#000000',particle:'#adb8b9',glow:'#000000',accent:'#838a7f'},
};
export function thermalState(temperature,enabled=true){
 if(!Number.isFinite(temperature))throw new Error('Temperature must be finite');
 const value=Math.max(THERMAL_DEMO.min,Math.min(THERMAL_DEMO.max,temperature));
 const cold=value<=THERMAL_DEMO.neutral;
 const mode=enabled?(cold?'cool':'warm'):'off';
 const span=cold?THERMAL_DEMO.neutral-THERMAL_DEMO.min:THERMAL_DEMO.max-THERMAL_DEMO.neutral;
 const intensity=enabled?Math.pow(Math.abs(value-THERMAL_DEMO.neutral)/span,.85):0;
 return {temperature:value,enabled,mode,intensity};
}
