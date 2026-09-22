import * as THREE from 'three';
import {THERMAL_PALETTE,ZONE_IDS} from './thermal.js';
import {createThermalRouteField,THERMAL_ROUTE_FIELD} from './thermal-route.js';

// Light lives in the cloth material itself, so the quilt geometry and weave remain visible.
export function attachThermalGlow(material,curves){
 const routeField=createThermalRouteField(curves);
 material.addEventListener('dispose',()=>routeField.dispose());
 const uniforms={
  thermalRoute:{value:routeField},
  thermalLeft:{value:new THREE.Color(THERMAL_PALETTE.cool.glow)},
  thermalRight:{value:new THREE.Color(THERMAL_PALETTE.warm.glow)},
  thermalLeftHighlight:{value:new THREE.Color(THERMAL_PALETTE.cool.highlight)},
  thermalRightHighlight:{value:new THREE.Color(THERMAL_PALETTE.warm.highlight)},
  thermalStrength:{value:new THREE.Vector2()},
  thermalPhase:{value:new THREE.Vector2()},
  thermalVisibility:{value:1},
 };
 material.onBeforeCompile=shader=>{
  Object.assign(shader.uniforms,uniforms);
  shader.vertexShader='varying vec2 vThermalPosition;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvThermalPosition = position.xz;');
  shader.fragmentShader=`
   varying vec2 vThermalPosition;
   uniform vec3 thermalLeft;
   uniform vec3 thermalRight;
   uniform vec3 thermalLeftHighlight;
   uniform vec3 thermalRightHighlight;
   uniform vec2 thermalStrength;
   uniform vec2 thermalPhase;
   uniform float thermalVisibility;
   uniform sampler2D thermalRoute;
   vec3 clothLight(vec2 p, vec2 route, float center, float time, vec3 tint, vec3 highlight, float strength) {
    // Retain dark textile around each zone so the moving light has visible contrast.
    vec2 local=vec2((p.x-center)/0.46,p.y/0.92);
    float spread=exp(-1.25*pow(abs(local.x),4.0)-0.9*pow(abs(local.y),6.0));
    float core=exp(-1.5*local.x*local.x-0.55*pow(abs(local.y),4.0));
    float distance=route.x*${THERMAL_ROUTE_FIELD.reach.toFixed(4)};
    float diffusion=exp(-pow(distance/0.078,2.0));
    float softTrace=exp(-pow(distance/0.027,2.0));
    float filament=exp(-pow(distance/0.008,2.0));
    // Four bright heads with trailing light travel at the actual water layer's arc speed.
    float travel=fract((time*0.019-route.y)*4.0);
    float head=exp(-pow(min(travel,1.0-travel)/0.065,2.0));
    float tail=exp(-travel*9.0)*smoothstep(0.0,0.045,travel)*(1.0-smoothstep(0.75,1.0,travel));
    float packet=head+0.8*tail;
    // A wide, curved wave illuminates cloth cells; it never uses nearest-path arc switches.
    float wavePhase=p.y*4.6+0.65*local.x*local.x-time*1.15;
    float wave=exp(-pow(sin(wavePhase)/0.42,2.0));
    float breath=0.91+0.09*sin(time*0.85);
    float fill=(0.16+0.58*core+0.16*diffusion+0.27*wave*core)*breath;
    // Anti-aliased pin lights follow the diamond knit, becoming visible in a passing wave.
    vec2 cell=(vec2(p.x+p.y,p.x-p.y))/0.044;
    vec2 cellDistance=abs(fract(cell+0.5)-0.5);
    float pointDistance=length(cellDistance);
    float aa=max(length(fwidth(cell)),0.035);
    float point=1.0-smoothstep(0.09-aa,0.09+aa,pointDistance);
    float cells=point*(0.035+0.28*wave)*core;
    // Keep arc modulation close to the real route to avoid seams halfway between pipes.
    // Supply and return are close together at the head; keep their bright wakes separate.
    float routeFocus=mix(filament,softTrace,smoothstep(-0.91,-0.84,p.y));
    float flowing=softTrace*0.055+routeFocus*0.78*packet+filament*(0.035+0.70*head);
    float energy=strength*(1.05+0.65*strength);
    vec3 body=mix(tint,highlight,core*0.25);
    vec3 hotCore=mix(highlight,vec3(1.0),0.22);
    return (body*fill+highlight*(flowing+cells)+hotCore*filament*head*0.35)*energy*spread;
   }
  `+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>',`
   #include <emissivemap_fragment>
   {
   vec2 p = vThermalPosition;
   vec4 route=texture2D(thermalRoute,p/vec2(${THERMAL_ROUTE_FIELD.width.toFixed(4)},${THERMAL_ROUTE_FIELD.length.toFixed(4)})+0.5);
   float relief=clamp(dot(diffuseColor.rgb,vec3(0.2126,0.7152,0.0722))*22.0,0.18,1.0);
   vec3 radiance=clothLight(p,route.rg,-0.43,thermalPhase.x,thermalLeft,thermalLeftHighlight,thermalStrength.x)
                +clothLight(p,route.ba,0.43,thermalPhase.y,thermalRight,thermalRightHighlight,thermalStrength.y);
   totalEmissiveRadiance+=radiance*(0.24+0.76*relief)*thermalVisibility;
   }
  `);
 };
 material.customProgramCacheKey=()=> 'thermal-cloth-zones-v5-energy-flow';
 let settled=true;
 const colors=[uniforms.thermalLeft.value,uniforms.thermalRight.value];
 const highlights=[uniforms.thermalLeftHighlight.value,uniforms.thermalRightHighlight.value];
 const targets=[new THREE.Color(),new THREE.Color()];
 return {
  isSettled:()=>settled,
  update(zones,dt,visible){
   settled=true;
   uniforms.thermalVisibility.value=visible;
   for(let i=0;i<2;i++){
    const zone=zones[ZONE_IDS[i]];
    const eased=THREE.MathUtils.damp(uniforms.thermalStrength.value.getComponent(i),zone.intensity,4,dt);
    const next=Math.abs(eased-zone.intensity)<.0001?zone.intensity:eased;
    uniforms.thermalStrength.value.setComponent(i,next);
    if(next!==zone.intensity)settled=false;
    uniforms.thermalPhase.value.setComponent(i,zone.phase);
    // Let standby fade naturally instead of changing the light to black in one frame.
    if(zone.mode!=='off'){
     const blend=1-Math.exp(-dt*5),palette=THERMAL_PALETTE[zone.mode];
     colors[i].lerp(targets[i].set(palette.glow),blend);
     if(Math.abs(colors[i].r-targets[i].r)+Math.abs(colors[i].g-targets[i].g)+Math.abs(colors[i].b-targets[i].b)<.0001)colors[i].copy(targets[i]);else settled=false;
     highlights[i].lerp(targets[i].set(palette.highlight),blend);
     if(Math.abs(highlights[i].r-targets[i].r)+Math.abs(highlights[i].g-targets[i].g)+Math.abs(highlights[i].b-targets[i].b)<.0001)highlights[i].copy(targets[i]);else settled=false;
    }
   }
  },
  snapshot(){return {strength:uniforms.thermalStrength.value.toArray(),phase:uniforms.thermalPhase.value.toArray(),visibility:uniforms.thermalVisibility.value,colors:colors.map(color=>color.getHexString())};},
 };
}
