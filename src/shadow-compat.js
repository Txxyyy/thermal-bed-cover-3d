import * as THREE from 'three';

// WKWebView on the tested iOS simulator miscompares the hardware depth sampler.
// Keep the same five Vogel samples and bilinear PCF, but compare raw depth in GLSL.
export function useManualShadowComparison(){
 return /iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
}
export function patchShadowMaterials(scene){
 const chunk=THREE.ShaderChunk.shadowmap_pars_fragment;
 const pcfStart=chunk.indexOf('float getShadow( sampler2DShadow');
 const pcfEnd=chunk.indexOf('\n\t#elif defined( SHADOWMAP_TYPE_VSM )',pcfStart);
 const vsmStart=chunk.indexOf('float getShadow( sampler2D shadowMap',pcfEnd);
 const basicStart=chunk.indexOf('float getShadow( sampler2D shadowMap',vsmStart+1);
 const helperStart=chunk.indexOf('float interleavedGradientNoise');
 const helperEnd=chunk.indexOf('\n\t#endif',helperStart);
 const basicEnd=chunk.indexOf('\n\t#endif',chunk.indexOf('return mix( 1.0, shadow, shadowIntensity );',basicStart));
 if([pcfStart,pcfEnd,vsmStart,basicStart,basicEnd,helperStart,helperEnd].some(index=>index<0))throw new Error('Shadow compatibility shader needs updating for this Three.js version');
 const compare=`
 float thermalShadowCompare(sampler2D depthMap, vec3 coordinate) {
  vec2 size=vec2(textureSize(depthMap,0));
  vec2 pixel=coordinate.xy*size-0.5;
  vec2 weight=fract(pixel),origin=(floor(pixel)+0.5)/size,stepUV=1.0/size;
  float a=step(coordinate.z,texture2D(depthMap,origin).r);
  float b=step(coordinate.z,texture2D(depthMap,origin+vec2(stepUV.x,0.0)).r);
  float c=step(coordinate.z,texture2D(depthMap,origin+vec2(0.0,stepUV.y)).r);
  float d=step(coordinate.z,texture2D(depthMap,origin+stepUV).r);
  return mix(mix(a,b,weight.x),mix(c,d,weight.x),weight.y);
 }
 `;
 const softwarePCF=chunk.slice(helperStart,helperEnd)+compare+chunk.slice(pcfStart,pcfEnd).replace('sampler2DShadow shadowMap','sampler2D shadowMap').replaceAll('texture( shadowMap,','thermalShadowCompare( shadowMap,');
 const patched=chunk.slice(0,basicStart)+softwarePCF+chunk.slice(basicEnd);
 const materials=new Set();scene.traverse(object=>{if(object.material)for(const material of Array.isArray(object.material)?object.material:[object.material])materials.add(material);});
 for(const material of materials){
  const original=material.onBeforeCompile,cacheKey=material.customProgramCacheKey.bind(material);
  material.onBeforeCompile=function(shader,renderer){original.call(this,shader,renderer);shader.fragmentShader=shader.fragmentShader.replace('#include <shadowmap_pars_fragment>',patched);};
  material.customProgramCacheKey=()=>`${cacheKey()}-manual-pcf-v1`;
 }
}
