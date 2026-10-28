import * as THREE from 'three';

export const THERMAL_ROUTE_FIELD={width:1.824,length:2.024,resolution:512,reach:.24,samples:360};

// Bake proximity and arc length from the same curves used by the visible water layer.
// RG stores the left route, BA the right; linear byte textures work without float extensions.
export function createThermalRouteField(curves){
 const {width,length,resolution:size,reach,samples}=THERMAL_ROUTE_FIELD;
 const data=new Uint8Array(size*size*4);
 const xs=Float64Array.from({length:size},(_,col)=>((col+.5)/size-.5)*width);
 const zs=Float64Array.from({length:size},(_,row)=>((row+.5)/size-.5)*length);
 curves.forEach((curve,side)=>{
  const distances=new Float32Array(size*size).fill(reach*reach),progress=new Float32Array(size*size);
  const points=Array.from({length:samples+1},(_,i)=>curve.getPointAt(i/samples,new THREE.Vector3()));
  for(let segment=0;segment<samples;segment++){
   const a=points[segment],b=points[segment+1],dx=b.x-a.x,dz=b.z-a.z,den=dx*dx+dz*dz;
   if(den<1e-12)continue;
   const xMin=Math.max(0,Math.floor(((Math.min(a.x,b.x)-reach)/width+.5)*size));
   const xMax=Math.min(size-1,Math.ceil(((Math.max(a.x,b.x)+reach)/width+.5)*size));
   const zMin=Math.max(0,Math.floor(((Math.min(a.z,b.z)-reach)/length+.5)*size));
   const zMax=Math.min(size-1,Math.ceil(((Math.max(a.z,b.z)+reach)/length+.5)*size));
   for(let row=zMin;row<=zMax;row++){
    const z=zs[row];
    for(let col=xMin;col<=xMax;col++){
     const x=xs[col];
     const t=Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/den));
     const distance=(x-a.x-t*dx)**2+(z-a.z-t*dz)**2,index=row*size+col;
     if(distance<distances[index]){distances[index]=distance;progress[index]=(segment+t)/samples;}
    }
   }
  }
  for(let i=0;i<size*size;i++){
   data[i*4+side*2]=Math.round(Math.min(1,Math.sqrt(distances[i])/reach)*255);
   data[i*4+side*2+1]=Math.round(progress[i]*255);
  }
 });
 const texture=new THREE.DataTexture(data,size,size,THREE.RGBAFormat);
 texture.magFilter=texture.minFilter=THREE.LinearFilter;texture.generateMipmaps=false;
 texture.colorSpace=THREE.NoColorSpace;texture.needsUpdate=true;
 return texture;
}
