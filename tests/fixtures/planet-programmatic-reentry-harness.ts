import * as THREE from 'three';
import { PlanetInteractionController } from '../../src/lib/renderers/planet-interaction.controller';

declare global {
  interface Window {
    runPlanetProgrammaticReentryProbe?: () => Record<string,boolean>;
  }
}

/** Synthetic two-planet chart. Focus-line disposal callbacks intentionally
 * replace pinned selection, aspect mode or scene synchronously.
 */
window.runPlanetProgrammaticReentryProbe = () => {
  const results:Record<string,boolean>={};
  const camera=new THREE.OrthographicCamera(-1,1,1,-1,0.1,10);
  camera.position.z=3;
  camera.updateProjectionMatrix();
  const sun={layer:'natal' as const,name:'Sun'};
  const moon={layer:'natal' as const,name:'Moon'};
  const saturn={layer:'transit' as const,name:'Saturn'};
  const relations=[{from:sun,to:saturn,type:'quadrato',orb:1}];
  for(const mode of ['new-pin','new-mode','new-scene'] as const){
    const canvas=document.createElement('canvas');
    canvas.width=canvas.height=160;
    document.body.appendChild(canvas);
    const scenes: Array<{scene:THREE.Scene;meshes:THREE.Mesh[]}>=[];
    const createScene=()=>{
      const scene=new THREE.Scene();
      const ring=new THREE.Group();
      ring.userData['chartAspectRadius']=0.35;
      scene.add(ring);
      const glyph=(ref:{layer:'natal'|'transit';name:string},x:number,angle:number)=>{
        const mesh=new THREE.Mesh(new THREE.PlaneGeometry(0.12,0.12),
          new THREE.MeshBasicMaterial({color:'#171717',side:THREE.DoubleSide}));
        mesh.position.x=x;
        mesh.userData['chartPlanet']=ref;
        mesh.userData['chartAspectAngle']=angle;
        ring.add(mesh);
        return mesh;
      };
      const meshes=[glyph(sun,-0.45,0),glyph(moon,0,Math.PI),glyph(saturn,0.45,Math.PI/2)];
      scenes.push({scene,meshes});
      return scene;
    };
    const originalScene=createScene();
    const latestScene=createScene();
    let renderCount=0;
    const controller=new PlanetInteractionController(canvas,camera,()=>{},()=>renderCount++);
    try{
      controller.setRelations(relations);
      controller.setScene(originalScene);
      controller.highlight(sun);
      const originalLine=originalScene.getObjectByName('chart-interaction-aspect') as THREE.Line;
      let callbackCount=0,disposalCount=0;
      originalLine.geometry.addEventListener('dispose',()=>{
        disposalCount++;
        if(callbackCount++!==0)return;
        if(mode==='new-pin')controller.highlight(moon);
        if(mode==='new-mode')controller.setNatalAspectPresentation('muted');
        if(mode==='new-scene')controller.setScene(latestScene);
      });
      const initialRenders=renderCount;
      if(mode==='new-mode')controller.setNatalAspectPresentation('focused');
      else controller.highlight(null);
      const newLine=originalScene.getObjectByName('chart-interaction-aspect');
      results[mode+'OldLineDisposedOnce']=disposalCount===1&&originalLine.parent===null;
      results[mode+'OnlyWinningRender']=
        renderCount-initialRenders===(mode==='new-scene'?0:1);
      if(mode==='new-pin'){
        const secondPin=renderCount;
        controller.highlight({...moon});
        results[mode+'LatestFocusRetained']=
          renderCount===secondPin &&
          newLine===undefined &&
          (scenes[0].meshes[1].material as THREE.MeshBasicMaterial).color.getHexString()==='c0c0c0';
      }else if(mode==='new-mode'){
        const secondMode=renderCount;
        controller.setNatalAspectPresentation('muted');
        results[mode+'LatestFocusRetained']=
          renderCount===secondMode &&
          !!newLine && newLine!==originalLine;
      }else{
        results[mode+'LatestFocusRetained']=
          latestScene.getObjectByName('chart-interaction-aspect')===undefined &&
          originalScene.getObjectByName('chart-interaction-aspect')===undefined;
      }
    }finally{
      controller.destroy();
      for(const item of scenes)for(const mesh of item.meshes){
        mesh.geometry.dispose();
        const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];
        materials.forEach(mat=>mat.dispose());
      }
      canvas.remove();
    }
  }
  return results;
};
