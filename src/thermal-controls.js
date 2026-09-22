import {THERMAL_DEMO,THERMAL_PALETTE,ZONE_IDS} from './thermal.js';
const names={left:'左侧',right:'右侧'},modes={cool:'水冷',warm:'水暖',off:'待机'};

export function createThermalControls(bed,onChange){
 const host=document.querySelector('#zone-controls');
 host.innerHTML=`<div class="zone-heading"><span>左右独立温控</span><span>DUAL ZONE</span></div>
  <p class="zone-orientation">左右以床尾面向床头为准</p>
  <div class="zone-cards">${ZONE_IDS.map(id=>`<section class="zone-card" data-zone-card="${id}" aria-label="${names[id]}独立温控">
   <div class="zone-card-heading"><strong>${names[id]}</strong><span class="zone-mode" id="mode-${id}"></span></div>
   <div class="zone-reading"><output id="value-${id}" for="temperature-${id}"></output><span>℃</span><small>目标温度</small></div>
   <div class="zone-modes" role="group" aria-label="${names[id]}模式">${Object.entries(modes).map(([mode,label])=>`<button type="button" data-zone="${id}" data-mode="${mode}" aria-pressed="false">${label}</button>`).join('')}</div>
   <label class="sr-only" for="temperature-${id}">${names[id]}目标温度</label>
   <input class="temperature-slider" id="temperature-${id}" type="range" min="${THERMAL_DEMO.min}" max="${THERMAL_DEMO.max}" step="1">
   <div class="temperature-scale"><span>${THERMAL_DEMO.min}°</span><span id="intensity-${id}"></span><span>${THERMAL_DEMO.max}°</span></div>
  </section>`).join('')}</div>
  <label class="glow-control"><span><strong>织物温感光</strong><small>流动光脉 · 冷暖辉光</small></span><input id="fabric-glow" type="checkbox" role="switch" checked aria-label="织物温感光"></label>
  <p class="temperature-disclaimer">${THERMAL_DEMO.min}–${THERMAL_DEMO.max}℃ 为演示范围，非产品规格。</p>`;
 function reflect(){
  const state=bed.getState();
  for(const id of ZONE_IDS){
   const zone=state.zones[id],card=host.querySelector(`[data-zone-card="${id}"]`),slider=host.querySelector(`#temperature-${id}`);
   card.dataset.mode=zone.mode;card.style.setProperty('--zone-accent',THERMAL_PALETTE[zone.mode].accent);
   host.querySelector(`#value-${id}`).textContent=zone.temperature;
   host.querySelector(`#mode-${id}`).textContent=modes[zone.mode];
   host.querySelector(`#intensity-${id}`).textContent=zone.enabled?`光感 ${Math.round(zone.intensity*100)}%`:'已暂停';
   slider.value=zone.temperature;slider.disabled=!zone.enabled;slider.setAttribute('aria-valuetext',`${zone.temperature} 摄氏度，${modes[zone.mode]}`);
   card.querySelectorAll('[data-mode]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.mode===zone.mode)));
  }
 }
 host.querySelectorAll('[data-mode]').forEach(button=>button.addEventListener('click',()=>{bed.setZoneMode(button.dataset.zone,button.dataset.mode);reflect();onChange();}));
 for(const id of ZONE_IDS)host.querySelector(`#temperature-${id}`).addEventListener('input',event=>{bed.setZoneTemperature(id,Number(event.target.value));reflect();onChange();});
 host.querySelector('#fabric-glow').addEventListener('change',event=>bed.setGlow(event.target.checked));
 reflect();return {reflect};
}
