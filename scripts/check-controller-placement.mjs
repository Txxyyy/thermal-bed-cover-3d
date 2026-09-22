export function checkControllerPlacement(state,check){
 const {logoCenter,indicatorCenter,rearSeat,hoseAnchor,hoseEndLocal,hoseEndDirectionLocal,hoseClearance,frontDirection,position}=state.controllerPlacement;
 check('Wordmark sits on the narrow front face',logoCenter[0]<-.18&&logoCenter[1]>.23&&logoCenter[1]<.27);
 check('Front wordmark is centered above the status LED',Math.abs(logoCenter[2]-indicatorCenter[2])<.001);
 check('Water fitting sits in the rear lower recess',rearSeat[0]>.17&&rearSeat[1]>.07&&rearSeat[1]<.16&&Math.abs(rearSeat[2])<.001);
 check('Hose ends at the rear fitting and enters along its axis',Math.hypot(...hoseEndLocal.map((value,i)=>value-hoseAnchor[i]))<1e-6&&hoseEndDirectionLocal[0]<-.995);
 check('Rerouted hose clears the controller enclosure',hoseClearance>0);
 check('Controller front faces the mattress foot by default',frontDirection[2]>.999&&Math.abs(frontDirection[0])<.001);
 check('Controller is placed beside the pillow area at the head of the bed',position[0]>1&&position[2]<-.5&&position[2]>-1);
 const connection=state.bedConnection;
 check('Bed hose exits at the head center and points backward',Math.abs(connection.position[0])<.001&&connection.position[2]<-1&&connection.outward[2]<-.995);
 check('External sleeve is slimmer than the original hose',connection.radius>.009&&connection.radius<.015);
 check('Free hose clears the mattress and display foundation',connection.bedClearance>0);
 check('Supply and return cores remain inside the slim sleeve',connection.coreClearance>0);
 check('Both water circuits meet the head-center manifolds without gaps',connection.manifoldGap<1e-6&&connection.circuitPorts.every((ports,side)=>ports.every(([x,,z])=>Math.abs(x)<.06&&z<-.9&&(side===0?x<0:x>0))));
 check('Cover skirt carries the DeRUCCI label at the existing label position',state.coverLabel.text==='DeRUCCI'&&Math.abs(state.coverLabel.position[0]-.55)<.001&&state.coverLabel.position[2]>1);
}
