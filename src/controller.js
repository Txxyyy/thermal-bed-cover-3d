import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// The mobile exporter injects all assets; normal development keeps separate local files.
const inlineAssets=typeof __INLINE_ASSETS__==='object'?__INLINE_ASSETS__:{};
const assetURL=name=>inlineAssets[name]??`${import.meta.env.BASE_URL}${name}`;
async function loadCAD(){
 const loader=new GLTFLoader(),embedded=inlineAssets['models/controller.glb'];
 if(!embedded)return loader.loadAsync(assetURL('models/controller.glb'));
 const bytes=Uint8Array.from(atob(embedded.split(',')[1]),char=>char.charCodeAt(0));
 return loader.parseAsync(bytes.buffer,'');
}
function capsuleU(x,z){
 const radius=.0835,half=.1064,perimeter=4*half+2*Math.PI*radius;
 let arc;
 if(x>half)arc=2*half+radius*(Math.PI/2-Math.atan2(z,x-half));
 else if(x< -half){let angle=Math.atan2(z,x+half);if(angle<0)angle+=Math.PI*2;arc=4*half+Math.PI*radius+radius*(Math.PI*1.5-angle);}
 else arc=z>=0?x+half:3*half+Math.PI*radius-x;
 // Put the UV seam in the rear grille gap, never across the visible front textile panel.
 return arc>perimeter/2?arc-perimeter:arc;
}
function wordmark(){
 const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=256;
 const ctx=canvas.getContext('2d');ctx.fillStyle='#a1a7a9';ctx.font='150px Georgia';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('DeRUCCI',512,133);
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;return texture;
}
function wordmarkGeometry(fabricMeshes){
 const geometry=new THREE.PlaneGeometry(.056,.014,24,1),positions=geometry.attributes.position,normals=geometry.attributes.normal;
 const ray=new THREE.Raycaster();
 // The front is the narrow -X end above the status LED; center the wordmark on that axis.
 for(let i=0;i<positions.count;i++){
  const angle=Math.PI-positions.getX(i)/.0835;
  const outward=new THREE.Vector3(Math.cos(angle),0,Math.sin(angle)),center=new THREE.Vector3(-.1064,.254+positions.getY(i),0);
  ray.set(center.clone().addScaledVector(outward,.16),outward.clone().negate());
  const hit=ray.intersectObjects(fabricMeshes,false)[0];
  const point=hit?hit.point.clone().addScaledVector(outward,.0006):center.addScaledVector(outward,.0842);
  positions.setXYZ(i,point.x,point.y,point.z);
  normals.setXYZ(i,Math.cos(angle),0,Math.sin(angle));
 }
 geometry.computeBoundingBox();
 return geometry;
}
function haloTexture(){
 const c=document.createElement('canvas');c.width=c.height=128;const ctx=c.getContext('2d');const gradient=ctx.createRadialGradient(64,64,0,64,64,62);
 gradient.addColorStop(0,'rgba(127,176,255,.55)');gradient.addColorStop(.28,'rgba(68,124,239,.20)');gradient.addColorStop(1,'rgba(68,124,239,0)');ctx.fillStyle=gradient;ctx.fillRect(0,0,128,128);
 const map=new THREE.CanvasTexture(c);map.colorSpace=THREE.SRGBColorSpace;return map;
}
export async function createController({hoseRadius=.013}={}){
 const loader=new THREE.TextureLoader();
 const [cad,albedo,normal,roughness]=await Promise.all([loadCAD(),...['albedo','normal','roughness'].map(kind=>loader.loadAsync(assetURL(`textures/controller-fabric-${kind}.png`)))]);
 for(const texture of [albedo,normal,roughness]){texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.anisotropy=8;texture.needsUpdate=true;}
 albedo.colorSpace=THREE.SRGBColorSpace;normal.colorSpace=roughness.colorSpace=THREE.NoColorSpace;
 const cloth=new THREE.MeshPhysicalMaterial({color:'#e7e9eb',map:albedo,normalMap:normal,normalScale:new THREE.Vector2(.32,.32),roughnessMap:roughness,roughness:1,metalness:0,sheen:.12,sheenColor:new THREE.Color('#5b636b'),sheenRoughness:.95});
 const shell=new THREE.MeshPhysicalMaterial({color:'#292e32',metalness:.78,roughness:.38,envMapIntensity:.8,clearcoat:.12,clearcoatRoughness:.38});
 const lid=new THREE.MeshPhysicalMaterial({color:'#171a1c',metalness:.38,roughness:.42});
 const grille=new THREE.MeshStandardMaterial({color:'#101417',metalness:.18,roughness:.58});
 const rubber=new THREE.MeshStandardMaterial({color:'#111417',roughness:.95});
 const indicator=new THREE.MeshStandardMaterial({color:'#c5d8ff',emissive:'#6b9eff',emissiveIntensity:2.3,roughness:.35});
 const root=cad.scene;root.name='controller-from-user-step';const originalMaterials=new Set();
 root.traverse(mesh=>{
  if(!mesh.isMesh)return;
  for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material])originalMaterials.add(material);
  const role=mesh.userData.materialRole;
  mesh.material=role==='textile'?cloth:role==='grille'?grille:role==='rubber'?rubber:role==='indicator'?indicator:mesh.name==='cad_38_shell'?lid:shell;
  if(role==='textile'){
   const pos=mesh.geometry.attributes.position,uv=[];
   // Arc-length mapping around the enclosure avoids planar UV compression at its rounded ends.
   for(let i=0;i<pos.count;i++)uv.push(capsuleU(pos.getX(i),pos.getZ(i))/.065,pos.getY(i)/.076);
   mesh.geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  }
  if(mesh.name==='cad_41_shell')mesh.visible=false;
  mesh.castShadow=true;mesh.receiveShadow=true;
 });
 for(const material of originalMaterials)material.dispose();
 const interior=new THREE.Mesh(new RoundedBoxGeometry(.31,.27,.052,2,.008),new THREE.MeshStandardMaterial({color:'#06090b',roughness:1}));interior.name='interior-shadow-proxy';interior.position.y=.19;root.add(interior);
 root.updateMatrixWorld(true);const fabricMeshes=[];root.traverse(mesh=>{if(mesh.isMesh&&mesh.userData.materialRole==='textile')fabricMeshes.push(mesh);});
 const logo=new THREE.Mesh(wordmarkGeometry(fabricMeshes),new THREE.MeshStandardMaterial({map:wordmark(),transparent:true,depthWrite:false,roughness:.8,metalness:.15}));logo.name='reference-wordmark';root.add(logo);
 // The user identified the +X grille/recess end as the rear. Seat the concept fitting on its CAD wall.
 const rearRay=new THREE.Raycaster(new THREE.Vector3(.5,.112,0),new THREE.Vector3(-1,0,0));
 const rearHit=rearRay.intersectObject(root.getObjectByName('cad_32_grille'),false)[0];
 if(!rearHit)throw new Error('Controller rear connection recess could not be located');
 const rearConnection=new THREE.Group();rearConnection.name='rear-water-connection';root.add(rearConnection);
 const fittingMat=new THREE.MeshStandardMaterial({color:'#171e22',roughness:.55,metalness:.18});
 const plate=new THREE.Mesh(new RoundedBoxGeometry(.008,.064,.076,3,.004),fittingMat);
 plate.name='rear-connection-seat';plate.position.copy(rearHit.point).add(new THREE.Vector3(.003,0,0));rearConnection.add(plate);
 for(const [name,radius,depth,offset] of [['rear-socket-flange',hoseRadius+.007,.012,.011],['rear-hose-collar',hoseRadius+.002,.04,.032]]){
  const part=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,depth,32),fittingMat);
  part.name=name;part.rotation.z=-Math.PI/2;part.position.copy(rearHit.point).add(new THREE.Vector3(offset,0,0));part.castShadow=part.receiveShadow=true;rearConnection.add(part);
 }
 const hoseAnchor=rearHit.point.clone().add(new THREE.Vector3(.05,0,0));
 const glow=new THREE.Mesh(new THREE.PlaneGeometry(.082,.055),new THREE.MeshBasicMaterial({map:haloTexture(),transparent:true,depthWrite:false,opacity:.6}));glow.name='status-light-floor-spill';glow.rotation.x=-Math.PI/2;glow.position.set(-.2,.0007,.001);root.add(glow);
 root.userData.reference='controller-dark-id.pdf / B';
 return {group:root,hoseAnchor,setCMF(value){shell.metalness=value==='A'?.04:.78;shell.roughness=value==='A'?.62:.38;shell.clearcoat=value==='A'?0:.12;shell.color.set(value==='A'?'#22272a':'#292e32');},setMode(value){indicator.emissiveIntensity=value==='off'?.05:2.3;glow.visible=value!=='off';},getPlacementState(){
  const logoCenter=logo.geometry.boundingBox.getCenter(new THREE.Vector3()),indicatorCenter=new THREE.Box3().setFromBufferAttribute(root.getObjectByName('cad_3_indicator').geometry.attributes.position).getCenter(new THREE.Vector3());
  return {logoCenter:logoCenter.toArray(),indicatorCenter:indicatorCenter.toArray(),rearSeat:rearHit.point.toArray(),hoseAnchor:hoseAnchor.toArray()};
 },getMaterialState(){return {shellMetalness:shell.metalness,shellRoughness:shell.roughness,clothNormalMap:!!cloth.normalMap,clothRoughnessMap:!!cloth.roughnessMap,indicatorIntensity:indicator.emissiveIntensity};}};
}
