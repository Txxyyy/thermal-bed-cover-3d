import * as THREE from 'three';
import {MATTRESS,topGeometry,skirtGeometry} from '../src/model.js';

// These are display-model tolerances for a visually closed join, not product dimensions.
export function checkCoverGeometry(check){
 const top=topGeometry(),skirt=skirtGeometry(top);
 try {
  const surface=top.getAttribute('position'),side=skirt.getAttribute('position');
  const nx=160,nz=180,levels=24,n=side.count/(levels+1)-1;
  const border=[];
  for(let i=nx;i>=0;i--)border.push(new THREE.Vector3().fromBufferAttribute(surface,nz*(nx+1)+i));
  for(let j=nz-1;j>=0;j--)border.push(new THREE.Vector3().fromBufferAttribute(surface,j*(nx+1)));
  for(let i=1;i<=nx;i++)border.push(new THREE.Vector3().fromBufferAttribute(surface,i));
  for(let j=1;j<nz;j++)border.push(new THREE.Vector3().fromBufferAttribute(surface,j*(nx+1)+nx));
  const sideBorder=Array.from({length:n},(_,i)=>new THREE.Vector3().fromBufferAttribute(side,i));
  const distanceToLoop=(point,loop)=>{
   let min=Infinity;
   for(let i=0;i<loop.length;i++){
    const start=loop[i],end=loop[(i+1)%loop.length],edge=end.clone().sub(start);
    const t=THREE.MathUtils.clamp(point.clone().sub(start).dot(edge)/edge.lengthSq(),0,1);
    min=Math.min(min,point.distanceTo(start.clone().addScaledVector(edge,t)));
   }
   return min;
  };
  const joinGap=Math.max(...border.map(point=>distanceToLoop(point,sideBorder)),...sideBorder.map(point=>distanceToLoop(point,border)));
  let loopGap=0,normalGap=0;
  const normals=skirt.getAttribute('normal');
  for(let j=0;j<=levels;j++){
   const first=new THREE.Vector3().fromBufferAttribute(side,j*(n+1));
   const last=new THREE.Vector3().fromBufferAttribute(side,j*(n+1)+n);
   loopGap=Math.max(loopGap,first.distanceTo(last));
   normalGap=Math.max(normalGap,new THREE.Vector3().fromBufferAttribute(normals,j*(n+1)).distanceTo(new THREE.Vector3().fromBufferAttribute(normals,j*(n+1)+n)));
  }
  const distanceToMattress=point=>{
   const qx=Math.abs(point.x)-(MATTRESS.width/2-MATTRESS.radius);
   const qy=Math.abs(point.y-MATTRESS.centerY)-(MATTRESS.height/2-MATTRESS.radius);
   const qz=Math.abs(point.z)-(MATTRESS.length/2-MATTRESS.radius);
   return Math.hypot(Math.max(qx,0),Math.max(qy,0),Math.max(qz,0))+Math.min(Math.max(qx,qy,qz),0)-MATTRESS.radius;
  };
  let mattressClearance=Infinity;
  for(let i=0;i<side.count;i++)mattressClearance=Math.min(mattressClearance,distanceToMattress(new THREE.Vector3().fromBufferAttribute(side,i)));
  const index=skirt.getIndex();
  for(let i=0;i<index.count;i+=3){
   const center=new THREE.Vector3();
   for(let j=0;j<3;j++)center.add(new THREE.Vector3().fromBufferAttribute(side,index.getX(i+j)));
   mattressClearance=Math.min(mattressClearance,distanceToMattress(center.multiplyScalar(1/3)));
  }
  check(`Cover top and skirt join without gaps (max ${joinGap.toFixed(6)} m)`,joinGap<.00001);
  check(`Skirt closes at every height (max ${loopGap.toFixed(6)} m)`,loopGap<.000001);
  check(`Skirt join normals are continuous (max ${normalGap.toFixed(6)})`,normalGap<.000001);
  check(`Skirt clears rounded mattress (min ${mattressClearance.toFixed(6)} m)`,mattressClearance>.002);
 } finally {top.dispose();skirt.dispose();}
}
