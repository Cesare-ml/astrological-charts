import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';

/**
 * Bundles the actual TypeScript planner + Three.js for headless Node tests.
 * Requires only npm ci; no browser, original artwork or running demo server.
 * This does NOT replace Chromium/Firefox visual validation.
 */
const bundled=await build({
  stdin:{
    contents:`
      import * as THREE from 'three';
      export {THREE};
      export {planChartCoordinateEffects} from './src/lib/renderers/chart-coordinate-plan';
      export {chartBodyRenderAngles,layoutChartGlyphLongitudes} from './src/lib/renderers/planet-layout';
    `,
    resolveDir:process.cwd(),sourcefile:'chart-coordinate-plan-node-entry.ts',loader:'ts'
  },
  bundle:true,platform:'node',format:'esm',target:'node22',
  write:false,logLevel:'silent'
});
assert.equal(bundled.outputFiles.length,1);
const runtime=await import('data:text/javascript;base64,'+
  Buffer.from(bundled.outputFiles[0].text).toString('base64'));
const {THREE,planChartCoordinateEffects,chartBodyRenderAngles,layoutChartGlyphLongitudes}=runtime;

function sceneWithBodies(mirrored=false, natalLongitudes={Sun:10,Moon:11,Mercury:40}) {
  const scene=new THREE.Scene();
  const wheel=new THREE.Group();
  wheel.rotation.z=0.29;
  if (mirrored) wheel.rotation.y=Math.PI;
  scene.add(wheel);
  const targets=[];
  const owners=new Map();
  const buildRing=(layer,longitudes)=>{
    const ring=new THREE.Group();
    ring.userData.chartBodySourceOrder=Object.freeze(Object.keys(longitudes));
    wheel.add(ring);
    const positions=layoutChartGlyphLongitudes(
      Object.fromEntries(Object.entries(longitudes).map(([name,longitude])=>[name,{longitude}])),
      'longitude'
    );
    for(const [name,original] of Object.entries(longitudes)){
      const adjusted=positions[name].longitude;
      const angles=chartBodyRenderAngles(original,adjusted,42,0);
      const group=new THREE.Group();
      group.userData.chartPlanetBody={layer,name};
      group.userData.chartBodyLayout={
        ringId:ring.uuid,
        coordinate:'longitude',original,adjusted,ascendant:42,degreesOffset:0,
        tickDegrees:angles.tickDegrees,glyphDisplacementDegrees:angles.glyphDisplacementDegrees,
        outerLeaderEnabled:false,moonMarkerEnabled:false
      };
      ring.add(group);
      const glyph=new THREE.Mesh(new THREE.PlaneGeometry(0.1,0.1),
        new THREE.MeshBasicMaterial({color:'#171717'}));
      glyph.userData.chartPlanet={layer,name};
      glyph.userData.chartBodyVisualRole='glyph';
      glyph.userData.chartAspectAngle=THREE.MathUtils.degToRad(angles.tickDegrees);
      glyph.position.set(0.1,0.5,0);
      group.add(glyph);
      const tick=new THREE.Object3D();
      tick.userData.chartBodyVisualRole='inner-leader';
      group.add(tick);
      const key=layer+':'+name;
      owners.set(key,{group,glyph,tick});
      targets.push({ref:{layer,name},longitude:original});
    }
  };
  buildRing('natal',natalLongitudes);
  buildRing('transit',{Sun:18,Saturn:70});
  return {scene,wheel,targets,owners};
}

test('unchanged positions are read-only in normal and mirrored wheels',()=>{
  for(const mirrored of [false,true]){
    const {scene,targets,owners}=sceneWithBodies(mirrored);
    const first=owners.get('natal:Sun').glyph;
    const originalPoint=first.getWorldPosition(new THREE.Vector3());
    const savedTargets=structuredClone(targets);
    const plan=planChartCoordinateEffects(scene,targets);
    assert.equal(plan.decision,'unchanged');
    assert.deepEqual(plan.impacts,[]);
    assert.deepEqual(plan.issues,[]);
    assert.deepEqual(targets,savedTargets);
    assert.ok(first.getWorldPosition(new THREE.Vector3()).equals(originalPoint));
  }
});

test('one changing longitude also invalidates neighboring collision-shifted glyphs',()=>{
  for(const mirrored of [false,true]){
    const {scene,targets,owners}=sceneWithBodies(mirrored);
    const before=owners.get('natal:Moon').glyph.position.clone();
    const input=targets.map(item=>({
      ref:{...item.ref},longitude:item.ref.layer==='natal'&&item.ref.name==='Sun'
        ? 5 : item.longitude
    }));
    const plan=planChartCoordinateEffects(scene,input);
    assert.equal(plan.decision,'full-rebuild');
    const sun=plan.impacts.find(item=>item.ref.layer==='natal'&&item.ref.name==='Sun');
    const moon=plan.impacts.find(item=>item.ref.layer==='natal'&&item.ref.name==='Moon');
    assert.equal(sun?.trueLongitudeChanged,true);
    assert.equal(sun?.affectedVisuals.includes('native-aspects'),true);
    assert.equal(moon?.trueLongitudeChanged,false);
    assert.equal(moon?.collisionPlacementChanged,true);
    assert.equal(moon?.affectedVisuals.includes('inner-leader'),true);
    assert.equal(moon?.affectedVisuals.includes('native-aspects'),false);
    assert.equal(plan.impacts.every(item=>item.ref.layer==='natal'),true);
    assert.ok(owners.get('natal:Moon').glyph.position.equals(before));
  }
});

test('missing, unknown, duplicate or nonfinite targets fail closed',()=>{
  const {scene,targets}=sceneWithBodies();
  for(const [input,expected] of [
    [targets.slice(1),'missing-target:natal:Sun'],
    [[...targets,targets[0]],'duplicate-target:natal:Sun'],
    [[...targets,{ref:{layer:'synastry',name:'Sun'},longitude:10}],'unknown-target:synastry:Sun'],
    [targets.map((x,i)=>i===0?{...x,longitude:NaN}:x),'invalid-target'],
    [targets.map((x,i)=>i===0?{...x,longitude:Infinity}:x),'invalid-target']
  ]){
    const plan=planChartCoordinateEffects(scene,input);
    assert.equal(plan.decision,'unsupported');
    assert.deepEqual(plan.impacts,[]);
    assert.ok(plan.issues.includes(expected),expected+': '+plan.issues);
  }
});

test('stale collision metadata or unsupported latitude layout must never patch',()=>{
  const {scene,targets,owners}=sceneWithBodies();
  const group=owners.get('natal:Sun').group;
  const original=group.userData.chartBodyLayout;
  group.userData.chartBodyLayout={
    ...original,adjusted:original.adjusted+1,
    glyphDisplacementDegrees:original.glyphDisplacementDegrees+1
  };
  const stale=planChartCoordinateEffects(scene,targets);
  assert.equal(stale.decision,'unsupported');
  assert.ok(stale.issues.includes('stale-collision-layout:natal:Sun'));
  group.userData.chartBodyLayout={...original,coordinate:'latitude'};
  const lat=planChartCoordinateEffects(scene,targets);
  assert.equal(lat.decision,'unsupported');
  assert.ok(lat.issues.includes('unsupported-coordinate:natal:Sun'));
});

test('ambiguous same-name bodies inside one ring require full redraw instead of guessed layout',()=>{
  const {scene,targets,owners}=sceneWithBodies();
  const natal=owners.get('natal:Sun').group;
  const transit=owners.get('transit:Sun').group;
  // Reparent into the same visual ring; neither body loses its layer identity.
  natal.parent.add(transit);
  const report=planChartCoordinateEffects(scene,targets);
  assert.equal(report.decision,'unsupported');
  assert.deepEqual(report.impacts,[]);
  assert.ok(report.issues.includes('ambiguous-wheel-name:Sun'));
});

test('special prototype key fails closed without changing existing chart layout',()=>{
  const {scene,targets,owners}=sceneWithBodies();
  const sun=owners.get('natal:Sun');
  const originalRef=sun.group.userData.chartPlanetBody;
  const originalGlyphRef=sun.glyph.userData.chartPlanet;
  const originalPosition=sun.glyph.position.clone();
  // A parsed JSON key may literally be "__proto__". The legacy collision
  // helper uses ordinary object keys, where this key mutates the prototype.
  sun.group.userData.chartPlanetBody={layer:'natal',name:'__proto__'};
  sun.glyph.userData.chartPlanet={layer:'natal',name:'__proto__'};
  const badTargets=targets.map(target=>target.ref.layer==='natal'&&target.ref.name==='Sun'
    ? {ref:{layer:'natal',name:'__proto__'},longitude:target.longitude}
    : target);
  try {
    const report=planChartCoordinateEffects(scene,badTargets);
    assert.equal(report.decision,'unsupported');
    assert.deepEqual(report.impacts,[]);
    assert.ok(report.issues.includes('unsafe-wheel-name:natal:__proto__'));
    assert.ok(sun.glyph.position.equals(originalPosition));
  } finally {
    sun.group.userData.chartPlanetBody=originalRef;
    sun.glyph.userData.chartPlanet=originalGlyphRef;
  }
  assert.equal(planChartCoordinateEffects(scene,targets).decision,'unchanged');
});


test('an independently constructed transit body cannot join a natal collision wheel',()=>{
  const {scene,targets,owners}=sceneWithBodies();
  const saturn=owners.get('transit:Saturn').group;
  const natalRing=owners.get('natal:Sun').group.parent;
  const originalParent=saturn.parent;
  natalRing.add(saturn);
  const plan=planChartCoordinateEffects(scene,targets);
  assert.equal(plan.decision,'unsupported');
  assert.deepEqual(plan.impacts,[]);
  assert.ok(plan.issues.includes('mixed-wheel-layers:natal:Sun'),plan.issues.join(','));
  originalParent.add(saturn);
  assert.equal(planChartCoordinateEffects(scene,targets).decision,'unchanged');
});

test('one wheel must use consistent ascendant and degree offsets',()=>{
  const {scene,targets,owners}=sceneWithBodies();
  const moon=owners.get('natal:Moon');
  const previous=moon.group.userData.chartBodyLayout;
  const previousAngle=moon.glyph.userData.chartAspectAngle;
  const attempt=(changes)=>{
    const layout={...previous,...changes};
    layout.tickDegrees=75-layout.ascendant+15+layout.original+layout.degreesOffset;
    moon.group.userData.chartBodyLayout=layout;
    moon.glyph.userData.chartAspectAngle=THREE.MathUtils.degToRad(layout.tickDegrees);
    const plan=planChartCoordinateEffects(scene,targets);
    assert.equal(plan.decision,'unsupported');
    assert.deepEqual(plan.impacts,[]);
    assert.ok(plan.issues.includes('mixed-wheel-orientation:natal:Sun'),plan.issues.join(','));
  };
  try {
    attempt({ascendant:previous.ascendant+1});
    attempt({degreesOffset:previous.degreesOffset+11});
  } finally {
    moon.group.userData.chartBodyLayout=previous;
    moon.glyph.userData.chartAspectAngle=previousAngle;
  }
  assert.equal(planChartCoordinateEffects(scene,targets).decision,'unchanged');
});

test('per-body valid but mixed outer leader modes require a full chart rebuild',()=>{
  const {scene,targets,owners}=sceneWithBodies();
  const moon=owners.get('natal:Moon');
  const oldLayout=moon.group.userData.chartBodyLayout;
  const outer=new THREE.Object3D();
  outer.userData.chartBodyVisualRole='outer-leader';
  moon.group.add(outer);
  moon.group.userData.chartBodyLayout={...oldLayout,outerLeaderEnabled:true};
  try {
    const plan=planChartCoordinateEffects(scene,targets);
    assert.equal(plan.decision,'unsupported');
    assert.deepEqual(plan.impacts,[]);
    assert.ok(plan.issues.includes('mixed-wheel-leader-mode:natal:Sun'));
  } finally {
    moon.group.remove(outer);
    moon.group.userData.chartBodyLayout=oldLayout;
  }
  assert.equal(planChartCoordinateEffects(scene,targets).decision,'unchanged');
});


test('published coordinate reports are immutable including endpoint and dependency data',()=>{
  for (const mirrored of [false,true]) {
    const {scene,targets}=sceneWithBodies(mirrored);
    const unchanged=planChartCoordinateEffects(scene,targets);
    assert.equal(unchanged.decision,'unchanged');
    assert.ok(Object.isFrozen(unchanged));
    assert.ok(Object.isFrozen(unchanged.impacts));
    assert.ok(Object.isFrozen(unchanged.issues));

    const changedTargets=targets.map(item=>({
      ref:{...item.ref},
      longitude:item.ref.layer==='natal'&&item.ref.name==='Sun'
        ? 5:item.longitude
    }));
    const changed=planChartCoordinateEffects(scene,changedTargets);
    assert.equal(changed.decision,'full-rebuild');
    assert.ok(changed.impacts.length>0);
    assert.ok(Object.isFrozen(changed));
    assert.ok(Object.isFrozen(changed.impacts));
    assert.ok(Object.isFrozen(changed.issues));
    for(const impact of changed.impacts) {
      assert.ok(Object.isFrozen(impact));
      assert.ok(Object.isFrozen(impact.ref));
      assert.ok(Object.isFrozen(impact.affectedVisuals));
    }
    const sun=changed.impacts.find(impact=>
      impact.ref.layer==='natal'&&impact.ref.name==='Sun');
    const previousNext=sun.nextLongitude;
    const previousName=sun.ref.name;
    assert.throws(()=>{sun.ref.name='Venus';},TypeError);
    assert.throws(()=>{sun.affectedVisuals.push('invented');},TypeError);
    assert.throws(()=>{changed.impacts.pop();},TypeError);
    changedTargets[0].longitude=190;
    changedTargets[0].ref.name='Venus';
    assert.equal(sun.nextLongitude,previousNext);
    assert.equal(sun.ref.name,previousName);
    assert.equal(changed.decision,'full-rebuild');

    const unsupported=planChartCoordinateEffects(scene,targets.slice(1));
    assert.equal(unsupported.decision,'unsupported');
    assert.ok(Object.isFrozen(unsupported));
    assert.ok(Object.isFrozen(unsupported.issues));
    assert.ok(Object.isFrozen(unsupported.impacts));
    assert.throws(()=>{unsupported.issues.push('made-up');},TypeError);
    assert.ok(unsupported.issues.includes('missing-target:natal:Sun'));
  }
});


test('same-layer, same-orientation reparenting is not the original collision ring',()=>{
  for (const mirrored of [false,true]) {
    const {scene,wheel,targets,owners}=sceneWithBodies(mirrored);
    const moon=owners.get('natal:Moon').group;
    const originalRing=moon.parent;
    const freshRing=new THREE.Group();
    wheel.add(freshRing);
    assert.equal(planChartCoordinateEffects(scene,targets).decision,'unchanged');
    freshRing.add(moon);
    const changed=planChartCoordinateEffects(scene,targets);
    assert.equal(changed.decision,'unsupported');
    assert.deepEqual(changed.impacts,[]);
    assert.ok(changed.issues.includes('mismatched-ring-owner:natal:Moon'));
    originalRing.add(moon);
    wheel.remove(freshRing);
    assert.equal(planChartCoordinateEffects(scene,targets).decision,'unchanged');
  }
});

test('mutable host ring-id replacement cannot authorize a moved body',()=>{
  const {scene,wheel,targets,owners}=sceneWithBodies();
  const sun=owners.get('natal:Sun').group;
  const parent=sun.parent;
  const original=sun.userData.chartBodyLayout;
  const newRing=new THREE.Group();
  wheel.add(newRing);
  newRing.add(sun);
  // Inspecting the newly mounted body requires metadata and parent
  // identity to agree. An external host cannot gain authorization by
  // merely changing a plan's frozen output after it was returned.
  assert.equal(planChartCoordinateEffects(scene,targets).decision,'unsupported');
  sun.userData.chartBodyLayout={...original,ringId:newRing.uuid};
  // A new host provenance entry is not a geometry update; the ring now
  // contains only Sun, but the legacy layout depended on Moon/Mercury.
  const noBaseline=planChartCoordinateEffects(scene,targets);
  assert.equal(noBaseline.decision,'unsupported');
  assert.ok(noBaseline.issues.some(issue=>issue.startsWith('stale-collision-layout:')));
  parent.add(sun);
  sun.userData.chartBodyLayout=original;
  wheel.remove(newRing);
  assert.equal(planChartCoordinateEffects(scene,targets).decision,'unchanged');
});


test('reparenting an entire collision ring preserves its internal body lineage',()=>{
  for (const mirrored of [false,true]) {
    const {scene,wheel,targets,owners}=sceneWithBodies(mirrored);
    const originalRing=owners.get('natal:Sun').group.parent;
    const moonRing=owners.get('natal:Moon').group.parent;
    assert.equal(originalRing,moonRing);
    const originalSunParent=owners.get('natal:Sun').group.parent;
    const outerWrapper=new THREE.Group();
    outerWrapper.name='whole-chart-wrapper';
    wheel.add(outerWrapper);
    outerWrapper.add(originalRing);
    const unchanged=planChartCoordinateEffects(scene,targets);
    assert.equal(unchanged.decision,'unchanged');
    assert.deepEqual(unchanged.issues,[]);
    assert.equal(owners.get('natal:Sun').group.parent,originalSunParent);
    outerWrapper.remove(originalRing);
    wheel.add(originalRing);
    wheel.remove(outerWrapper);
    assert.equal(planChartCoordinateEffects(scene,targets).decision,'unchanged');
  }
});


test('equal-longitude collision ties follow original source order after children reorder',()=>{
  for (const mirrored of [false,true]) {
    const {scene,targets,owners}=sceneWithBodies(mirrored,{Sun:10,Moon:10,Mercury:40});
    const sun=owners.get('natal:Sun').group;
    const moon=owners.get('natal:Moon').group;
    const mercury=owners.get('natal:Mercury').group;
    const ring=sun.parent;
    assert.deepEqual(ring.userData.chartBodySourceOrder,['Sun','Moon','Mercury']);
    const before=planChartCoordinateEffects(scene,targets);
    assert.equal(before.decision,'unchanged');
    const shifted=targets.map(t=>({...t,longitude:t.ref.layer==='natal'&&t.ref.name==='Sun'
      ? 5:t.longitude}));
    const originalPlan=planChartCoordinateEffects(scene,shifted);
    assert.equal(originalPlan.decision,'full-rebuild');
    // This moves an owner to the end without changing its parent ring,
    // UUID or original astronomical value.
    ring.add(sun);
    try {
      const reordered=planChartCoordinateEffects(scene,targets);
      const shiftedReordered=planChartCoordinateEffects(scene,shifted);
      assert.equal(reordered.decision,'unchanged');
      assert.deepEqual(shiftedReordered,originalPlan,
        'collision tie resolution must not follow current Three.js child order');
    } finally {
      ring.add(moon);
      ring.add(mercury);
    }
    assert.equal(planChartCoordinateEffects(scene,targets).decision,'unchanged');
    const originalSourceOrder=ring.userData.chartBodySourceOrder;
    ring.userData.chartBodySourceOrder=['Moon','Moon','Mercury'];
    const bad=planChartCoordinateEffects(scene,targets);
    assert.equal(bad.decision,'unsupported');
    assert.deepEqual(bad.impacts,[]);
    assert.ok(bad.issues.includes('invalid-wheel-source-order:natal:Sun'));
    ring.userData.chartBodySourceOrder=originalSourceOrder;
    assert.equal(planChartCoordinateEffects(scene,targets).decision,'unchanged');
  }
});
