import fs from 'node:fs';
import crypto from 'node:crypto';
fs.mkdirSync('public/models',{recursive:true});
const input=JSON.parse(fs.readFileSync('tmp/controller-cad.json','utf8'));
const chunks=[],views=[],accessors=[],meshes=[],nodes=[];
let byteLength=0;
function accessor(typed,type,componentType,target,min,max){
 const pad=(4-byteLength%4)%4;if(pad){chunks.push(Buffer.alloc(pad));byteLength+=pad;}
 const index=views.length;views.push({buffer:0,byteOffset:byteLength,byteLength:typed.byteLength,target});chunks.push(Buffer.from(typed.buffer));byteLength+=typed.byteLength;
 accessors.push({bufferView:index,componentType,count:typed.length/(type==='VEC3'?3:1),type,...(min?{min,max}:{})});return accessors.length-1;
}
const roles=['shell','textile','grille','indicator','rubber'];
const colors=[[.055,.06,.063,1],[.09,.1,.105,1],[.021,.024,.025,1],[.15,.6,1,1],[.016,.018,.018,1]];
const totalMin=[Infinity,Infinity,Infinity],totalMax=[-Infinity,-Infinity,-Infinity];
input.meshes.forEach((source,index)=>{
 const pos=new Float32Array(source.attributes.position.array),nrm=new Float32Array(source.attributes.normal.array);
 const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
 // Convert CAD Z-up to world Y-up, wide face toward +Z, fill cap on the left as in ID; one metre remains one metre.
 for(let i=0;i<pos.length;i+=3){const [x,y,z]=pos.slice(i,i+3);pos.set([y,z+.189046023385,x],i);const [nx,ny,nz]=nrm.slice(i,i+3);nrm.set([ny,nz,nx],i);for(let c=0;c<3;c++){min[c]=Math.min(min[c],pos[i+c]);max[c]=Math.max(max[c],pos[i+c]);totalMin[c]=Math.min(totalMin[c],pos[i+c]);totalMax[c]=Math.max(totalMax[c],pos[i+c]);}}
 const role=index===1||index===2?1:index===3?3:index>=34&&index<=37?4:(index>=4&&index<=32)||index===40?2:0;
 const attrs={POSITION:accessor(pos,'VEC3',5126,34962,min,max),NORMAL:accessor(nrm,'VEC3',5126,34962)};
 const indices=accessor(new Uint32Array(source.index.array),'SCALAR',5125,34963);
 meshes.push({name:`cad_${index}_${roles[role]}`,primitives:[{attributes:attrs,indices,material:role}]});nodes.push({mesh:index,name:`cad_${index}_${roles[role]}`,extras:{sourceMesh:index,materialRole:roles[role]}});
});
const gltf={asset:{version:'2.0',generator:'Local STEP tessellation via occt-import-js'},scene:0,scenes:[{nodes:nodes.map((_,i)=>i)}],nodes,meshes,materials:roles.map((name,i)=>({name,pbrMetallicRoughness:{baseColorFactor:colors[i],metallicFactor:i===0?.55:0,roughnessFactor:i===0?.35:.85}})),buffers:[{byteLength}],bufferViews:views,accessors};
let json=Buffer.from(JSON.stringify(gltf));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);
let bin=Buffer.concat(chunks);bin=Buffer.concat([bin,Buffer.alloc((4-bin.length%4)%4)]);
const header=Buffer.alloc(12);header.writeUInt32LE(0x46546c67,0);header.writeUInt32LE(2,4);header.writeUInt32LE(12+8+json.length+8+bin.length,8);
const jh=Buffer.alloc(8);jh.writeUInt32LE(json.length,0);jh.writeUInt32LE(0x4e4f534a,4);const bh=Buffer.alloc(8);bh.writeUInt32LE(bin.length,0);bh.writeUInt32LE(0x004e4942,4);
fs.writeFileSync('public/models/controller.glb',Buffer.concat([header,jh,json,bh,bin]));
const manifest={source:'references/source/controller-0916.stp',sourceSHA256:crypto.createHash('sha256').update(fs.readFileSync('references/source/controller-0916.stp')).digest('hex'),meshCount:meshes.length,triangleCount:input.meshes.reduce((n,m)=>n+m.index.array.length/3,0),boundsMeters:{min:totalMin,max:totalMax},dimensionsMeters:totalMax.map((n,i)=>n-totalMin[i]),materialNote:'STEP has no colors. Presentation materials assigned by geometry parts using supplied ID PDF.'};
fs.writeFileSync('public/models/controller-manifest.json',JSON.stringify(manifest,null,2));console.log(manifest);
