import * as THREE from 'three';

// Small deterministic weave tiles keep all materials local and reproducible.
export function weaveTexture({repeatX=80,repeatY=80,dark=false}={}) {
  const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;
  const ctx=canvas.getContext('2d'),image=ctx.createImageData(128,128);
  for(let y=0;y<128;y++)for(let x=0;x<128;x++){
    const grain=((x*73+y*137+(x*y)%67)%29)-14;
    const warp=Math.sin(x*Math.PI/4)*18+Math.cos(y*Math.PI/4)*18;
    const cross=((Math.floor(x/4)+Math.floor(y/4))%2)*18;
    const c=Math.max(0,Math.min(255,(dark?104:165)+warp+cross+grain));
    const i=(y*128+x)*4;image.data.set([c,c,c,255],i);
  }
  ctx.putImageData(image,0,0);
  const map=new THREE.CanvasTexture(canvas);map.wrapS=map.wrapT=THREE.RepeatWrapping;map.repeat.set(repeatX,repeatY);map.anisotropy=8;
  return map;
}
export function textile(color,repeatX=70,repeatY=70){
  const bump=weaveTexture({repeatX,repeatY});
  bump.colorSpace=THREE.NoColorSpace;
  const albedo=bump.clone();albedo.colorSpace=THREE.SRGBColorSpace;
  return new THREE.MeshPhysicalMaterial({color,map:albedo,roughness:.93,metalness:0,bumpMap:bump,bumpScale:.00012,sheen:.16,sheenColor:new THREE.Color('#454c4d'),sheenRoughness:.9});
}
export function labelTexture(text,subtitle=''){
 const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=256;const ctx=canvas.getContext('2d');
 ctx.fillStyle='#c8c5b9';ctx.font=subtitle?'44px Georgia':'180px Georgia';ctx.textAlign='center';ctx.textBaseline=subtitle?'alphabetic':'middle';ctx.fillText(text,512,subtitle?105:135);
 if(subtitle){ctx.fillStyle='#858d8b';ctx.font='17px sans-serif';ctx.letterSpacing='5px';ctx.fillText(subtitle,512,165);}
 const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;map.userData.text=text;return map;
}

export function quiltTexture(){
 const size=2048,canvas=document.createElement('canvas');canvas.width=canvas.height=size;
 const ctx=canvas.getContext('2d'),data=ctx.createImageData(size,size);
 for(let j=0;j<size;j++)for(let i=0;i<size;i++){
   const x=(i/size-.5)*1.824,z=(j/size-.5)*2.024;
   const dist=t=>Math.abs(((t%.22)+.22)%.22-.11);
   const a=dist(x+z),b=dist(x-z),d=Math.min(a,b);
   const groove=25*Math.exp(-Math.pow(d/.0022,2));
   const along=a<b?x-z:x+z;
   const stitch=Math.abs(d-.0032)<.00055&&((along%.008)+.008)%.008<.0045?16:0;
   const weave=((i+j)%2)*3+((i*31+j*73)%13)-6;
   const c=Math.round(174-groove+stitch+weave);const offset=(j*size+i)*4;
   data.data.set([c,c,c,255],offset);
 }
 ctx.putImageData(data,0,0);const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=8;return map;
}
