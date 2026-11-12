import * as THREE from 'three';
import { inspectChartBodyOwners } from '../../src/lib/renderers/chart-body-ownership';

declare global {
  interface Window {
    runChartBodyOwnershipProbe?: () => Record<string, boolean>;
  }
}

window.runChartBodyOwnershipProbe = () => {
  const result: Record<string,boolean> = {};
  for (const mirrored of [false,true]) {
    const suffix = mirrored ? 'Mirrored' : 'Normal';
    const scene = new THREE.Scene();
    const wheel = new THREE.Group();
    wheel.position.set(0.2,-0.1,0.07);
    wheel.rotation.z = 0.31;
    if (mirrored) wheel.rotation.y = Math.PI;
    scene.add(wheel);
    const make = (layer:'natal'|'transit'|'synastry', name:string,
      offset:number, optional=false) => {
      const owner = new THREE.Group();
      owner.name='chart-planet-body';
      owner.userData['chartPlanetBody']={layer,name};
      const original=60+offset, adjusted=67+offset;
      const tickDegrees=75-22+15+original;
      owner.userData['chartBodyLayout'] = {
        coordinate:'longitude',original,adjusted,tickDegrees,
        ascendant:22,degreesOffset:0,
        glyphDisplacementDegrees:adjusted-original,
        outerLeaderEnabled: optional,moonMarkerEnabled:optional
      };
      const glyph=new THREE.Mesh(new THREE.PlaneGeometry(0.1,0.1),
        new THREE.MeshBasicMaterial({color:'#171717',side:THREE.DoubleSide}));
      glyph.userData['chartPlanet']={layer,name};
      glyph.userData['chartBodyVisualRole']='glyph';
      glyph.userData['chartAspectAngle']=THREE.MathUtils.degToRad(tickDegrees);
      glyph.position.set(0.1+offset*0.01,0.5,0);
      const inner=new THREE.Line(new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0,0.25,0),new THREE.Vector3(0,0.49,0)
      ]),new THREE.LineBasicMaterial());
      inner.userData['chartBodyVisualRole']='inner-leader';
      wheel.add(glyph);
      const before=glyph.getWorldPosition(new THREE.Vector3());
      wheel.add(owner);
      owner.add(inner);
      owner.add(glyph);
      const after=glyph.getWorldPosition(new THREE.Vector3());
      if (optional) {
        const outer=inner.clone();
        outer.userData['chartBodyVisualRole']='outer-leader';
        owner.add(outer);
        const ring=new THREE.Object3D();
        ring.userData['chartBodyVisualRole']='moon-ring';
        owner.add(ring);
        const ringLeader=new THREE.Object3D();
        ringLeader.userData['chartBodyVisualRole']='moon-ring-leader';
        owner.add(ringLeader);
      }
      return {owner,glyph,inner,before,after};
    };
    const natal=make('natal','Sun',0,true);
    const transit=make('transit','Sun',1);
    const synastry=make('synastry','Moon',2);
    const indexed=inspectChartBodyOwners(scene);
    result['layerQualified'+suffix]=indexed.complete && indexed.owners.size===3
      && indexed.owners.get('natal:Sun')?.glyph===natal.glyph
      && indexed.owners.get('transit:Sun')?.glyph===transit.glyph
      && indexed.owners.get('synastry:Moon')?.glyph===synastry.glyph;
    result['unchangedWorldPosition'+suffix]=[natal,transit,synastry]
      .every(body=>body.before.distanceTo(body.after)<1e-12);
    result['pairedOptionalRoles'+suffix]=indexed.owners.get('natal:Sun')
      ?.extras.has('moon-ring')===true &&
      indexed.owners.get('natal:Sun')?.outerLeader===natal.owner.children
        .find(child=>child.userData['chartBodyVisualRole']==='outer-leader');

    // Scene.userData stays mutable for redraws. An earlier successful
    // inspection must retain its own immutable value snapshot even after
    // the host changes the layout in place.
    const sourceLayout=transit.owner.userData['chartBodyLayout'];
    const inspectedLayout=indexed.owners.get('transit:Sun')?.layout;
    const previousOffset=sourceLayout.degreesOffset;
    sourceLayout.degreesOffset=previousOffset+1;
    const invalidFreshInspection=inspectChartBodyOwners(scene);
    result['immutableLayoutSnapshot'+suffix]=!!inspectedLayout
      && inspectedLayout!==sourceLayout && Object.isFrozen(inspectedLayout)
      && inspectedLayout.degreesOffset===previousOffset
      && !invalidFreshInspection.complete
      && invalidFreshInspection.owners.size===0
      && invalidFreshInspection.issues.includes('invalid-layout:transit:Sun');
    sourceLayout.degreesOffset=previousOffset;

    natal.owner.remove(natal.inner);
    const missing=inspectChartBodyOwners(scene);
    result['missingLeaderRejected'+suffix]=!missing.complete
      && missing.owners.size===0
      && missing.issues.includes('missing-inner-leader:natal:Sun');
    natal.owner.add(natal.inner);

    const outer=natal.owner.children.find(child=>
      child.userData['chartBodyVisualRole']==='outer-leader');
    if (outer) {
      natal.owner.remove(outer);
      const missingOuter=inspectChartBodyOwners(scene);
      result['missingEnabledOuterRejected'+suffix]=!missingOuter.complete
        && missingOuter.issues.includes('outer-leader-option-mismatch:natal:Sun');
      natal.owner.add(outer);
    } else {
      result['missingEnabledOuterRejected'+suffix]=false;
    }

    const originalRing=natal.owner.children.find(child=>
      child.userData['chartBodyVisualRole']==='moon-ring');
    const originalRingLeader=natal.owner.children.find(child=>
      child.userData['chartBodyVisualRole']==='moon-ring-leader');
    if (originalRing && originalRingLeader) {
      natal.owner.remove(originalRing);
      natal.owner.remove(originalRingLeader);
      const withoutBoth=inspectChartBodyOwners(scene);
      result['missingEnabledMoonPairRejected'+suffix]=!withoutBoth.complete
        && withoutBoth.issues.includes('moon-marker-option-mismatch:natal:Sun');
      natal.owner.add(originalRing);
      natal.owner.add(originalRingLeader);
    } else {
      result['missingEnabledMoonPairRejected'+suffix]=false;
    }

    const duplicate=natal.owner.clone(true);
    wheel.add(duplicate);
    const doubled=inspectChartBodyOwners(scene);
    result['duplicateBodyRejected'+suffix]=!doubled.complete
      && doubled.issues.includes('duplicate-body:natal:Sun');
    wheel.remove(duplicate);

    natal.owner.position.x=0.01;
    const moved=inspectChartBodyOwners(scene);
    result['ownerTransformRejected'+suffix]=!moved.complete
      && moved.issues.includes('nonidentity-body:natal:Sun');
    natal.owner.position.x=0;

    transit.glyph.userData['chartPlanet']={layer:'natal',name:'Sun'};
    const wrongLayer=inspectChartBodyOwners(scene);
    result['wrongLayerRejected'+suffix]=!wrongLayer.complete
      && wrongLayer.issues.includes('invalid-glyph:transit:Sun');
    transit.glyph.userData['chartPlanet']={layer:'transit',name:'Sun'};

    const oldAngle=transit.glyph.userData['chartAspectAngle'];
    transit.glyph.userData['chartAspectAngle']=oldAngle+0.05;
    const stale=inspectChartBodyOwners(scene);
    result['staleAspectRejected'+suffix]=!stale.complete
      && stale.issues.includes('mismatched-aspect-angle:transit:Sun');
    transit.glyph.userData['chartAspectAngle']=oldAngle;

    // A corrupt original longitude could previously pass inspection as
    // long as the glyph and stored tick angle agreed with each other.
    const originalLayout=transit.owner.userData['chartBodyLayout'];
    transit.owner.userData['chartBodyLayout']={
      ...originalLayout,tickDegrees:originalLayout.tickDegrees+1
    };
    transit.glyph.userData['chartAspectAngle']=THREE.MathUtils.degToRad(
      originalLayout.tickDegrees+1
    );
    const coherentButStale=inspectChartBodyOwners(scene);
    result['staleTickProvenanceRejected'+suffix]=!coherentButStale.complete
      && coherentButStale.issues.includes('invalid-layout:transit:Sun')
      && coherentButStale.owners.size===0;
    transit.owner.userData['chartBodyLayout']=originalLayout;
    transit.glyph.userData['chartAspectAngle']=oldAngle;

    // Wrong or missing rotation provenance must fail closed as well.
    const wrongOffset={...originalLayout,degreesOffset:1};
    transit.owner.userData['chartBodyLayout']=wrongOffset;
    const invalidOffset=inspectChartBodyOwners(scene);
    result['invalidRotationOffsetRejected'+suffix]=!invalidOffset.complete
      && invalidOffset.issues.includes('invalid-layout:transit:Sun');
    transit.owner.userData['chartBodyLayout']=originalLayout;

    const priorLayout=synastry.owner.userData['chartBodyLayout'];
    synastry.owner.userData['chartBodyLayout']={
      ...priorLayout, glyphDisplacementDegrees:0
    };
    const wrongDisplacement=inspectChartBodyOwners(scene);
    result['inconsistentDisplacementRejected'+suffix]=!wrongDisplacement.complete
      && wrongDisplacement.issues.includes('invalid-layout:synastry:Moon');
    synastry.owner.userData['chartBodyLayout']=priorLayout;

    const stranger=new THREE.Object3D();
    stranger.userData['chartBodyVisualRole']='unknown-arc';
    transit.owner.add(stranger);
    result['unknownPartRejected'+suffix]=!inspectChartBodyOwners(scene).complete;
    transit.owner.remove(stranger);

    const beforeAgain=transit.glyph.getWorldPosition(new THREE.Vector3());
    const last=inspectChartBodyOwners(scene);
    result['inspectionIsReadOnly'+suffix]=last.complete
      && transit.glyph.getWorldPosition(new THREE.Vector3())
        .distanceTo(beforeAgain)<1e-12
      && natal.owner.scale.equals(new THREE.Vector3(1,1,1));

    const geometries=new Set<THREE.BufferGeometry>();
    const materials=new Set<THREE.Material>();
    scene.traverse(obj=>{
      const mesh=obj as THREE.Mesh;
      if (mesh.geometry) geometries.add(mesh.geometry);
      const mats=Array.isArray(mesh.material)?mesh.material:[mesh.material];
      for(const mat of mats) if(mat) materials.add(mat);
    });
    geometries.forEach(g=>g.dispose());
    materials.forEach(m=>m.dispose());
  }
  result.noEmptySceneOwners=inspectChartBodyOwners(new THREE.Scene()).issues
    .includes('no-body-groups');
  return result;
};
