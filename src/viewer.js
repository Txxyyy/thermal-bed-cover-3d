import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {createBedCover,HUB_POSITION,HUB_YAW} from './model.js';
import {useManualShadowComparison,patchShadowMaterials} from './shadow-compat.js';

// The renderer owns no page controls. Both demo pages and the embedded entry use this API.
export async function createViewer(viewport,{initialState,initialCamera='overview',azimuth=null,signal,onCamera=()=>{},onError=()=>{}}={}){
 let renderer,controls,observer,environment,scene,bed,camera,frame=0,disposed=false,previous=null,settleUntil=0,frames=0;
 const manualShadows=useManualShadowComparison();
 const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
 const state={ready:false,paused:reducedMotion,cutaway:false,camera:'overview',visible:true,error:null};
 let transition=null,lastAspect=0;
 const cleanups=[];
 const listen=(target,type,fn)=>{target.addEventListener(type,fn);cleanups.push(()=>target.removeEventListener(type,fn));};
 function invalidate(){settleUntil=performance.now()+2400;schedule();}
 function schedule(){if(!disposed&&!state.error&&state.visible&&!document.hidden&&!frame)frame=requestAnimationFrame(draw);}
 function draw(now){
  frame=0;if(disposed||state.error||!state.visible||document.hidden)return;
  try {
  const dt=previous===null?0:Math.max(0,Math.min((now-previous)/1000,.05));previous=now;
  bed.update(dt);
  if(transition){const factor=1-Math.exp(-dt*6);camera.position.lerp(transition.position,factor);controls.target.lerp(transition.target,factor);if(camera.position.distanceTo(transition.position)<.003)transition=null;}
  controls.update(dt);renderer.render(scene,camera);frames++;
  if(transition||controls.autoRotate||bed.isAnimating()||now<settleUntil)schedule();else previous=null;
  }catch(error){state.ready=false;state.error=error.message;cancelAnimationFrame(frame);frame=0;onError({code:'RENDER_FAILED',message:error.message});}
 }
 function selectCamera(name,immediate=false){
  if(!presets[name])throw new Error('Unknown camera');
  const damping=controls.enableDamping;controls.autoRotate=false;controls.enableDamping=false;controls.update(0);controls.enableDamping=damping;
  state.camera=name;bed.setFocusHub(name==='hub');const preset=presets[name],pos=preset.position.clone();
  if(name==='overview'&&viewport.clientWidth/viewport.clientHeight<1.05)pos.sub(preset.target).multiplyScalar(1.30).add(preset.target);
  if(immediate||reducedMotion){camera.position.copy(pos);controls.target.copy(preset.target);controls.update();transition=null;}else transition={position:pos,target:preset.target.clone()};
  onCamera(name);invalidate();
 }
 function resize(){
  const {width,height}=viewport.getBoundingClientRect();if(width<1||height<1)return;
  renderer.setSize(width,height);camera.aspect=width/height;camera.updateProjectionMatrix();
  if(Math.abs(camera.aspect-lastAspect)>.3&&state.camera==='overview')selectCamera('overview',true);
  lastAspect=camera.aspect;invalidate();
 }
 function dispose(){
  if(disposed)return;disposed=true;state.ready=false;cancelAnimationFrame(frame);frame=0;
  observer?.disconnect();for(const cleanup of cleanups)cleanup();controls?.dispose();
  const geometries=new Set(),materials=new Set(),textures=new Set();
  scene?.traverse(object=>{object.shadow?.dispose();if(object.geometry)geometries.add(object.geometry);if(object.material)for(const material of Array.isArray(object.material)?object.material:[object.material])materials.add(material);});
  for(const material of materials){for(const value of Object.values(material))if(value?.isTexture)textures.add(value);material.dispose();}
  for(const texture of textures)texture.dispose();for(const geometry of geometries)geometry.dispose();environment?.dispose();renderer?.dispose();renderer?.domElement.remove();
 }
 let presets;
 try {
 renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});renderer.debug.onShaderError=()=>{throw new Error('Shader compilation failed');};renderer.setPixelRatio(Math.min(devicePixelRatio,matchMedia('(max-width: 760px)').matches?1.5:2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=manualShadows?THREE.BasicShadowMap:THREE.PCFShadowMap;
 renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;renderer.setClearColor(0x000000,0);viewport.append(renderer.domElement);
 renderer.domElement.setAttribute('aria-label','炭灰床笠、床垫与真实 CAD 主机的三维模型');renderer.domElement.setAttribute('role','img');
 scene=new THREE.Scene();
 camera=new THREE.PerspectiveCamera(34,1,.02,60);
 controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.07;controls.enablePan=false;controls.minDistance=.42;controls.maxDistance=8;controls.maxPolarAngle=Math.PI/2.02;controls.autoRotateSpeed=.45;
 const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment();environment=pmrem.fromScene(room,.04).texture;scene.environment=environment;scene.environmentIntensity=.65;room.dispose();pmrem.dispose();
 scene.add(new THREE.HemisphereLight(0xf7f4e9,0x697b78,1.25));
 const key=new THREE.DirectionalLight(0xfff3df,2.8);key.position.set(-3,5,3);key.castShadow=true;key.shadow.mapSize.set(2048,2048);key.shadow.camera.left=-3;key.shadow.camera.right=3;key.shadow.camera.top=3;key.shadow.camera.bottom=-3;key.shadow.camera.near=.5;key.shadow.camera.far=12;key.shadow.bias=-.00015;key.shadow.normalBias=.012;key.shadow.radius=4;scene.add(key);
 const fill=new THREE.DirectionalLight(0xdbedff,1.1);fill.position.set(3,2,-2);scene.add(fill);
 const floor=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.ShadowMaterial({opacity:.13}));floor.rotation.x=-Math.PI/2;floor.position.y=-.003;floor.receiveShadow=true;scene.add(floor);
 bed=await createBedCover();scene.add(bed.group);bed.setPaused(state.paused);
 if(signal?.aborted){scene.add(bed.group);throw new DOMException("Viewer creation cancelled","AbortError");}
 if(initialState)bed.applyDeviceState(initialState);
 if(manualShadows)patchShadowMaterials(scene);
 const hubView=offset=>offset.applyAxisAngle(new THREE.Vector3(0,1,0),HUB_YAW).add(HUB_POSITION);
 presets={overview:{position:new THREE.Vector3(2.96,2.68,3.8),target:new THREE.Vector3(.32,.23,-.02)},detail:{position:new THREE.Vector3(1.12,.91,1.84),target:new THREE.Vector3(.4,.33,.76)},hub:{position:hubView(new THREE.Vector3(-.86,.56,.65)),target:HUB_POSITION.clone().add(new THREE.Vector3(0,.19,0))}};

 selectCamera(initialCamera,true);
 if(azimuth!==null&&state.camera==='hub'){
  const angle=Number(azimuth)*Math.PI/180;camera.position.copy(hubView(new THREE.Vector3(Math.sin(angle)*1.08,.39,Math.cos(angle)*1.08)));controls.target.copy(HUB_POSITION).add(new THREE.Vector3(0,.18,0));controls.update();
 }
 listen(controls,'start',()=>{transition=null;invalidate();});listen(controls,'change',schedule);listen(controls,'end',invalidate);
 listen(renderer.domElement,'webglcontextlost',event=>{event.preventDefault();state.ready=false;state.error='WebGL context lost';cancelAnimationFrame(frame);frame=0;onError({code:'CONTEXT_LOST',message:state.error});});
 listen(document,'visibilitychange',()=>{previous=null;if(document.hidden){cancelAnimationFrame(frame);frame=0;}else invalidate();});
 observer=new ResizeObserver(resize);observer.observe(viewport);resize();
 // ready means an actual first render has completed, not merely HTML onPageFinished.
 bed.update(0);renderer.render(scene,camera);frames++;state.ready=true;invalidate();
 const change=fn=>(...args)=>{if(disposed||state.error)throw new Error('Viewer unavailable');const result=fn(...args);invalidate();return result;};
 return {
  selectCamera:change(selectCamera),
  applyState:change(value=>bed.applyDeviceState(value)),
  setZoneMode:change((...args)=>bed.setZoneMode(...args)),setZoneTemperature:change((...args)=>bed.setZoneTemperature(...args)),
  setXray:change(value=>{state.cutaway=value;bed.setXray(value);if(value&&state.camera==='hub')selectCamera('overview');}),
  setPaused:change(value=>{state.paused=value;bed.setPaused(value);}),setGlow:change(value=>bed.setGlow(value)),setCMF:change(value=>bed.setCMF(value)),
  setAutoRotate:change(value=>{controls.autoRotate=value;transition=null;}),
  setVisible(value){state.visible=value;previous=null;if(!value){cancelAnimationFrame(frame);frame=0;}else invalidate();},
  getState:()=>bed.getState(),
  snapshot:()=>({...state,...bed.getState(),disposed,frames,shadowSampling:manualShadows?'manual-pcf':'hardware-pcf',cameraPosition:camera.position.toArray(),render:{calls:renderer.info.render.calls,triangles:renderer.info.render.triangles}}),
  dispose,
 };
 } catch(error){dispose();throw error;}
}
