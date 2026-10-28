import {normalizeDeviceState,deviceVisual} from './device-state.js';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { createController } from './controller.js';
import { textile, labelTexture, quiltTexture } from './materials.js';
import {attachThermalGlow} from './thermal-glow.js';
import {THERMAL_DEMO,THERMAL_PALETTE,ZONE_IDS,thermalState} from './thermal.js';

// Mattress and cover dimensions are concept proportions, not manufacturing specifications.
export const dimensions={width:1.8,length:2,mattressHeight:.29};
export const MATTRESS={width:1.79,height:.29,length:1.99,centerY:.31,radius:.065};
export const HUB_POSITION=new THREE.Vector3(1.35,0,-.75);
export const HUB_YAW=Math.PI/2;
const HOSE_RADIUS=.013;
const V=(x,y,z)=>new THREE.Vector3(x,y,z);
function roundedOutline(w,d,r,y){
 const points=[];
 const corners=[[w/2-r,d/2-r,0],[-w/2+r,d/2-r,Math.PI/2],[-w/2+r,-d/2+r,Math.PI],[w/2-r,-d/2+r,Math.PI*1.5]];
 for(let c=0;c<4;c++){
   const [cx,cz,start]=corners[c];
   for(let i=0;i<16;i++){const a=start+i/16*Math.PI/2;points.push(V(cx+r*Math.cos(a),y,cz+r*Math.sin(a)));}
   const end=V(cx+r*Math.cos(start+Math.PI/2),y,cz+r*Math.sin(start+Math.PI/2));
   const [nx,nz,na]=corners[(c+1)%4],next=V(nx+r*Math.cos(na),y,nz+r*Math.sin(na));
   const steps=Math.ceil(end.distanceTo(next)/.025);
   for(let i=0;i<steps;i++)points.push(end.clone().lerp(next,i/steps));
 }
 return points;
}
export function topGeometry(){
 const nx=160,nz=180,positions=[],uv=[],indices=[];
 for(let j=0;j<=nz;j++)for(let i=0;i<=nx;i++){
   let x=(i/nx-.5)*1.824,z=(j/nz-.5)*2.024;
   const cx=Math.sign(x)*.81,cz=Math.sign(z)*.91;
   if(Math.abs(x)>.81&&Math.abs(z)>.91){const dx=x-cx,dz=z-cz,r=Math.max(Math.abs(dx),Math.abs(dz)),len=Math.hypot(dx,dz);x=cx+dx/len*r;z=cz+dz/len*r;}
   const edge=Math.max(Math.abs(x)/.912,Math.abs(z)/1.012);
   const distance=t=>Math.abs(((t%.22)+.22)% .22-.11);
   const seam=Math.exp(-Math.pow(distance(x+z)/.009,2))+Math.exp(-Math.pow(distance(x-z)/.009,2));
   const loft=.012*(1-Math.pow(edge,10));
   const cushion=.005*Math.pow(Math.sin(Math.PI*(x+z-.11)/.22)*Math.sin(Math.PI*(x-z-.11)/.22),2)*(1-Math.pow(edge,12));
   const height=.488+loft+cushion-.0008*seam-.009*Math.pow(edge,28);
   // The rounded border must meet the skirt at the same height, including at the corners.
   const qx=Math.abs(x)-.81,qz=Math.abs(z)-.91;
   const borderDistance=.102-(Math.hypot(Math.max(qx,0),Math.max(qz,0))+Math.min(Math.max(qx,qz),0));
   const y=THREE.MathUtils.lerp(.477,height,THREE.MathUtils.smoothstep(borderDistance,0,.08));
   positions.push(x,y,z);uv.push((x+.912)/1.824,(z+1.012)/2.024);
 }
 for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){const a=j*(nx+1)+i,b=a+1,c=a+nx+1,d=c+1;indices.push(a,c,b,b,c,d);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();return g;
}
function surfaceOutline(surface){
 const positions=surface.getAttribute('position'),nx=160,nz=180,outline=[];
 const add=(i,j)=>outline.push(new THREE.Vector3().fromBufferAttribute(positions,j*(nx+1)+i));
 for(let i=nx;i>=0;i--)add(i,nz);
 for(let j=nz-1;j>=0;j--)add(0,j);
 for(let i=1;i<=nx;i++)add(i,0);
 for(let j=1;j<nz;j++)add(nx,j);
 return outline;
}
export function skirtGeometry(surface){
 const outline=surfaceOutline(surface),p=[],uv=[],indices=[],levels=24,n=outline.length;
 const distances=[0];for(let i=1;i<n;i++)distances.push(distances[i-1]+outline[i].distanceTo(outline[i-1]));
 const perimeter=distances[n-1]+outline[n-1].distanceTo(outline[0]);
 for(let j=0;j<=levels;j++)for(let i=0;i<=n;i++){
   const k=i%n,o=outline[k],t=j/levels,phase=2*Math.PI*distances[k]/perimeter;
   // Gentle tension folds terminate at the tucked elastic hem.
   const wrinkle=(Math.sin(38*phase)+.4*Math.sin(61*phase))*.0009*Math.sin(t*Math.PI);
   const scale=1-.009*Math.pow(t,5)+wrinkle;
   p.push(o.x*scale,.477-t*.303+Math.sin(49*phase)*.0015*Math.sin(t*Math.PI),o.z*scale);
   uv.push(i/n,t);
 }
 for(let j=0;j<levels;j++)for(let i=0;i<n;i++){const a=j*(n+1)+i,b=a+1,c=a+n+1,d=c+1;indices.push(a,b,c,b,d,c);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();
 // UVs must wrap, while the duplicated join vertices need the same smooth normal.
 const normals=g.getAttribute('normal');
 for(let j=0;j<=levels;j++){
   const first=j*(n+1),last=first+n;
   const normal=new THREE.Vector3().fromBufferAttribute(normals,first).add(new THREE.Vector3().fromBufferAttribute(normals,last)).normalize();
   normals.setXYZ(first,normal.x,normal.y,normal.z);normals.setXYZ(last,normal.x,normal.y,normal.z);
 }
 return g;
}
function addBox(parent,name,w,h,d,position,material,r=.025){
 const mesh=new THREE.Mesh(new RoundedBoxGeometry(w,h,d,3,r),material);mesh.name=name;mesh.position.copy(position);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
}
function pipe(parent,curve,radius,material,segments=160){const mesh=new THREE.Mesh(new THREE.TubeGeometry(curve,segments,radius,8,false),material);mesh.castShadow=true;parent.add(mesh);return mesh;}
function seam(parent,w,d,y,color,radius=.0017){
 const points=roundedOutline(w,d,.10,y);
 const curve=new THREE.CatmullRomCurve3(points,true,'centripetal');
 pipe(parent,curve,radius,new THREE.MeshStandardMaterial({color,roughness:.88}),300);
}
function roundedPath(points,radius=.045){
 const path=new THREE.CurvePath();let current=points[0];
 for(let i=1;i<points.length-1;i++){
   const corner=points[i],before=points[i-1],after=points[i+1];
   const r=Math.min(radius,corner.distanceTo(before)*.45,corner.distanceTo(after)*.45);
   const entry=corner.clone().add(before.clone().sub(corner).normalize().multiplyScalar(r));
   const exit=corner.clone().add(after.clone().sub(corner).normalize().multiplyScalar(r));
   path.add(new THREE.LineCurve3(current,entry));path.add(new THREE.QuadraticBezierCurve3(entry,corner,exit));current=exit;
 }
 path.add(new THREE.LineCurve3(current,points.at(-1)));return path;
}
function circuitCurve(side){
 const x0=side===0?-.73:.09,x1=side===0?-.09:.73;
 const inlet=-.963,outlet=inlet+.028,portX=side===0?-.038:.038;
 const points=[V(portX,.464,inlet),V(x0,.464,inlet)];
 for(let row=0;row<12;row++){
   const z=-.78+row*.139,a=row%2===0?x0:x1,b=row%2===0?x1:x0;
   points.push(V(a,.464,z),V(b,.464,z));
 }
 const outside=side===0?-.85:.85;
 points.push(V(x0,.464,.875),V(outside,.464,.875),V(outside,.464,outlet),V(portX,.464,outlet));
 return roundedPath(points);
}
export async function createBedCover(){
 const group=new THREE.Group();group.name='thermal-cover-system';
 const mattressMat=textile('#c6c0b4',65,12);
 addBox(group,'mattress-under-fitted-cover',MATTRESS.width,MATTRESS.height,MATTRESS.length,V(0,MATTRESS.centerY,0),mattressMat,MATTRESS.radius);
 addBox(group,'upholstered-display-foundation',1.85,.10,2.05,V(0,.105,0),textile('#9b958b',60,12),.032);
 addBox(group,'recessed-base',1.62,.055,1.83,V(0,.038,0),new THREE.MeshStandardMaterial({color:'#2b2b28',roughness:.7}),.018);
 const topMaterial=textile('#424b4d',110,125);
 topMaterial.map.dispose();topMaterial.map=quiltTexture();
 topMaterial.transparent=true;
 const circuitCurves=[circuitCurve(0),circuitCurve(1)];
 const glow=attachThermalGlow(topMaterial,circuitCurves);
 const surface=new THREE.Mesh(topGeometry(),topMaterial);surface.name='quilted-knit-cover';surface.castShadow=true;surface.receiveShadow=true;group.add(surface);
 const skirtMat=textile('#323a3c',180,16);skirtMat.side=THREE.DoubleSide;
 const skirt=new THREE.Mesh(skirtGeometry(surface.geometry),skirtMat);skirt.name='fitted-elastic-skirt';skirt.castShadow=true;skirt.receiveShadow=true;group.add(skirt);
 seam(group,1.824,2.024,.478,'#535c5c',.0020);
 seam(group,1.817,2.017,.459,'#262f31',.0012);
 seam(group,1.808,2.008,.179,'#545b59',.0018);
 // Small fabric label, placed on the front skirt rather than over the sleep surface.
 const tag=addBox(group,'woven-label',.19,.057,.004,V(.55,.326,1.012),textile('#242e30',12,5),.003);
 const label=new THREE.Mesh(new THREE.PlaneGeometry(.18,.045),new THREE.MeshBasicMaterial({map:labelTexture('DeRUCCI'),transparent:true,depthWrite:false}));label.name='cover-brand-label';label.position.set(.55,.326,1.015);group.add(label);
 // The seam border remains visible during the cutaway.
 const inner=new THREE.Group();inner.name='concept-water-circuits';group.add(inner);inner.visible=false;
 const underlay=addBox(inner,'water-layer-carrier',1.76,.012,1.94,V(0,.455,0),new THREE.MeshStandardMaterial({color:'#25373b',roughness:.83}),.015);
 const zones={left:{...thermalState(THERMAL_DEMO.coolPreset),phase:0},right:{...thermalState(THERMAL_DEMO.warmPreset),phase:0}};
 const waterMats=ZONE_IDS.map(()=>new THREE.MeshStandardMaterial({emissiveIntensity:.45,roughness:.34,metalness:.18}));
 const flowMats=ZONE_IDS.map(()=>new THREE.MeshBasicMaterial());
 const paths=[];
 function addFlow(curve,parent,count,radius,speed,side){
   const particles=new THREE.InstancedMesh(new THREE.SphereGeometry(radius,6,5),flowMats[side],count);particles.frustumCulled=false;particles.name=`moving-water-${ZONE_IDS[side]}`;parent.add(particles);paths.push({curve,particles,count,speed,zone:ZONE_IDS[side]});
 }
 circuitCurves.forEach((curve,side)=>{pipe(inner,curve,.0042,waterMats[side],420);addFlow(curve,inner,50,.006,.019,side);});
 const controller=await createController({hoseRadius:HOSE_RADIUS});
 const hubGroup=controller.group;hubGroup.position.copy(HUB_POSITION);hubGroup.rotation.y=HUB_YAW;group.add(hubGroup);hubGroup.updateMatrixWorld(true);
 const hoseEnd=hubGroup.localToWorld(controller.hoseAnchor.clone());
 const rearOutward=V(1,0,0).transformDirection(hubGroup.matrixWorld);
 const hosePoints=[V(0,.423,-1.034),V(0,.423,-1.105),V(.13,.24,-1.19),V(.4,.10,-1.23),V(.89,.067,-1.24),V(1.29,.089,-1.20),hoseEnd.clone().addScaledVector(rearOutward,.10),hoseEnd.clone().addScaledVector(rearOutward,.05),hoseEnd];
 const hoseCurve=new THREE.CatmullRomCurve3(hosePoints);
 const hoseMat=textile('#252b2c',2,100);hoseMat.transparent=true;
 const hose=pipe(group,hoseCurve,HOSE_RADIUS,hoseMat,100);hose.name='braided-connection-sleeve';
 const hoseInside=new THREE.Group();group.add(hoseInside);hoseInside.visible=false;
 const hoseFrames=hoseCurve.computeFrenetFrames(100,false),manifoldLinks=[],hoseCoreCurves=[];
 // Two isolated supply/return pairs share one concept braided sleeve; no thermal mixing.
 for(let side=0;side<2;side++)for(const direction of [1,-1]){
   // Follow the sleeve's local cross-section so rotating the hub cannot push tubes outside it.
   const pts=Array.from({length:101},(_,i)=>hoseCurve.getPointAt(i/100).addScaledVector(hoseFrames.normals[i],side===0?-.0045:.0045).addScaledVector(hoseFrames.binormals[i],direction*.0035));
   const bedInlet=pts[0].clone();if(direction>0)pts.reverse();
   const curve=new THREE.CatmullRomCurve3(pts);hoseCoreCurves.push(curve);pipe(hoseInside,curve,.0026,waterMats[side],100);addFlow(curve,hoseInside,9,.0032,.21,side);
   const circuitPort=circuitCurves[side].getPoint(direction>0?0:1);
   const manifoldPoints=[circuitPort,V(circuitPort.x,.457,-.985),bedInlet];
   if(direction>0)manifoldPoints.reverse();
   const manifold=new THREE.CatmullRomCurve3(manifoldPoints);
   manifoldLinks.push({side,direction,curve:manifold,hose:curve});
   pipe(inner,manifold,.0026,waterMats[side],24);addFlow(manifold,inner,3,.0032,.8,side);
 }
 const connectorMat=new THREE.MeshStandardMaterial({color:'#171f20',roughness:.45,metalness:.15});
 // The bed fitting remains a concept; the controller end seats in the user-confirmed rear recess.
 const connector=new THREE.Mesh(new THREE.CylinderGeometry(.015,.018,.046,24),connectorMat);connector.position.copy(hosePoints[0]).add(V(0,0,.013));connector.quaternion.setFromUnitVectors(V(0,1,0),V(0,0,-1));connector.name='concept-water-connector';connector.castShadow=true;group.add(connector);
 const cadBounds=new THREE.Box3(V(-.189894,0,-.0835),V(.189894,.371345,.0835));
 const hoseSamples=hoseCurve.getSpacedPoints(400);
 const hoseClearance=Math.min(...hoseSamples.map(point=>cadBounds.distanceToPoint(hubGroup.worldToLocal(point.clone()))-HOSE_RADIUS));
 const bedBounds=new THREE.Box3(V(-.925,0,-1.025),V(.925,.51,1.025));
 // The short first section intentionally seats in the bed fitting; the free hose must clear the bed.
 const bedClearance=Math.min(...hoseSamples.slice(12).map(point=>bedBounds.distanceToPoint(point)-HOSE_RADIUS));
 const coreClearance=HOSE_RADIUS-Math.max(...hoseCoreCurves.flatMap(curve=>curve.getSpacedPoints(160).map(point=>Math.min(...hoseSamples.map(center=>point.distanceTo(center)))+.0032)));
 const manifoldGap=Math.max(...manifoldLinks.map(({side,direction,curve,hose})=>direction>0?Math.max(curve.getPoint(0).distanceTo(hose.getPoint(1)),curve.getPoint(1).distanceTo(circuitCurves[side].getPoint(0))):Math.max(curve.getPoint(0).distanceTo(circuitCurves[side].getPoint(1)),curve.getPoint(1).distanceTo(hose.getPoint(0)))));
 const hubInverse=hubGroup.matrixWorld.clone().invert();
 let hubOnly=false,shadowRevision=0;
 const dummy=new THREE.Object3D();
 let cutaway=false,mix=0,paused=false,cmf='B',glowEnabled=true;
 function updateZone(id,derive=true){
   const side=ZONE_IDS.indexOf(id);if(side===-1)throw new Error(`Unknown zone: ${id}`);
   const zone=zones[id];if(derive)Object.assign(zone,thermalState(zone.temperature,zone.enabled));
   const p=THERMAL_PALETTE[zone.mode];waterMats[side].color.set(p.water);waterMats[side].emissive.set(p.emissive);flowMats[side].color.set(p.particle);
   controller.setMode(ZONE_IDS.some(key=>zones[key].enabled)?'cool':'off');
   for(const path of paths)if(path.zone===id)path.particles.visible=zone.enabled;
 }
 function setZoneTemperature(id,value){if(!zones[id])throw new Error(`Unknown zone: ${id}`);zones[id].temperature=thermalState(value).temperature;updateZone(id);}
 function setZoneMode(id,value){
   if(!zones[id]||!THERMAL_PALETTE[value])throw new Error('Unknown zone or mode');
   const zone=zones[id];zone.enabled=value!=='off';
   if(value==='cool'&&zone.temperature>=THERMAL_DEMO.neutral)zone.temperature=THERMAL_DEMO.coolPreset;
   if(value==='warm'&&zone.temperature<=THERMAL_DEMO.neutral)zone.temperature=THERMAL_DEMO.warmPreset;
   updateZone(id);
 }
 function applyDeviceState(input){
   const value=normalizeDeviceState(input);
   for(const id of ZONE_IDS)Object.assign(zones[id],deviceVisual(value.zones[id]));
   for(const id of ZONE_IDS)updateZone(id,false);
 }
 function update(dt){
   mix=THREE.MathUtils.damp(mix,cutaway?1:0,6,dt);
   if(Math.abs(mix-(cutaway?1:0))<.0001)mix=cutaway?1:0;
   const showInner=!hubOnly&&mix>.01;
   if(inner.visible!==showInner||hoseInside.visible!==showInner)shadowRevision++;
   inner.visible=hoseInside.visible=showInner;surface.material.opacity=1-mix*.91;surface.material.depthWrite=mix<.02;hoseMat.opacity=1-mix*.86;hoseMat.depthWrite=mix<.02;
   for(const zone of Object.values(zones))if(!paused&&zone.enabled)zone.phase+=dt;
   for(const path of paths){const {curve,particles,count,speed,zone}=path;if(!inner.visible||!particles.visible||path.lastPhase===zones[zone].phase)continue;path.lastPhase=zones[zone].phase;for(let i=0;i<count;i++){dummy.position.copy(curve.getPointAt((zones[zone].phase*speed+i/count)%1));dummy.updateMatrix();particles.setMatrixAt(i,dummy.matrix);}particles.instanceMatrix.needsUpdate=true;}
   glow.update(zones,dt,glowEnabled&&!hubOnly?1-mix:0);
 }
 ZONE_IDS.forEach(updateZone);update(0);
 return {group,hubGroup,surface,applyDeviceState,
 isAnimating(){
   const waterMoving=inner.visible&&ZONE_IDS.some(id=>zones[id].enabled);
   const glowMoving=glowEnabled&&mix<1&&ZONE_IDS.some(id=>zones[id].enabled&&zones[id].intensity>0);
   return !glow.isSettled()||mix!==(cutaway?1:0)||(!hubOnly&&!paused&&(waterMoving||glowMoving));
 },
 getShadowRevision:()=>shadowRevision,
 setZoneMode,setZoneTemperature,update,setXray(value){cutaway=Boolean(value);},setGlow(value){glowEnabled=Boolean(value);},setPaused(value){paused=Boolean(value);},setFocusHub(value){if(hubOnly===value)return;hubOnly=value;shadowRevision++;for(const child of group.children)child.visible=!value||child===hubGroup;},setCMF(value){cmf=value;controller.setCMF(value);},getState(){return {
   zones:Object.fromEntries(ZONE_IDS.map((id,side)=>[id,{...zones[id],waterColor:waterMats[side].color.getHexString(),visibleParticles:paths.filter(path=>path.zone===id&&path.particles.visible).reduce((n,path)=>n+path.count,0),particlePosition:circuitCurves[side].getPointAt((zones[id].phase*.019)%1).toArray()}])),
   cutaway,mix,paused,cmf,hubOnly,glowEnabled,glow:glow.snapshot(),controllerMaterial:controller.getMaterialState(),controllerPlacement:{...controller.getPlacementState(),position:hubGroup.position.toArray(),frontDirection:V(-1,0,0).transformDirection(hubGroup.matrixWorld).toArray(),hoseEnd:hoseEnd.toArray(),hoseEndLocal:hubGroup.worldToLocal(hoseEnd.clone()).toArray(),hoseEndDirectionLocal:hoseCurve.getTangentAt(1).transformDirection(hubInverse).toArray(),hoseClearance},bedConnection:{position:hoseCurve.getPoint(0).toArray(),outward:hoseCurve.getTangent(0).toArray(),radius:hose.geometry.parameters.radius,bedClearance,coreClearance,manifoldGap,circuitPorts:circuitCurves.map(curve=>[curve.getPoint(0).toArray(),curve.getPoint(1).toArray()])},coverLabel:{text:label.material.map.userData.text,position:label.position.toArray()},cadMeshes:42,
 };}};
}
