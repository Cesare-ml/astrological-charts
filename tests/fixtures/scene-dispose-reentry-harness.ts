import * as THREE from 'three';
import { PlanetInteractionController } from '../../src/lib/renderers/planet-interaction.controller';

declare global {
  interface Window {
    runSceneDisposeReentryProbe?: () => Record<string,boolean>;
  }
}

/** Synthetic scenes. Synchronous Three.js dispose callbacks simulate a
 * host that replaces a chart during an older controller's teardown.
 * Does not require production artwork or render a native horoscope.
 */
window.runSceneDisposeReentryProbe = () => {
  const results:Record<string,boolean>={};
  const camera=new THREE.OrthographicCamera(-1,1,1,-1,0.1,10);
  camera.position.z=3;
  camera.updateProjectionMatrix();
  const ref={layer:'natal' as const,name:'Sun'};
  const link=[{from:ref,to:{layer:'transit' as const,name:'Saturn'},
    type:'quadrato',orb:1}];
  for(const mode of ['material','line-geometry'] as const){
    const canvas=document.createElement('canvas');
    canvas.width=canvas.height=160;
    document.body.appendChild(canvas);
    const created: Array<{scene:THREE.Scene;sun:THREE.Mesh;meshes:THREE.Mesh[]}>=[];
    const makeScene=()=>{
      const scene=new THREE.Scene();
      const root=new THREE.Group();
      root.userData['chartAspectRadius']=0.35;
      scene.add(root);
      const make=(layer:'natal'|'transit',name:string,x:number,angle:number)=>{
        const mesh=new THREE.Mesh(new THREE.PlaneGeometry(0.12,0.12),
          new THREE.MeshBasicMaterial({color:'#171717'}));
        mesh.position.x=x;
        mesh.userData['chartPlanet']={layer,name};
        mesh.userData['chartAspectAngle']=angle;
        root.add(mesh);
        return mesh;
      };
      const sun=make('natal','Sun',-0.4,0);
      const saturn=make('transit','Saturn',0.4,Math.PI/2);
      const entry={scene,sun,meshes:[sun,saturn]};
      created.push(entry);
      return entry;
    };
    const old=makeScene(),latest=makeScene(),stale=makeScene();
    const controller=new PlanetInteractionController(canvas,camera,()=>{},()=>{});
    try{
      controller.setRelations(link);
      controller.setScene(old.scene);
      controller.highlight(ref);
      const oldClone=old.sun.material as THREE.Material;
      const oldLine=old.scene.getObjectByName('chart-interaction-aspect') as THREE.Line;
      let reentrantCalls=0,oldCloneDisposals=0,oldLineDisposals=0;
      oldClone.addEventListener('dispose',()=>{
        oldCloneDisposals++;
        if(mode==='material'&&++reentrantCalls===1)
          controller.setScene(latest.scene);
      });
      oldLine.geometry.addEventListener('dispose',()=>{
        oldLineDisposals++;
        if(mode==='line-geometry'&&++reentrantCalls===1)
          controller.setScene(latest.scene);
      });
      controller.setScene(stale.scene);
      const latestFocus=latest.scene.getObjectByName('chart-interaction-aspect');
      const latestColor=(latest.sun.material as THREE.MeshBasicMaterial).color.getHexString();
      const staleColor=(stale.sun.material as THREE.MeshBasicMaterial).color.getHexString();
      results[mode+'NewSceneWins']=reentrantCalls===1
        && !!latestFocus && latestColor==='ff0000'
        && staleColor==='171717'
        && stale.scene.getObjectByName('chart-interaction-aspect')===undefined;
      results[mode+'OldDisposedExactlyOnce']=oldCloneDisposals===1
        && oldLineDisposals===1
        && old.sun.material!==oldClone
        && oldLine.parent===null;
      controller.highlight(null);
      results[mode+'LatestStillInteractive']=
        latest.scene.getObjectByName('chart-interaction-aspect')===undefined
        && (latest.sun.material as THREE.MeshBasicMaterial).color.getHexString()==='171717';
    }finally{
      controller.destroy();
      for(const entry of created)for(const mesh of entry.meshes){
        mesh.geometry.dispose();
        const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];
        for(const material of materials)material.dispose();
      }
      canvas.remove();
    }
  }
  return results;
};
