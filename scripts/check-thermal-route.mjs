import * as THREE from 'three';
import {createThermalRouteField,THERMAL_ROUTE_FIELD} from '../src/thermal-route.js';

export function checkThermalRoute(check){
 const V=(x,z)=>new THREE.Vector3(x,0,z);
 const path=new THREE.CurvePath();
 path.add(new THREE.LineCurve3(V(-.7,-.6),V(-.2,-.6)));
 path.add(new THREE.LineCurve3(V(-.2,-.6),V(-.2,.6)));
 path.add(new THREE.LineCurve3(V(-.2,.6),V(-.7,.6)));
 const reverse=new THREE.LineCurve3(V(.43,.7),V(.43,-.7));
 const texture=createThermalRouteField([path,reverse]);
 try{
  const {width,length,resolution:size,reach}=THERMAL_ROUTE_FIELD;
  const read=(x,z,side)=>{
   const col=Math.floor((x/width+.5)*size),row=Math.floor((z/length+.5)*size),index=(row*size+col)*4+side*2;
   return {distance:texture.image.data[index]/255*reach,progress:texture.image.data[index+1]/255};
  };
  check('Fabric route field follows horizontal and vertical pipe segments',[[-.45,-.6],[-.2,0],[-.45,.6]].every(([x,z])=>read(x,z,0).distance<.006));
  check('Fabric route field uses arc length through bends',Math.abs(read(-.45,-.6,0).progress-.25/2.2)<.006&&Math.abs(read(-.2,0,0).progress-.5)<.006&&Math.abs(read(-.45,.6,0).progress-1.95/2.2)<.006);
  check('Opposite pipe direction is preserved in fabric flow',Math.abs(read(.43,-.35,1).progress-.75)<.006&&Math.abs(read(.43,.35,1).progress-.25)<.006);
  check('Fabric route channels keep left and right geometry separate',read(-.2,0,1).distance>.23&&read(.43,0,0).distance>.23);
  check('Fabric halo distance increases away from the pipe',Math.abs(read(-.23,0,0).distance-.03)<.006&&Math.abs(read(-.32,0,0).distance-.12)<.006);
 }finally{texture.dispose();}
}
