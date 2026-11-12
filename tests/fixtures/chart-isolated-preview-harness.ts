import * as THREE from 'three';
import { applyIsolatedCoordinatePreview } from '../../src/lib/renderers/chart-coordinate-isolated-preview';
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
    moon.glyph.position.copy(moonOriginalPosition);

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
    geometrySet.forEach(item=>item.dispose());
    materialSet.forEach(item=>item.dispose());
    renderer.dispose();
    canvas.remove();
  }
  return results;
};
