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

  // The material/geometry reentry checks above cover setScene(). The
  // same Three.js disposal callback can deliver a NEW relations snapshot
  // while the OLD setRelations() has not finished its paint/send/render.
  // In both paths only the newest snapshot may request another frame.
  for(const mode of ['dispose','send'] as const){
    const canvas=document.createElement('canvas');
    canvas.width=canvas.height=160;
    document.body.appendChild(canvas);
    const scene=new THREE.Scene();
    const root=new THREE.Group();
    root.userData['chartAspectRadius']=0.35;
    scene.add(root);
    const glyph=(layer:'natal'|'transit',name:string,x:number,angle:number)=>{
      const mesh=new THREE.Mesh(new THREE.PlaneGeometry(0.12,0.12),
        new THREE.MeshBasicMaterial({color:'#171717'}));
      mesh.position.x=x;
      mesh.userData['chartPlanet']={layer,name};
      mesh.userData['chartAspectAngle']=angle;
      root.add(mesh);
      return mesh;
    };
    const sun=glyph('natal','Sun',-0.4,0);
    const saturn=glyph('transit','Saturn',0.4,Math.PI/2);
    const relation=(type:string)=>[{
      from:ref,to:{layer:'transit' as const,name:'Saturn'},type,orb:1
    }];
    let emittedTypes:string[]=[];
    let renderRequests=0,reentryCount=0;
    let controller:PlanetInteractionController;
    controller=new PlanetInteractionController(canvas,camera,event=>{
      if(event.type!=='update')return;
      emittedTypes.push(event.aspects[0]?.type ?? 'none');
      if(mode==='send' && reentryCount++===0)
        controller.setRelations(relation('sestile'));
    },()=>{renderRequests++;});
    try{
      controller.setRelations(relation('quadrato'));
      controller.setScene(scene);
      controller.highlight(ref);
      const oldLine=scene.getObjectByName('chart-interaction-aspect') as THREE.Line;
      if(mode==='dispose') oldLine.geometry.addEventListener('dispose',()=>{
        if(reentryCount++===0) controller.setRelations(relation('sestile'));
      });
      const initialRenders=renderRequests;
      controller.setRelations(relation('trigono'));
      const remaining=scene.getObjectByName('chart-interaction-aspect') as THREE.Line;
      results[mode+'LatestRelationsOnly']=
        (mode==='dispose'
          ? emittedTypes.join(',')==='sestile'
          : emittedTypes.join(',')==='trigono,sestile')
        && !!remaining && remaining!==oldLine
        && renderRequests-initialRenders===1
        && oldLine.parent===null;
      const beforeRepeat=renderRequests;
      controller.setRelations(relation('sestile'));
      results[mode+'LatestRelationsIdempotent']=renderRequests===beforeRepeat;
    } finally {
      controller.destroy();
      sun.geometry.dispose();
      saturn.geometry.dispose();
      (sun.material as THREE.Material).dispose();
      (saturn.material as THREE.Material).dispose();
      canvas.remove();
    }
  }


  // Three.js Object3D.add() dispatches synchronous 'added' events.
  // Replace the chart while a newly constructed central line or transit
  // connector is being attached, or while a natal foreground is added.
  for(const mode of ['central-added','guide-added','foreground-added'] as const){
    const canvas=document.createElement('canvas');
    canvas.width=canvas.height=160;
    document.body.appendChild(canvas);
    const scene=new THREE.Scene(),replacement=new THREE.Scene();
    const group=new THREE.Group();
    group.userData['chartAspectRadius']=0.35;
    scene.add(group);
    const glyph=(ref:{layer:'natal'|'transit';name:string},x:number,angle:number)=>{
      const mesh=new THREE.Mesh(new THREE.PlaneGeometry(0.12,0.12),
        new THREE.MeshBasicMaterial({color:'#171717'}));
      mesh.position.x=x;
      mesh.userData['chartPlanet']=ref;
      mesh.userData['chartAspectAngle']=angle;
      group.add(mesh);
      return mesh;
    };
    const sun=glyph(ref,-0.4,0);
    const saturn=glyph({layer:'transit',name:'Saturn'},0.65,Math.PI/2);
    const native=new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-0.2,0,0),new THREE.Vector3(0.2,0,0)
      ]),
      new THREE.LineBasicMaterial({color:'#ff0000'})
    );
    native.userData['chartNatalAspect']={
      from:'Sun',to:'Moon',type:'trigono'
    };
    group.add(native);
    const tracked:THREE.Object3D[]=[];
    let triggered=0,freedGeometry=0,freedMaterial=0;
    const controller=new PlanetInteractionController(canvas,camera,()=>{},()=>{});
    try{
      controller.setRelations(link);
      if(mode==='foreground-added')controller.setNatalAspectPresentation('focused');
      controller.setScene(scene);
      const parent=mode==='foreground-added'?group:scene;
      const originalAdd=parent.add.bind(parent);
      parent.add=(...objects:THREE.Object3D[])=>{
        for(const object of objects){
          const wanted=mode==='central-added'?'chart-interaction-aspect':
            mode==='guide-added'?'chart-interaction-transit-connector':
            'chart-interaction-natal-focus';
          if(object.name!==wanted)continue;
          tracked.push(object);
          object.traverse(child=>{
            const render=child as THREE.Mesh;
            render.geometry?.addEventListener('dispose',()=>freedGeometry++);
            const materials=Array.isArray(render.material)?render.material:
              render.material?[render.material]:[];
            for(const mat of materials)
              mat.addEventListener('dispose',()=>freedMaterial++);
          });
          object.addEventListener('added',()=>{
            if(triggered++)return;
            controller.setScene(replacement);
          });
        }
        return originalAdd(...objects);
      };
      controller.highlight(ref);
      results[mode+'Reentered']=triggered===1;
      results[mode+'NoOrphan']=tracked.length===1
        && tracked[0].parent===null
        && !scene.getObjectByName('chart-interaction-aspect')
        && !scene.getObjectByName('chart-interaction-transit-connector')
        && !group.getObjectByName('chart-interaction-natal-focus');
      results[mode+'ReleasedOwnedGeometry']=freedGeometry>=1 && freedMaterial>=1;
      results[mode+'LatestSceneRetained']=!replacement.getObjectByName('chart-interaction-aspect');
    }finally{
      controller.destroy();
      for(const mesh of [sun,saturn]){
        mesh.geometry.dispose();
        const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];
        for(const material of materials)material.dispose();
      }
      native.geometry.dispose();
      (native.material as THREE.Material).dispose();
      canvas.remove();
    }
  }

  return results;
};
