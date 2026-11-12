import * as THREE from 'three';
import { chartBodyRenderAngles, layoutChartGlyphLongitudes } from '../../src/lib/renderers/planet-layout';
import { planChartCoordinateEffects } from '../../src/lib/renderers/chart-coordinate-plan';
import type { ChartCoordinateTarget } from '../../src/lib/renderers/chart-coordinate-plan';

declare global {
  interface Window {
    runChartCoordinatePlanProbe?: () => Record<string,boolean>;
  }
}

/** Synthetic wheels only; this fixture never patches a scene or calculates astronomy. */
window.runChartCoordinatePlanProbe = () => {
  const result:Record<string,boolean> = {};
  for (const mirrored of [false,true]) {
    const suffix=mirrored?'Mirrored':'Normal';
    const scene=new THREE.Scene();
    const wheel=new THREE.Group();
    wheel.position.set(0.25,-0.2,0.05);
    wheel.rotation.z=0.22;
    if (mirrored) wheel.rotation.y=Math.PI;
    scene.add(wheel);
    const rings=[
      {layer:'natal' as const,longitudes:{Sun:10,Moon:11,Mercury:40}},
      {layer:'transit' as const,longitudes:{Sun:18,Saturn:70}}
    ];
    const snapshot:ChartCoordinateTarget[]=[];
    const glyphs:THREE.Mesh[]=[];
    const layouts:unknown[]=[];
    for (const ring of rings) {
      const parent=new THREE.Group();
      wheel.add(parent);
      const positions=layoutChartGlyphLongitudes(
        Object.fromEntries(Object.entries(ring.longitudes).map(([name,longitude])=>
          [name,{longitude}])),'longitude'
      );
      for (const [name,original] of Object.entries(ring.longitudes)) {
        const adjusted=positions[name].longitude;
        const angles=chartBodyRenderAngles(original,adjusted,45,0);
        const owner=new THREE.Group();
        owner.userData['chartPlanetBody']={layer:ring.layer,name};
        owner.userData['chartBodyLayout']={
          ringId:parent.uuid,
          coordinate:'longitude',original,adjusted,ascendant:45,degreesOffset:0,
          tickDegrees:angles.tickDegrees,glyphDisplacementDegrees:angles.glyphDisplacementDegrees,
          outerLeaderEnabled:false,moonMarkerEnabled:false
        };
        parent.add(owner);
        const glyph=new THREE.Mesh(new THREE.PlaneGeometry(0.13,0.13),
          new THREE.MeshBasicMaterial({color:'#171717',side:THREE.DoubleSide}));
        glyph.userData['chartBodyVisualRole']='glyph';
        glyph.userData['chartPlanet']={layer:ring.layer,name};
        glyph.userData['chartAspectAngle']=THREE.MathUtils.degToRad(angles.tickDegrees);
        glyph.position.set(0.1,0.6,0);
        owner.add(glyph);
        glyphs.push(glyph);
        const inner=new THREE.Line(new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(0,0.3,0),new THREE.Vector3(0,0.57,0)
        ]),new THREE.LineBasicMaterial());
        inner.userData['chartBodyVisualRole']='inner-leader';
        owner.add(inner);
        snapshot.push({ref:{layer:ring.layer,name},longitude:original});
        layouts.push(owner.userData['chartBodyLayout']);
      }
    }
    const worldBefore=glyphs.map(glyph=>glyph.getWorldPosition(new THREE.Vector3()));
    const baseline=planChartCoordinateEffects(scene,snapshot);
    result['noChanges'+suffix]=baseline.decision==='unchanged'
      && baseline.impacts.length===0 && baseline.issues.length===0;
    const shifted=snapshot.map(target=>({
      ...target,longitude:target.ref.layer==='natal' && target.ref.name==='Sun'
        ? 5:target.longitude
    }));
    const plan=planChartCoordinateEffects(scene,shifted);
    const sun=plan.impacts.find(impact=>
      impact.ref.layer==='natal'&&impact.ref.name==='Sun');
    const moon=plan.impacts.find(impact=>
      impact.ref.layer==='natal'&&impact.ref.name==='Moon');
    result['requiresFullRebuild'+suffix]=plan.decision==='full-rebuild'
      && plan.issues.length===0 && !!sun?.trueLongitudeChanged;
    result['collisionNeighbor'+suffix]=!!moon && !moon.trueLongitudeChanged
      && moon.collisionPlacementChanged
      && moon.previousAdjusted!==moon.nextAdjusted
      && moon.affectedVisuals.includes('inner-leader')
      && !moon.affectedVisuals.includes('native-aspects');
    result['independentLayers'+suffix]=plan.impacts.every(impact=>
      impact.ref.layer==='natal')
      && !plan.impacts.some(impact=>impact.ref.layer==='transit');
    result['publishedPlanImmutable'+suffix]=Object.isFrozen(plan)
      && Object.isFrozen(plan.impacts)
      && Object.isFrozen(plan.issues)
      && plan.impacts.length>0
      && plan.impacts.every(impact=>Object.isFrozen(impact)
        && Object.isFrozen(impact.ref)
        && Object.isFrozen(impact.affectedVisuals));
    const missingForFreeze=planChartCoordinateEffects(scene,shifted.slice(1));
    result['unsupportedPlanImmutable'+suffix]=
      missingForFreeze.decision==='unsupported'
      && Object.isFrozen(missingForFreeze)
      && Object.isFrozen(missingForFreeze.impacts)
      && Object.isFrozen(missingForFreeze.issues)
      && Object.isFrozen(baseline)
      && Object.isFrozen(baseline.impacts)
      && Object.isFrozen(baseline.issues);
    result['noMutation'+suffix]=glyphs.every((glyph,index)=>
      glyph.getWorldPosition(new THREE.Vector3()).distanceTo(worldBefore[index])<1e-12)
      && glyphs.every((glyph,index)=>glyph.parent?.userData['chartBodyLayout']===layouts[index])
      && snapshot[0].longitude===10;
    const missing=planChartCoordinateEffects(scene,shifted.slice(1));
    result['missingBodyFailsClosed'+suffix]=missing.decision==='unsupported'
      && missing.impacts.length===0 && missing.issues.includes('missing-target:natal:Sun');
    const duplicates=planChartCoordinateEffects(scene,[...snapshot,snapshot[0]]);
    result['duplicateBodyFailsClosed'+suffix]=duplicates.decision==='unsupported'
      && duplicates.issues.includes('duplicate-target:natal:Sun');
    const wrong=planChartCoordinateEffects(scene,[...snapshot,{
      ref:{layer:'natal',name:'Venus'},longitude:120
    }]);
    result['unknownBodyFailsClosed'+suffix]=wrong.decision==='unsupported'
      && wrong.issues.includes('unknown-target:natal:Venus');
    const nan=planChartCoordinateEffects(scene,[...snapshot.slice(0,1),{
      ...snapshot[1],longitude:NaN
    },...snapshot.slice(2)]);
    result['nonfiniteFailsClosed'+suffix]=nan.decision==='unsupported'
      && nan.issues.includes('invalid-target');

    // Reserve the legacy JavaScript prototype setter name. This must be
    // rejected before building a collision map, even if host metadata
    // and target identities are mutually consistent.
    const specialGlyph=glyphs[0];
    const specialOwner=specialGlyph.parent as THREE.Group;
    const originalOwnerRef=specialOwner.userData['chartPlanetBody'];
    const originalGlyphRef=specialGlyph.userData['chartPlanet'];
    specialOwner.userData['chartPlanetBody']={layer:'natal',name:'__proto__'};
    specialGlyph.userData['chartPlanet']={layer:'natal',name:'__proto__'};
    const specialTargets=snapshot.map(target=>
      target.ref.layer==='natal' && target.ref.name==='Sun'
        ? {ref:{layer:'natal' as const,name:'__proto__'},longitude:target.longitude}
        : target);
    const special=planChartCoordinateEffects(scene,specialTargets);
    result['prototypeNameFailsClosed'+suffix]=special.decision==='unsupported'
      && special.impacts.length===0
      && special.issues.includes('unsafe-wheel-name:natal:__proto__');
    specialOwner.userData['chartPlanetBody']=originalOwnerRef;
    specialGlyph.userData['chartPlanet']=originalGlyphRef;
    result['afterPrototypeRestore'+suffix]=
      planChartCoordinateEffects(scene,snapshot).decision==='unchanged';

    const owner=glyphs[0].parent as THREE.Group;
    const originalLayout=owner.userData['chartBodyLayout'];
    owner.userData['chartBodyLayout']={...originalLayout,adjusted:originalLayout.adjusted+1,
      glyphDisplacementDegrees:originalLayout.glyphDisplacementDegrees+1};
    const invalidBaseline=planChartCoordinateEffects(scene,snapshot);
    result['staleCollisionFailsClosed'+suffix]=invalidBaseline.decision==='unsupported'
      && invalidBaseline.issues.includes('stale-collision-layout:natal:Sun');
    owner.userData['chartBodyLayout']=originalLayout;

    // Independently rendered natal/transit layers must not be merged
    // by reparenting a body into another wheel.
    const saturn=glyphs[4].parent as THREE.Group;
    const transitParent=saturn.parent as THREE.Object3D;
    const natalParent=glyphs[0].parent?.parent as THREE.Object3D;
    natalParent.add(saturn);
    const wrongLayerWheel=planChartCoordinateEffects(scene,snapshot);
    result['mixedWheelLayerFailsClosed'+suffix]=
      wrongLayerWheel.decision==='unsupported'
      && wrongLayerWheel.impacts.length===0
      && wrongLayerWheel.issues.includes('mixed-wheel-layers:natal:Sun');
    transitParent.add(saturn);

    const moonOwner=glyphs[1].parent as THREE.Group;
    const moonLayout=moonOwner.userData['chartBodyLayout'];
    const moonAngle=glyphs[1].userData['chartAspectAngle'];
    const differentAsc={...moonLayout,ascendant:moonLayout.ascendant+5};
    differentAsc.tickDegrees=75-differentAsc.ascendant+15
      +differentAsc.original+differentAsc.degreesOffset;
    moonOwner.userData['chartBodyLayout']=differentAsc;
    glyphs[1].userData['chartAspectAngle']=THREE.MathUtils.degToRad(
      differentAsc.tickDegrees
    );
    const wrongOrientation=planChartCoordinateEffects(scene,snapshot);
    result['mixedWheelOrientationFailsClosed'+suffix]=
      wrongOrientation.decision==='unsupported'
      && wrongOrientation.impacts.length===0
      && wrongOrientation.issues.includes('mixed-wheel-orientation:natal:Sun');
    moonOwner.userData['chartBodyLayout']=moonLayout;
    glyphs[1].userData['chartAspectAngle']=moonAngle;

    const outer=new THREE.Object3D();
    outer.userData['chartBodyVisualRole']='outer-leader';
    moonOwner.add(outer);
    moonOwner.userData['chartBodyLayout']={...moonLayout,outerLeaderEnabled:true};
    const wrongLeaders=planChartCoordinateEffects(scene,snapshot);
    result['mixedWheelLeaderModeFailsClosed'+suffix]=
      wrongLeaders.decision==='unsupported'
      && wrongLeaders.impacts.length===0
      && wrongLeaders.issues.includes('mixed-wheel-leader-mode:natal:Sun');
    moonOwner.remove(outer);
    moonOwner.userData['chartBodyLayout']=moonLayout;
    result['restoredWheelRemainsValid'+suffix]=
      planChartCoordinateEffects(scene,snapshot).decision==='unchanged';

    const moonOwnerAfter=glyphs[1].parent as THREE.Group;
    const originalMoonRing=moonOwnerAfter.parent as THREE.Object3D;
    const newNatalRing=new THREE.Group();
    wheel.add(newNatalRing);
    newNatalRing.add(moonOwnerAfter);
    const reparented=planChartCoordinateEffects(scene,snapshot);
    result['sameLayerReparentRejected'+suffix]=
      reparented.decision==='unsupported'
      && reparented.impacts.length===0
      && reparented.issues.includes('mismatched-ring-owner:natal:Moon');
    originalMoonRing.add(moonOwnerAfter);
    wheel.remove(newNatalRing);
    result['sameLayerReparentRestored'+suffix]=
      planChartCoordinateEffects(scene,snapshot).decision==='unchanged';

    const geometries=new Set<THREE.BufferGeometry>();
    const materials=new Set<THREE.Material>();
    scene.traverse(object=>{
      const renderable=object as THREE.Mesh;
      if(renderable.geometry)geometries.add(renderable.geometry);
      const mats=Array.isArray(renderable.material)?renderable.material:[renderable.material];
      for(const mat of mats)if(mat)materials.add(mat);
    });
    geometries.forEach(g=>g.dispose());
    materials.forEach(m=>m.dispose());
  }
  return result;
};
