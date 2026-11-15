import * as THREE from 'three';
import { PlanetInteractionController } from '../../src/lib/renderers/planet-interaction.controller';

declare global { interface Window {
  runPlanetPointerReentryProbe?: () => Record<string,boolean>;
}}

window.runPlanetPointerReentryProbe = () => {
  const results:Record<string,boolean>={};
  const camera=new THREE.OrthographicCamera(-1,1,1,-1,0.1,10);
  camera.position.z=3;
  camera.updateProjectionMatrix();
  for(const mode of ['leave-reentry','enter-reentry','enter-then-leave'] as const){
    const canvas=document.createElement('canvas');
    canvas.width=canvas.height=220;
    Object.assign(canvas.style,{
      position:'fixed',left:'8px',top:'8px',width:'220px',
      height:'220px',zIndex:'99999'
    });
    document.body.appendChild(canvas);
    const scene=new THREE.Scene(),group=new THREE.Group();
    scene.add(group);
    const meshes:THREE.Mesh[]=[];
    const positions:Record<string,number>={Sun:-0.65,Moon:0,Venus:0.65};
    for(const [name,x] of Object.entries(positions)){
      const mesh=new THREE.Mesh(new THREE.PlaneGeometry(0.15,0.15),
        new THREE.MeshBasicMaterial({color:'#171717',side:THREE.DoubleSide}));
      mesh.position.x=x;
      mesh.userData['chartPlanet']={layer:'natal',name};
      group.add(mesh); meshes.push(mesh);
    }
    scene.updateMatrixWorld(true);
    const events:string[]=[];
    let renders=0,nested=false;
    const move=(name:string)=>{
      const rect=canvas.getBoundingClientRect();
      const at=new THREE.Vector3(positions[name],0,0).project(camera);
      canvas.dispatchEvent(new PointerEvent('pointermove',{
        bubbles:true,pointerType:'mouse',
        clientX:rect.left+(at.x+1)*rect.width/2,
        clientY:rect.top+(1-at.y)*rect.height/2
      }));
    };
    const controller=new PlanetInteractionController(canvas,camera,event=>{
      events.push(event.type+':'+event.planet.name);
      if(nested)return;
      if(mode==='leave-reentry' && event.type==='leave' && event.planet.name==='Sun'){
        nested=true; move('Venus');
      }else if(mode==='enter-reentry' && event.type==='enter' && event.planet.name==='Moon'){
        nested=true; move('Venus');
      }else if(mode==='enter-then-leave' && event.type==='enter' && event.planet.name==='Moon'){
        nested=true;
        canvas.dispatchEvent(new PointerEvent('pointerleave',{bubbles:true}));
      }
    },()=>{renders++;});
    try{
      controller.setScene(scene);
      if(mode==='leave-reentry')move('Sun');
      const startEvents=events.length,startRenders=renders;
      move('Moon');
      const actual=events.slice(startEvents);
      const expected=mode==='leave-reentry'
        ? ['leave:Sun','enter:Venus']
        : mode==='enter-reentry'
          ? ['enter:Moon','leave:Moon','enter:Venus']
          : ['enter:Moon','leave:Moon'];
      const selected=mode==='enter-then-leave'?null:'Venus';
      const beforeSameHit=events.length;
      if(selected)move(selected);
      results[mode+'Events']=JSON.stringify(actual)===JSON.stringify(expected);
      results[mode+'LatestFocus']=events.length===beforeSameHit &&
        canvas.style.cursor===(selected?'pointer':'');
      results[mode+'OneRender']=renders-startRenders===1;
      results[mode+'NoZoom']=meshes.every(mesh=>mesh.scale.x===1&&mesh.scale.y===1);
    }finally{
      controller.destroy();
      for(const mesh of meshes){
        mesh.geometry.dispose();
        if(Array.isArray(mesh.material))mesh.material.forEach(mat=>mat.dispose());
        else mesh.material.dispose();
      }
      canvas.remove();
    }
  }
  return results;
};
