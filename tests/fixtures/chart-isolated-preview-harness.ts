import * as THREE from 'three';
import { applyIsolatedCoordinatePreview, isolatedSyntheticLeaderEndpoint } from '../../src/lib/renderers/chart-coordinate-isolated-preview';
import { layoutChartGlyphLongitudes, chartBodyRenderAngles } from '../../src/lib/renderers/planet-layout';

declare global {
  interface Window {
    runIsolatedCoordinatePreviewProbe?: () => Record<string,boolean>;
  }
}

/** Isolated synthetic chart only: NEVER use production artwork or scenes. */
window.runIsolatedCoordinatePreviewProbe = () => {
  const results:Record<string,boolean>={};
  for (const mirrored of [false,true]) {
    const suffix=mirrored?'Mirrored':'Normal';
    const canvas=document.createElement('canvas');
    canvas.width=canvas.height=320;
    document.body.appendChild(canvas);
    const renderer=new THREE.WebGLRenderer({canvas,antialias:false});
    renderer.setSize(320,320,false);
    const camera=new THREE.OrthographicCamera(-1.2,1.2,1.2,-1.2,0.1,10);
    camera.position.z=3;
    camera.updateProjectionMatrix();
    const scene=new THREE.Scene();
    scene.userData['chartSyntheticIsolatedWheel']=true;
    const wheel=new THREE.Group();
    wheel.position.set(0.1,-0.07,0);
    wheel.rotation.z=0.13;
    if (mirrored) wheel.rotation.y=Math.PI;
    scene.add(wheel);
    const ring=new THREE.Group();
    wheel.add(ring);
    const input={Sun:10,Moon:100};
    // Match the wheel's real collision tie provenance; the planner must
    // refuse fixtures that omit the original body enumeration order.
    ring.userData['chartBodySourceOrder']=Object.freeze(Object.keys(input));
    const adjusted=layoutChartGlyphLongitudes(
      Object.fromEntries(Object.entries(input).map(([name,longitude])=>
        [name,{longitude}])),'longitude'
    );
    const bodies=new Map<string,{glyph:THREE.Mesh;inner:THREE.Line;outer:THREE.Line}>();
    const geometrySet=new Set<THREE.BufferGeometry>();
    const materialSet=new Set<THREE.Material>();
    for (const [name,longitude] of Object.entries(input)) {
      const layout=chartBodyRenderAngles(longitude,adjusted[name].longitude,38,0);
      const owner=new THREE.Group();
      owner.userData['chartPlanetBody']={layer:'natal',name};
      owner.userData['chartBodyLayout']={
        ringId:ring.uuid,coordinate:'longitude',original:longitude,
        adjusted:adjusted[name].longitude,ascendant:38,degreesOffset:0,
        tickDegrees:layout.tickDegrees,
        glyphDisplacementDegrees:layout.glyphDisplacementDegrees,
        outerLeaderEnabled:true,moonMarkerEnabled:false
      };
      ring.add(owner);
      const glyph=new THREE.Mesh(new THREE.PlaneGeometry(0.12,0.12),
        new THREE.MeshBasicMaterial({color:'#171717',side:THREE.DoubleSide}));
      const glyphAngle=THREE.MathUtils.degToRad(layout.glyphDegrees);
      glyph.position.set(-0.65*Math.sin(glyphAngle),0.65*Math.cos(glyphAngle),0);
      glyph.userData['chartBodyVisualRole']='glyph';
      glyph.userData['chartPlanet']={layer:'natal',name};
      glyph.userData['chartAspectAngle']=THREE.MathUtils.degToRad(layout.tickDegrees);
      owner.add(glyph);
      geometrySet.add(glyph.geometry);
      materialSet.add(glyph.material as THREE.Material);
      const leader=(role:'inner-leader'|'outer-leader')=>{
        const line=new THREE.Line(
          new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0,0.3,0),new THREE.Vector3(0.02,0.62,0)
          ]),
          new THREE.LineBasicMaterial({color:'#555555'})
        );
        line.rotation.z=THREE.MathUtils.degToRad(layout.tickDegrees);
        line.userData['chartBodyVisualRole']=role;
        owner.add(line);
        geometrySet.add(line.geometry);
        materialSet.add(line.material as THREE.Material);
        return line;
      };
      const inner=leader('inner-leader');
      const outer=leader('outer-leader');
      bodies.set(name,{glyph,inner,outer});
    }
    renderer.render(scene,camera);
    const sun=bodies.get('Sun')!;
    const moon=bodies.get('Moon')!;
    const sunBefore=sun.glyph.getWorldPosition(new THREE.Vector3());
    const moonBefore=moon.glyph.getWorldPosition(new THREE.Vector3());
    const innerGeo=sun.inner.geometry;
    const outerGeo=sun.outer.geometry;
    const glyphGeo=sun.glyph.geometry;
    const originalResources=renderer.info.memory.geometries;
    const targets=[
      {ref:{layer:'natal' as const,name:'Sun'},longitude:15},
      {ref:{layer:'natal' as const,name:'Moon'},longitude:100}
    ];
    const patch=applyIsolatedCoordinatePreview(scene,targets);
    renderer.render(scene,camera);
    const sunAfter=sun.glyph.getWorldPosition(new THREE.Vector3());
    const moonAfter=moon.glyph.getWorldPosition(new THREE.Vector3());
    results['coordinatedTransform'+suffix]=patch.status==='applied'
      && patch.updated===1
      && sunAfter.distanceTo(sunBefore)>0.01
      && moonAfter.distanceTo(moonBefore)<1e-12
      && Math.abs(sun.inner.rotation.z-sun.outer.rotation.z)<1e-12
      && Math.abs(sun.glyph.userData['chartAspectAngle']-sun.inner.rotation.z)<1e-12;
    results['geometryAndGpuStable'+suffix]=sun.inner.geometry===innerGeo
      && sun.outer.geometry===outerGeo && sun.glyph.geometry===glyphGeo
      && renderer.info.memory.geometries===originalResources;
    const projected=sunAfter.clone().project(camera);
    const raycaster=new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(projected.x,projected.y),camera);
    results['newGlyphRaycast'+suffix]=
      raycaster.intersectObjects([sun.glyph,moon.glyph],false)[0]?.object===sun.glyph;
    results['repeatUpdateNoOp'+suffix]=
      applyIsolatedCoordinatePreview(scene,targets).status==='unchanged';

    // Stale geometry on an unchanged Moon must block the NEXT Sun update.
    // A scene with an invalid stationary body cannot be atomically patched.
    const moonOriginalPosition=moon.glyph.position.clone();
    moon.glyph.position.x+=0.05;
    const upcomingTargets=targets.map(item=>({...item,
      longitude:item.ref.name==='Sun'?20:item.longitude}));
    const staleStationary=applyIsolatedCoordinatePreview(scene,upcomingTargets);
    results['stationaryBodyPreflight'+suffix]=staleStationary.status==='rejected'
      && staleStationary.updated===0
      && staleStationary.issues.includes('stale-glyph-geometry:natal:Moon')
      && sun.glyph.getWorldPosition(new THREE.Vector3()).distanceTo(sunAfter)<1e-12;
    // The no-op path must not mask that same stationary corruption.
    const staleNoOp=applyIsolatedCoordinatePreview(scene,targets);
    results['unchangedPreflightRejectsStale'+suffix]=
      staleNoOp.status==='rejected' && staleNoOp.updated===0
      && staleNoOp.issues.includes('stale-glyph-geometry:natal:Moon');
    moon.glyph.position.copy(moonOriginalPosition);
    results['unchangedPreflightRecovers'+suffix]=
      applyIsolatedCoordinatePreview(scene,targets).status==='unchanged';

    const untracked=new THREE.Group();
    untracked.userData['chartAspectRadius']=0.45;
    scene.add(untracked);
    const nextTargets=targets.map(item=>({...item,
      longitude:item.ref.name==='Sun'?20:item.longitude}));
    const rejected=applyIsolatedCoordinatePreview(scene,nextTargets);
    results['nativeRingFailsClosed'+suffix]=rejected.status==='rejected'
      && rejected.issues.includes('untracked-scene-visuals')
      && sun.glyph.getWorldPosition(new THREE.Vector3()).distanceTo(sunAfter)<1e-12;
    scene.remove(untracked);

    // A second ring forces the legacy collision layout to move the Moon
    // glyph without altering its true longitude (Sun 10 -> 5, Moon 11).
    // Both the inner and outer leader geometry must follow the new
    // collision offset in place, without allocating any GPU geometries.
    const collisionScene=new THREE.Scene();
    collisionScene.userData['chartSyntheticIsolatedWheel']=true;
    const collisionWheel=new THREE.Group();
    collisionWheel.rotation.z=0.13;
    if (mirrored) collisionWheel.rotation.y=Math.PI;
    collisionScene.add(collisionWheel);
    const collisionRing=new THREE.Group();
    collisionWheel.add(collisionRing);
    const source={Sun:10,Moon:11};
    collisionRing.userData['chartBodySourceOrder']=Object.freeze(Object.keys(source));
    const sourceLayout=layoutChartGlyphLongitudes(
      Object.fromEntries(Object.entries(source).map(([name,longitude])=>
        [name,{longitude}])),'longitude'
    );
    const collisionBodies=new Map<string,{
      glyph:THREE.Mesh;inner:THREE.Line;outer:THREE.Line;owner:THREE.Group
    }>();
    const collisionGeometries=new Set<THREE.BufferGeometry>();
    const collisionMaterials=new Set<THREE.Material>();
    for (const [name,longitude] of Object.entries(source)) {
      const angles=chartBodyRenderAngles(longitude,sourceLayout[name].longitude,38,0);
      const owner=new THREE.Group();
      owner.userData['chartPlanetBody']={layer:'natal',name};
      owner.userData['chartBodyLayout']={
        ringId:collisionRing.uuid,coordinate:'longitude',original:longitude,
        adjusted:sourceLayout[name].longitude,ascendant:38,degreesOffset:0,
        tickDegrees:angles.tickDegrees,
        glyphDisplacementDegrees:angles.glyphDisplacementDegrees,
        outerLeaderEnabled:true,moonMarkerEnabled:false
      };
      collisionRing.add(owner);
      const polar=THREE.MathUtils.degToRad(angles.glyphDegrees);
      const glyph=new THREE.Mesh(new THREE.PlaneGeometry(0.12,0.12),
        new THREE.MeshBasicMaterial({color:'#171717',side:THREE.DoubleSide}));
      glyph.position.set(-0.65*Math.sin(polar),0.65*Math.cos(polar),0);
      glyph.userData['chartBodyVisualRole']='glyph';
      glyph.userData['chartPlanet']={layer:'natal',name};
      glyph.userData['chartAspectAngle']=THREE.MathUtils.degToRad(angles.tickDegrees);
      owner.add(glyph);
      collisionGeometries.add(glyph.geometry);
      collisionMaterials.add(glyph.material as THREE.Material);
      const makeLeader=(role:'inner-leader'|'outer-leader',anchorY:number)=>{
        const endpoint=isolatedSyntheticLeaderEndpoint(
          0.65,angles.glyphDisplacementDegrees,anchorY,0.09
        )!;
        const line=new THREE.Line(
          new THREE.BufferGeometry().setFromPoints([
            endpoint,new THREE.Vector3(0,anchorY,0)
          ]),
          new THREE.LineBasicMaterial({color:'#555555'})
        );
        line.rotation.z=THREE.MathUtils.degToRad(angles.tickDegrees);
        line.userData['chartBodyVisualRole']=role;
        line.userData['chartIsolatedLeaderSpec']={anchorY,trim:0.09};
        owner.add(line);
        collisionGeometries.add(line.geometry);
        collisionMaterials.add(line.material as THREE.Material);
        return line;
      };
      const inner=makeLeader('inner-leader',0.3);
      const outer=makeLeader('outer-leader',0.75);
      collisionBodies.set(name,{glyph,inner,outer,owner});
    }
    renderer.render(collisionScene,camera);
    const closeSun=collisionBodies.get('Sun')!;
    const closeMoon=collisionBodies.get('Moon')!;
    const oldMoonWorld=closeMoon.glyph.getWorldPosition(new THREE.Vector3());
    const oldInnerX=closeMoon.inner.geometry.getAttribute('position').getX(0);
    const oldOuterX=closeMoon.outer.geometry.getAttribute('position').getX(0);
    const originalInner=closeMoon.inner.geometry;
    const originalOuter=closeMoon.outer.geometry;
    const beforeCollisionAllocations=renderer.info.memory.geometries;
    const newCollisionTargets=[
      {ref:{layer:'natal' as const,name:'Sun'},longitude:5},
      {ref:{layer:'natal' as const,name:'Moon'},longitude:11}
    ];
    // Geometry identity alone is insufficient to establish writable
    // ownership: two separate leader geometries may alias one attribute.
    const moonInnerAttribute=closeMoon.inner.geometry.getAttribute('position');
    const moonOuterAttribute=closeMoon.outer.geometry.getAttribute('position');
    const previousOuterSpec=closeMoon.outer.userData['chartIsolatedLeaderSpec'];
    closeMoon.outer.geometry.setAttribute('position',moonInnerAttribute);
    closeMoon.outer.userData['chartIsolatedLeaderSpec']={
      ...closeMoon.inner.userData['chartIsolatedLeaderSpec']
    };
    const sharedAttribute=applyIsolatedCoordinatePreview(
      collisionScene,newCollisionTargets
    );
    results['collisionSharedBufferRefused'+suffix]=
      closeMoon.inner.geometry!==closeMoon.outer.geometry
      && sharedAttribute.status==='rejected'
      && sharedAttribute.updated===0
      && sharedAttribute.issues.includes('shared-leader-attribute:natal:Moon');
    closeMoon.outer.geometry.setAttribute('position',moonOuterAttribute);
    closeMoon.outer.userData['chartIsolatedLeaderSpec']=previousOuterSpec;

    // Different BufferAttribute instances may still alias the same bytes.
    // Test the actual typed-array backing store independently of identity.
    const backingAlias=new THREE.BufferAttribute(new Float32Array(
      moonInnerAttribute.array.buffer,
      moonInnerAttribute.array.byteOffset,
      moonInnerAttribute.array.length
    ),3);
    closeMoon.outer.geometry.setAttribute('position',backingAlias);
    closeMoon.outer.userData['chartIsolatedLeaderSpec']={
      ...closeMoon.inner.userData['chartIsolatedLeaderSpec']
    };
    const aliasResult=applyIsolatedCoordinatePreview(
      collisionScene,newCollisionTargets
    );
    results['collisionSharedStorageRefused'+suffix]=
      backingAlias!==moonInnerAttribute
      && backingAlias.array!==moonInnerAttribute.array
      && backingAlias.array.buffer===moonInnerAttribute.array.buffer
      && aliasResult.status==='rejected'
      && aliasResult.updated===0
      && aliasResult.issues.includes('shared-leader-storage:natal:Moon');
    closeMoon.outer.geometry.setAttribute('position',moonOuterAttribute);
    closeMoon.outer.userData['chartIsolatedLeaderSpec']=previousOuterSpec;

    // A buffer owned by a SEPARATE mounted synthetic chart must prevent
    // updates even when there is no alias within collisionScene itself.
    const foreignLine=new THREE.Line(
      new THREE.BufferGeometry().setAttribute('position',
        new THREE.BufferAttribute(new Float32Array(
          moonInnerAttribute.array.buffer,
          moonInnerAttribute.array.byteOffset,
          moonInnerAttribute.array.length
        ),3)),
      new THREE.LineBasicMaterial({color:'#777777'})
    );
    scene.add(foreignLine);
    const externalAlias=applyIsolatedCoordinatePreview(
      collisionScene,newCollisionTargets,[scene]
    );
    results['dualChartStorageGuard'+suffix]=externalAlias.status==='rejected'
      && externalAlias.updated===0
      && externalAlias.issues.includes('shared-leader-storage:natal:Moon');
    scene.remove(foreignLine);
    foreignLine.geometry.dispose();
    (foreignLine.material as THREE.Material).dispose();

    // THREE.Points is neither Mesh nor Line. A foreign point cloud must
    // still count as a geometry owner when its position memory aliases
    // a leader in the first chart.
    const foreignPoints=new THREE.Points(
      new THREE.BufferGeometry().setAttribute('position',
        new THREE.BufferAttribute(new Float32Array(
          moonInnerAttribute.array.buffer,
          moonInnerAttribute.array.byteOffset,
          moonInnerAttribute.array.length
        ),3)),
      new THREE.PointsMaterial({size:0.01})
    );
    scene.add(foreignPoints);
    const pointsAlias=applyIsolatedCoordinatePreview(
      collisionScene,newCollisionTargets,[scene]
    );
    results['dualChartPointsGuard'+suffix]=pointsAlias.status==='rejected'
      && pointsAlias.updated===0
      && pointsAlias.issues.includes('shared-leader-storage:natal:Moon');
    scene.remove(foreignPoints);
    foreignPoints.geometry.dispose();
    (foreignPoints.material as THREE.Material).dispose();

    // Cached bounds must track rewritten endpoint vertices. A cached
    // Box3 should update in place; an absent box should remain lazy.
    closeMoon.inner.geometry.computeBoundingSphere();
    closeMoon.inner.geometry.computeBoundingBox();
    closeMoon.outer.geometry.computeBoundingSphere();
    const innerBoxBefore=closeMoon.inner.geometry.boundingBox!;
    const innerSphereBefore=closeMoon.inner.geometry.boundingSphere!;
    const outerSphereBefore=closeMoon.outer.geometry.boundingSphere!;
    const outerBoxWasNull=closeMoon.outer.geometry.boundingBox===null;
    const oldInnerBox=innerBoxBefore.clone();
    // The first natal fixture is a separate mounted chart. Include its
    // entire synthetic root in the collision transaction's readonly
    // peer set; no foreign transforms, buffers or bounds may change.
    const otherChartSun=sun.glyph.position.clone();
    const otherChartMoon=moon.glyph.position.clone();
    const otherChartLine=sun.inner.geometry.getAttribute('position').array.slice();
    const otherChartLayout=moon.glyph.userData['chartAspectAngle'];
    const collisionUpdate=applyIsolatedCoordinatePreview(
      collisionScene,newCollisionTargets,[scene]
    );
    renderer.render(collisionScene,camera);
    results['dualChartIsolation'+suffix]=collisionUpdate.status==='applied'
      && sun.glyph.position.equals(otherChartSun)
      && moon.glyph.position.equals(otherChartMoon)
      && sun.inner.geometry.getAttribute('position').array.every(
        (value,index)=>value===otherChartLine[index])
      && moon.glyph.userData['chartAspectAngle']===otherChartLayout;
    const newInnerBox=new THREE.Box3().setFromBufferAttribute(
      closeMoon.inner.geometry.getAttribute('position')
    );
    results['collisionBoundsRefresh'+suffix]=
      collisionUpdate.status==='applied'
      && closeMoon.inner.geometry.boundingBox===innerBoxBefore
      && innerBoxBefore.equals(newInnerBox)
      && !innerBoxBefore.equals(oldInnerBox)
      && closeMoon.inner.geometry.boundingSphere===innerSphereBefore
      && closeMoon.outer.geometry.boundingSphere===outerSphereBefore
      && (!outerBoxWasNull || closeMoon.outer.geometry.boundingBox===null);
    const newMoonWorld=closeMoon.glyph.getWorldPosition(new THREE.Vector3());
    results['collisionLeaderVertices'+suffix]=collisionUpdate.status==='applied'
      && collisionUpdate.updated>=1
      && newMoonWorld.distanceTo(oldMoonWorld)>0.01
      && closeMoon.inner.geometry===originalInner
      && closeMoon.outer.geometry===originalOuter
      && Math.abs(closeMoon.inner.geometry.getAttribute('position').getX(0)-oldInnerX)>1e-4
      && Math.abs(closeMoon.outer.geometry.getAttribute('position').getX(0)-oldOuterX)>1e-4
      && closeMoon.owner.userData['chartBodyLayout'].original===11
      && renderer.info.memory.geometries===beforeCollisionAllocations;
    results['collisionRepeatNoOp'+suffix]=
      applyIsolatedCoordinatePreview(collisionScene,newCollisionTargets).status==='unchanged';
    // Even an unchanged collision profile is not safe if a host edits
    // its leader endpoint without updating the saved wheel geometry.
    const moonLeaderAttr=closeMoon.inner.geometry.getAttribute('position');
    const moonEndpointX=moonLeaderAttr.getX(0);
    moonLeaderAttr.setX(0,moonEndpointX+0.03);
    const staleNoOp=applyIsolatedCoordinatePreview(collisionScene,newCollisionTargets);
    results['collisionProfileNoOpPreflight'+suffix]=staleNoOp.status==='rejected'
      && staleNoOp.updated===0
      && staleNoOp.issues.includes('stale-leader-endpoints:natal:Moon');
    moonLeaderAttr.setX(0,moonEndpointX);
    results['collisionProfileNoOpRecovery'+suffix]=
      applyIsolatedCoordinatePreview(collisionScene,newCollisionTargets).status==='unchanged';
    // Source longitudes are only 6° apart; glyph rectangles may overlap.
    // Raycast the Moon itself from its new center rather than inferring
    // which overlapping rectangle wins the shared intersection ordering.
    const moonProjected=newMoonWorld.clone().project(camera);
    const raycasterCollision=new THREE.Raycaster();
    raycasterCollision.setFromCamera(
      new THREE.Vector2(moonProjected.x,moonProjected.y),camera
    );
    results['collisionGlyphRaycast'+suffix]=
      raycasterCollision.intersectObject(closeMoon.glyph,false).length>0;

    // Exercise TWO independent synthetic charts over many alternating
    // renders in ONE WebGL renderer. This catches hidden resource
    // allocations and cross-chart mutations that one-off probes miss.
    const initialGeometries=renderer.info.memory.geometries;
    const initialTextures=renderer.info.memory.textures;
    const initialPrograms=renderer.info.programs?.length ?? 0;
    const firstChartBaseline={
      sunGeometry:sun.glyph.geometry,
      moonGeometry:moon.glyph.geometry,
      sunMaterial:sun.glyph.material,
      moonMaterial:moon.glyph.material
    };
    let repeatedUpdates=true,peerIsolation=true,stableGpu=true;
    for(let step=0;step<32;step++){
      const collisionActive=step%2===0;
      const activeScene=collisionActive?collisionScene:scene;
      const peerScene=collisionActive?scene:collisionScene;
      const activeInput=collisionActive
        ? [{ref:{layer:'natal' as const,name:'Sun'},
            longitude:Math.floor(step/2)%2===0?10:5},
          {ref:{layer:'natal' as const,name:'Moon'},longitude:11}]
        : [{ref:{layer:'natal' as const,name:'Sun'},
            longitude:Math.floor(step/2)%2===0?20:15},
          {ref:{layer:'natal' as const,name:'Moon'},longitude:100}];
      const peerSun=collisionActive?sun:closeSun;
      const peerMoon=collisionActive?moon:closeMoon;
      const peerSunPosition=peerSun.glyph.position.clone();
      const peerMoonPosition=peerMoon.glyph.position.clone();
      const peerSunLayout=peerSun.glyph.parent!.userData['chartBodyLayout'];
      const peerMoonLayout=peerMoon.glyph.parent!.userData['chartBodyLayout'];
      const peerInnerArray=peerMoon.inner.geometry.getAttribute('position').array.slice();
      const peerOuterArray=peerMoon.outer.geometry.getAttribute('position').array.slice();
      const report=applyIsolatedCoordinatePreview(activeScene,activeInput,[peerScene]);
      repeatedUpdates &&= report.status==='applied' && report.updated>=1
        && applyIsolatedCoordinatePreview(activeScene,activeInput,[peerScene]).status==='unchanged';
      renderer.render(activeScene,camera);
      renderer.render(peerScene,camera);
      peerIsolation &&= peerSun.glyph.position.equals(peerSunPosition)
        && peerMoon.glyph.position.equals(peerMoonPosition)
        && peerSun.glyph.parent!.userData['chartBodyLayout']===peerSunLayout
        && peerMoon.glyph.parent!.userData['chartBodyLayout']===peerMoonLayout
        && peerMoon.inner.geometry.getAttribute('position').array.every(
          (value,index)=>value===peerInnerArray[index])
        && peerMoon.outer.geometry.getAttribute('position').array.every(
          (value,index)=>value===peerOuterArray[index]);
      stableGpu &&=renderer.info.memory.geometries===initialGeometries
        && renderer.info.memory.textures===initialTextures
        && (renderer.info.programs?.length ?? 0)===initialPrograms
        && sun.glyph.geometry===firstChartBaseline.sunGeometry
        && moon.glyph.geometry===firstChartBaseline.moonGeometry
        && sun.glyph.material===firstChartBaseline.sunMaterial
        && moon.glyph.material===firstChartBaseline.moonMaterial;
    }
    results['dualChart32Updates'+suffix]=repeatedUpdates;
    results['dualChartPeerUnchanged'+suffix]=peerIsolation;
    results['dualChartGpuStable'+suffix]=stableGpu;
    // A failed write after Moon vertex mutation must undo the complete
    // collision transaction without disturbing the other displayed chart.
    const peerSunBeforeFault=sun.glyph.position.clone();
    const peerMoonBeforeFault=moon.glyph.position.clone();
    const collisionMoonBefore=closeMoon.glyph.position.clone();
    const innerBeforeFault=closeMoon.inner.geometry.getAttribute('position').array.slice();
    const outerBeforeFault=closeMoon.outer.geometry.getAttribute('position').array.slice();
    const oldCollisionMoonLayout=closeMoon.owner.userData['chartBodyLayout'];
    Object.defineProperty(closeMoon.owner.userData,'chartBodyLayout',{
      configurable:true,enumerable:true,get:()=>oldCollisionMoonLayout,
      set(next){if(next!==oldCollisionMoonLayout)
        throw Error('synthetic multi-chart WebGL rollback fault');}
    });
    const reverseCollision=[
      {ref:{layer:'natal' as const,name:'Sun'},longitude:10},
      {ref:{layer:'natal' as const,name:'Moon'},longitude:11}
    ];
    let rejectedCycle:ReturnType<typeof applyIsolatedCoordinatePreview>|null=null;
    try {
      rejectedCycle=applyIsolatedCoordinatePreview(
        collisionScene,reverseCollision,[scene]);
    } finally {
      delete closeMoon.owner.userData['chartBodyLayout'];
      closeMoon.owner.userData['chartBodyLayout']=oldCollisionMoonLayout;
    }
    results['dualChartRollback'+suffix]=rejectedCycle?.status==='rejected'
      && rejectedCycle.updated===0
      && rejectedCycle.issues.includes('transaction-rolled-back')
      && closeMoon.glyph.position.equals(collisionMoonBefore)
      && closeMoon.inner.geometry.getAttribute('position').array.every(
        (value,index)=>value===innerBeforeFault[index])
      && closeMoon.outer.geometry.getAttribute('position').array.every(
        (value,index)=>value===outerBeforeFault[index])
      && sun.glyph.position.equals(peerSunBeforeFault)
      && moon.glyph.position.equals(peerMoonBeforeFault);
    const recoveredCycle=applyIsolatedCoordinatePreview(
      collisionScene,reverseCollision,[scene]);
    renderer.render(collisionScene,camera);
    renderer.render(scene,camera);
    results['dualChartRollbackRecovery'+suffix]=recoveredCycle.status==='applied'
      && applyIsolatedCoordinatePreview(collisionScene,reverseCollision,[scene]).status==='unchanged'
      && renderer.info.memory.geometries===initialGeometries
      && renderer.info.memory.textures===initialTextures
      && (renderer.info.programs?.length ?? 0)===initialPrograms;

    collisionGeometries.forEach(item=>item.dispose());
    collisionMaterials.forEach(item=>item.dispose());

    geometrySet.forEach(item=>item.dispose());
    materialSet.forEach(item=>item.dispose());
    renderer.dispose();
    canvas.remove();
  }
  return results;
};
