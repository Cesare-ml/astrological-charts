import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';

const bundled=await build({
  stdin:{
    contents:`
      import * as THREE from 'three';
      export {THREE};
      export {applyIsolatedCoordinatePreview,isolatedSyntheticLeaderEndpoint} from './src/lib/renderers/chart-coordinate-isolated-preview';
      export {planChartCoordinateEffects} from './src/lib/renderers/chart-coordinate-plan';
      export {layoutChartGlyphLongitudes,chartBodyRenderAngles} from './src/lib/renderers/planet-layout';
    `,
    resolveDir:process.cwd(),sourcefile:'isolated-coordinate-node-entry.ts',loader:'ts'
  },
  bundle:true,platform:'node',format:'esm',target:'node22',write:false,logLevel:'silent'
});
const runtime=await import('data:text/javascript;base64,'+
  Buffer.from(bundled.outputFiles[0].text).toString('base64'));
const {THREE,applyIsolatedCoordinatePreview,planChartCoordinateEffects,
  layoutChartGlyphLongitudes,chartBodyRenderAngles,isolatedSyntheticLeaderEndpoint}=runtime;

function fixture({mirrored=false,outer=false,close=false,profile=false}={}) {
  const scene=new THREE.Scene();
  scene.userData.chartSyntheticIsolatedWheel=true;
  const wheel=new THREE.Group();
  wheel.rotation.z=0.27;
  if(mirrored) wheel.rotation.y=Math.PI;
  scene.add(wheel);
  const ring=new THREE.Group();
  wheel.add(ring);
  const original={Sun:10,Moon:close?11:100};
  // The legacy collision algorithm is stable only in original source order.
  // Mirror the real renderer's per-wheel provenance for the planner gate.
  ring.userData.chartBodySourceOrder=Object.freeze(Object.keys(original));
  const layout=layoutChartGlyphLongitudes(
    Object.fromEntries(Object.entries(original).map(([name,longitude])=>
      [name,{longitude}])),'longitude'
  );
  const targets=[],parts=new Map();
  for(const [name,longitude] of Object.entries(original)){
    const adjusted=layout[name].longitude;
    const angles=chartBodyRenderAngles(longitude,adjusted,38,0);
    const owner=new THREE.Group();
    owner.userData.chartPlanetBody={layer:'natal',name};
    owner.userData.chartBodyLayout={
      ringId:ring.uuid,coordinate:'longitude',original:longitude,adjusted,
      ascendant:38,degreesOffset:0,tickDegrees:angles.tickDegrees,
      glyphDisplacementDegrees:angles.glyphDisplacementDegrees,
      outerLeaderEnabled:outer,moonMarkerEnabled:false
    };
    ring.add(owner);
    const radius=0.64;
    const theta=THREE.MathUtils.degToRad(angles.glyphDegrees);
    const glyph=new THREE.Mesh(new THREE.PlaneGeometry(0.12,0.12),
      new THREE.MeshBasicMaterial({color:'#222222'}));
    glyph.userData.chartPlanet={layer:'natal',name};
    glyph.userData.chartBodyVisualRole='glyph';
    glyph.userData.chartAspectAngle=THREE.MathUtils.degToRad(angles.tickDegrees);
    glyph.position.set(-radius*Math.sin(theta),radius*Math.cos(theta),0);
    owner.add(glyph);
    const leader=(role)=>{
      const anchorY=role==='inner-leader'?0.25:0.75;
      const tip=profile
        ? isolatedSyntheticLeaderEndpoint(radius,angles.glyphDisplacementDegrees,anchorY,0.09)
        : new THREE.Vector3(0,0.25,0);
      const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(
        profile
          ? [tip,new THREE.Vector3(0,anchorY,0)]
          : [new THREE.Vector3(0,0.25,0),new THREE.Vector3(0.03,0.61,0)]
      ),new THREE.LineBasicMaterial());
      if(profile)line.userData.chartIsolatedLeaderSpec={anchorY,trim:0.09};
      line.userData.chartBodyVisualRole=role;
      line.rotation.z=THREE.MathUtils.degToRad(angles.tickDegrees);
      owner.add(line);
      return line;
    };
    const inner=leader('inner-leader');
    const outerLeader=outer?leader('outer-leader'):null;
    targets.push({ref:{layer:'natal',name},longitude});
    parts.set(name,{owner,glyph,inner,outerLeader});
  }
  return {scene,wheel,ring,parts,targets};
}
const targetsWith=(targets,name,value)=>targets.map(t=>({
  ref:{...t.ref},longitude:t.ref.name===name?value:t.longitude
}));
const near=(a,b)=>Math.abs(a-b)<1e-6;

test('coordinated synthetic glyph and leader rotation preserves geometry and metadata',()=>{
  for(const mirrored of [false,true]){
    const f=fixture({mirrored,outer:true});
    const sun=f.parts.get('Sun');
    const oldGeo=sun.inner.geometry,oldGlyphGeo=sun.glyph.geometry;
    const material=sun.glyph.material;
    const moonBefore=f.parts.get('Moon').glyph.position.clone();
    const input=targetsWith(f.targets,'Sun',15);
    const report=applyIsolatedCoordinatePreview(f.scene,input);
    assert.equal(report.status,'applied');
    assert.equal(report.updated,1);
    assert.equal(sun.inner.geometry,oldGeo);
    assert.equal(sun.glyph.geometry,oldGlyphGeo);
    assert.equal(sun.glyph.material,material);
    assert.ok(f.parts.get('Moon').glyph.position.equals(moonBefore));
    const expected=chartBodyRenderAngles(15,15,38,0);
    assert.ok(near(sun.inner.rotation.z,THREE.MathUtils.degToRad(expected.tickDegrees)));
    assert.ok(near(sun.outerLeader.rotation.z,sun.inner.rotation.z));
    const direction=THREE.MathUtils.degToRad(expected.glyphDegrees);
    assert.ok(near(sun.glyph.position.x,-0.64*Math.sin(direction)));
    assert.ok(near(sun.glyph.position.y,0.64*Math.cos(direction)));
    assert.ok(near(sun.glyph.userData.chartAspectAngle,sun.inner.rotation.z));
    assert.equal(sun.owner.userData.chartBodyLayout.original,15);
    assert.equal(sun.owner.userData.chartBodyLayout.ringId,f.ring.uuid);
    assert.equal(planChartCoordinateEffects(f.scene,input).decision,'unchanged');
    assert.equal(applyIsolatedCoordinatePreview(f.scene,input).status,'unchanged');
  }
});

test('unmarked scene, native aspects or untracked visuals are rejected untouched',()=>{
  const f=fixture();
  const sun=f.parts.get('Sun');
  const old=sun.glyph.position.clone();
  const next=targetsWith(f.targets,'Sun',15);
  delete f.scene.userData.chartSyntheticIsolatedWheel;
  assert.deepEqual(applyIsolatedCoordinatePreview(f.scene,next).issues,
    ['synthetic-fixture-required']);
  f.scene.userData.chartSyntheticIsolatedWheel=true;
  const native=new THREE.Line(new THREE.BufferGeometry(),
    new THREE.LineBasicMaterial());
  native.userData.chartNatalAspect={from:'Sun',to:'Moon',type:'quadrato'};
  f.scene.add(native);
  assert.equal(applyIsolatedCoordinatePreview(f.scene,next).status,'rejected');
  f.scene.remove(native);
  const extra=new THREE.Mesh(new THREE.PlaneGeometry(1,1),
    new THREE.MeshBasicMaterial());
  f.scene.add(extra);
  assert.deepEqual(applyIsolatedCoordinatePreview(f.scene,next).issues,
    ['untracked-scene-visuals']);
  assert.ok(sun.glyph.position.equals(old));
});

test('collision changes, even for a stationary neighbor, forbid the rotation-only path',()=>{
  const f=fixture({close:true});
  const sun=f.parts.get('Sun');
  const before=sun.glyph.position.clone();
  const input=targetsWith(f.targets,'Sun',5);
  const plan=planChartCoordinateEffects(f.scene,input);
  assert.equal(plan.decision,'full-rebuild');
  assert.equal(plan.impacts.some(i=>i.ref.name==='Moon'&&i.collisionPlacementChanged),true);
  const report=applyIsolatedCoordinatePreview(f.scene,input);
  assert.equal(report.status,'rejected');
  assert.ok(report.issues[0].startsWith('collision-geometry-changed:'));
  assert.ok(sun.glyph.position.equals(before));
});

test('all bodies are validated before the first mutation',()=>{
  const f=fixture();
  const originalSun=f.parts.get('Sun').glyph.position.clone();
  const moon=f.parts.get('Moon');
  moon.inner.rotation.z+=0.3; // stale line, though owner metadata is valid
  const input=f.targets.map(t=>({...t,longitude:t.longitude+4}));
  const report=applyIsolatedCoordinatePreview(f.scene,input);
  assert.equal(report.status,'rejected');
  assert.ok(report.issues.includes('stale-leader-geometry:natal:Moon'));
  assert.ok(f.parts.get('Sun').glyph.position.equals(originalSun));
  assert.equal(f.parts.get('Sun').owner.userData.chartBodyLayout.original,10);
});

test('stale symbol center and nested decorations must not be partially patched',()=>{
  const f=fixture();
  const sun=f.parts.get('Sun');
  const input=targetsWith(f.targets,'Sun',15);
  sun.glyph.position.x+=0.25;
  assert.ok(applyIsolatedCoordinatePreview(f.scene,input).issues
    .includes('stale-glyph-geometry:natal:Sun'));
  sun.glyph.position.x-=0.25;
  const extra=new THREE.Object3D();
  extra.userData.chartBodyVisualRole='dodecatemore';
  sun.owner.add(extra);
  const report=applyIsolatedCoordinatePreview(f.scene,input);
  assert.equal(report.status,'rejected');
  assert.ok(report.issues.includes('unsupported-decorations'));
});


test('runtime failure on the second body rolls every staged transform and layout back',()=>{
  const f=fixture({outer:true});
  const sun=f.parts.get('Sun'), moon=f.parts.get('Moon');
  const sunBefore=sun.glyph.position.clone();
  const moonBefore=moon.glyph.position.clone();
  const sunTickBefore=sun.inner.rotation.z;
  const sunOuterBefore=sun.outerLeader.rotation.z;
  const sunAngleBefore=sun.glyph.userData.chartAspectAngle;
  const sunLayoutBefore=sun.owner.userData.chartBodyLayout;
  const moonLayoutBefore=moon.owner.userData.chartBodyLayout;

  // The setter allows the old object during rollback but rejects its
  // replacement. Sun has already changed when Moon throws.
  Object.defineProperty(moon.owner.userData,'chartBodyLayout',{
    configurable:true,enumerable:true,
    get:()=>moonLayoutBefore,
    set(next){if(next!==moonLayoutBefore)throw Error('synthetic write failure');}
  });
  try {
    const input=f.targets.map(t=>({...t,longitude:t.longitude+4}));
    const report=applyIsolatedCoordinatePreview(f.scene,input);
    assert.equal(report.status,'rejected');
    assert.deepEqual(report.issues,['transaction-rolled-back']);
    assert.equal(report.updated,0);
    assert.ok(sun.glyph.position.equals(sunBefore));
    assert.ok(moon.glyph.position.equals(moonBefore));
    assert.equal(sun.inner.rotation.z,sunTickBefore);
    assert.equal(sun.outerLeader.rotation.z,sunOuterBefore);
    assert.equal(sun.glyph.userData.chartAspectAngle,sunAngleBefore);
    assert.equal(sun.owner.userData.chartBodyLayout,sunLayoutBefore);
    assert.equal(moon.owner.userData.chartBodyLayout,moonLayoutBefore);
  } finally {
    delete moon.owner.userData.chartBodyLayout;
    moon.owner.userData.chartBodyLayout=moonLayoutBefore;
  }
  assert.equal(planChartCoordinateEffects(f.scene,f.targets).decision,'unchanged');
});

test('role-labelled objects without real line geometry cannot be edited',()=>{
  const f=fixture();
  const moon=f.parts.get('Moon');
  moon.owner.remove(moon.inner);
  const imitation=new THREE.Object3D();
  imitation.userData.chartBodyVisualRole='inner-leader';
  moon.owner.add(imitation);
  const sun=f.parts.get('Sun');
  const before=sun.glyph.position.clone();
  const report=applyIsolatedCoordinatePreview(f.scene,
    f.targets.map(t=>({...t,longitude:t.longitude+4})));
  assert.equal(report.status,'rejected');
  assert.ok(report.issues.includes('stale-leader-geometry:natal:Moon'));
  assert.ok(sun.glyph.position.equals(before));
  assert.equal(sun.owner.userData.chartBodyLayout.original,10);
});


test('stationary bodies must be geometrically valid before any other planet moves',()=>{
  for (const mirrored of [false,true]) {
    const f=fixture({mirrored,outer:true});
    const sun=f.parts.get('Sun'), moon=f.parts.get('Moon');
    const targets=targetsWith(f.targets,'Sun',15);
    const originalSun=sun.glyph.position.clone();
    const originalMoon=moon.glyph.position.clone();
    const originalMoonLeader=moon.inner.rotation.z;
    const originalLayout=sun.owner.userData.chartBodyLayout;

    moon.glyph.position.x+=0.04;
    const staleGlyph=applyIsolatedCoordinatePreview(f.scene,targets);
    assert.equal(staleGlyph.status,'rejected');
    assert.ok(staleGlyph.issues.includes('stale-glyph-geometry:natal:Moon'));
    assert.equal(staleGlyph.updated,0);
    assert.ok(sun.glyph.position.equals(originalSun));
    assert.equal(sun.owner.userData.chartBodyLayout,originalLayout);
    moon.glyph.position.copy(originalMoon);

    moon.inner.rotation.z+=0.15;
    const staleLeader=applyIsolatedCoordinatePreview(f.scene,targets);
    assert.equal(staleLeader.status,'rejected');
    assert.ok(staleLeader.issues.includes('stale-leader-geometry:natal:Moon'));
    assert.equal(staleLeader.updated,0);
    assert.ok(sun.glyph.position.equals(originalSun));
    moon.inner.rotation.z=originalMoonLeader;

    const restored=applyIsolatedCoordinatePreview(f.scene,targets);
    assert.equal(restored.status,'applied');
    assert.equal(restored.updated,1);
    assert.ok(moon.glyph.position.equals(originalMoon));
    assert.equal(moon.inner.rotation.z,originalMoonLeader);
  }
});


test('unchanged coordinate requests reject stale glyph and leader geometry',()=>{
  for(const mirrored of [false,true]){
    const f=fixture({mirrored,outer:true});
    const sun=f.parts.get('Sun'),moon=f.parts.get('Moon');
    const sourceTargets=structuredClone(f.targets);
    const sourceLayout=sun.owner.userData.chartBodyLayout;
    const glyphPosition=moon.glyph.position.clone();
    const innerAngle=moon.inner.rotation.z;

    assert.equal(planChartCoordinateEffects(f.scene,f.targets).decision,'unchanged');
    assert.equal(applyIsolatedCoordinatePreview(f.scene,f.targets).status,'unchanged');
    moon.glyph.position.x+=0.075;
    const badGlyph=applyIsolatedCoordinatePreview(f.scene,f.targets);
    assert.equal(badGlyph.status,'rejected');
    assert.equal(badGlyph.updated,0);
    assert.ok(badGlyph.issues.includes('stale-glyph-geometry:natal:Moon'));
    assert.equal(sun.owner.userData.chartBodyLayout,sourceLayout);
    moon.glyph.position.copy(glyphPosition);

    moon.inner.rotation.z+=0.15;
    const badLeader=applyIsolatedCoordinatePreview(f.scene,f.targets);
    assert.equal(badLeader.status,'rejected');
    assert.equal(badLeader.updated,0);
    assert.ok(badLeader.issues.includes('stale-leader-geometry:natal:Moon'));
    moon.inner.rotation.z=innerAngle;

    const badPositions=moon.inner.geometry.getAttribute('position');
    moon.inner.geometry.deleteAttribute('position');
    try{
      const missingGeometry=applyIsolatedCoordinatePreview(f.scene,f.targets);
      assert.equal(missingGeometry.status,'rejected');
      assert.ok(missingGeometry.issues.includes('stale-leader-geometry:natal:Moon'));
    }finally{
      moon.inner.geometry.setAttribute('position',badPositions);
    }
    assert.equal(applyIsolatedCoordinatePreview(f.scene,f.targets).status,'unchanged');
    assert.deepEqual(f.targets,sourceTargets);
    assert.ok(moon.glyph.position.equals(glyphPosition));
    assert.equal(moon.inner.rotation.z,innerAngle);
    assert.equal(sun.owner.userData.chartBodyLayout,sourceLayout);
  }
});


// This test uses the real legacy two-pass placement to force a stationary
// Moon to move when the Sun's longitude changes. Both line endpoints
// must update in the same synthetic-only transaction.
test('collision displacement patches both leader endpoints and moving neighbor glyphs',()=>{
  for(const mirrored of [false,true]){
    const f=fixture({mirrored,close:true,profile:true,outer:true});
    const sun=f.parts.get('Sun'),moon=f.parts.get('Moon');
    const oldMoonCenter=moon.glyph.position.clone();
    const oldSunGeometry=sun.inner.geometry,oldMoonGeometry=moon.inner.geometry;
    const oldMoonLine=moon.inner.geometry.getAttribute('position').getX(0);
    const input=targetsWith(f.targets,'Sun',5);
    const prior=planChartCoordinateEffects(f.scene,input);
    assert.equal(prior.decision,'full-rebuild');
    assert.equal(prior.impacts.some(i=>i.ref.name==='Moon'&&i.collisionPlacementChanged),true);
    const outcome=applyIsolatedCoordinatePreview(f.scene,input);
    assert.equal(outcome.status,'applied');
    assert.ok(outcome.updated>=1);
    assert.equal(sun.inner.geometry,oldSunGeometry);
    assert.equal(moon.inner.geometry,oldMoonGeometry);
    assert.ok(!moon.glyph.position.equals(oldMoonCenter));
    assert.notEqual(moon.inner.geometry.getAttribute('position').getX(0),oldMoonLine);
    assert.equal(planChartCoordinateEffects(f.scene,input).decision,'unchanged');
    assert.equal(applyIsolatedCoordinatePreview(f.scene,input).status,'unchanged');
  }
});

test('changed collision refuses unprofiled, stale, or shared leader geometries',()=>{
  const input=f=>targetsWith(f.targets,'Sun',5);
  const unprofiled=fixture({close:true});
  assert.equal(applyIsolatedCoordinatePreview(unprofiled.scene,input(unprofiled)).status,'rejected');
  assert.ok(applyIsolatedCoordinatePreview(unprofiled.scene,input(unprofiled)).issues
    .some(i=>i.startsWith('collision-geometry-changed:')));
  const stale=fixture({close:true,profile:true});
  const moon=stale.parts.get('Moon');
  // Sun's collision offset is unchanged (0°); Moon changes 6° -> 1°.
  // Corrupt the leader that must be geometrically rebuilt.
  moon.inner.geometry.getAttribute('position').setX(0,3);
  const bad=applyIsolatedCoordinatePreview(stale.scene,input(stale));
  assert.equal(bad.status,'rejected');
  assert.ok(bad.issues.some(i=>i.startsWith('stale-leader-endpoints:')));
  const nonfinite=fixture({close:true,profile:true});
  const nanLeader=nonfinite.parts.get('Moon').inner;
  nanLeader.geometry.getAttribute('position').setX(0,NaN);
  const invalid=applyIsolatedCoordinatePreview(nonfinite.scene,input(nonfinite));
  assert.equal(invalid.status,'rejected');
  assert.ok(invalid.issues.some(i=>i.startsWith('stale-leader-endpoints:')));

  const shared=fixture({close:true,profile:true});
  const bodies=[shared.parts.get('Sun'),shared.parts.get('Moon')];
  bodies[1].inner.geometry=bodies[0].inner.geometry;
  const before=bodies[0].glyph.position.clone();
  const refused=applyIsolatedCoordinatePreview(shared.scene,input(shared));
  assert.equal(refused.status,'rejected');
  assert.ok(refused.issues.some(i=>i.startsWith('shared-leader-geometry:')));
  assert.ok(bodies[0].glyph.position.equals(before));
});

test('failed second-body geometry write restores first body positions and endpoints',()=>{
  const f=fixture({close:true,profile:true,outer:true});
  const sun=f.parts.get('Sun'),moon=f.parts.get('Moon');
  const input=targetsWith(f.targets,'Sun',5);
  const sunOld=sun.glyph.position.clone();
  const sunEndpoint=sun.inner.geometry.getAttribute('position').getX(0);
  const sunLayout=sun.owner.userData.chartBodyLayout;
  const moonOld=moon.owner.userData.chartBodyLayout;
  Object.defineProperty(moon.owner.userData,'chartBodyLayout',{
    configurable:true,enumerable:true,get:()=>moonOld,
    set(value){if(value!==moonOld)throw Error('synthetic transaction fault');}
  });
  try {
    const report=applyIsolatedCoordinatePreview(f.scene,input);
    assert.equal(report.status,'rejected');
    assert.deepEqual(report.issues,['transaction-rolled-back']);
    assert.ok(sun.glyph.position.equals(sunOld));
    assert.equal(sun.inner.geometry.getAttribute('position').getX(0),sunEndpoint);
    assert.equal(sun.owner.userData.chartBodyLayout,sunLayout);
  } finally {
    delete moon.owner.userData.chartBodyLayout;
    moon.owner.userData.chartBodyLayout=moonOld;
  }
  assert.equal(planChartCoordinateEffects(f.scene,f.targets).decision,'unchanged');
});


test('profiled leader endpoints are validated on stationary and unchanged bodies',()=>{
  for (const mirrored of [false,true]) {
    const f=fixture({mirrored,profile:true,outer:true});
    const sun=f.parts.get('Sun'), moon=f.parts.get('Moon');
    const next=targetsWith(f.targets,'Sun',15);
    const sunBefore=sun.glyph.position.clone();
    const sunLayout=sun.owner.userData.chartBodyLayout;
    assert.equal(applyIsolatedCoordinatePreview(f.scene,f.targets).status,'unchanged');
    const positions=moon.inner.geometry.getAttribute('position');
    const prior=positions.getX(0);
    positions.setX(0,prior+0.04);
    try {
      for (const requested of [f.targets,next]) {
        const failed=applyIsolatedCoordinatePreview(f.scene,requested);
        assert.equal(failed.status,'rejected');
        assert.equal(failed.updated,0);
        assert.ok(failed.issues.includes('stale-leader-endpoints:natal:Moon'));
        assert.ok(sun.glyph.position.equals(sunBefore));
        assert.equal(sun.owner.userData.chartBodyLayout,sunLayout);
      }
    } finally {
      positions.setX(0,prior);
    }
    const previousSpec=moon.inner.userData.chartIsolatedLeaderSpec;
    moon.inner.userData.chartIsolatedLeaderSpec={anchorY:Infinity,trim:0.09};
    try {
      const invalid=applyIsolatedCoordinatePreview(f.scene,f.targets);
      assert.equal(invalid.status,'rejected');
      assert.equal(invalid.updated,0);
      assert.ok(invalid.issues.includes('collision-geometry-changed:natal:Moon'));
    } finally {
      moon.inner.userData.chartIsolatedLeaderSpec=previousSpec;
    }
    assert.equal(applyIsolatedCoordinatePreview(f.scene,f.targets).status,'unchanged');
    const applied=applyIsolatedCoordinatePreview(f.scene,next);
    assert.equal(applied.status,'applied');
    assert.equal(applied.updated,1);
    assert.equal(applyIsolatedCoordinatePreview(f.scene,next).status,'unchanged');
  }
});


test('distinct line geometries cannot mutate a shared position buffer',()=>{
  for(const mirrored of [false,true]){
    const f=fixture({mirrored,close:true,profile:true,outer:true});
    const moon=f.parts.get('Moon');
    const sun=f.parts.get('Sun');
    const innerPosition=moon.inner.geometry.getAttribute('position');
    const originalOuterPosition=moon.outerLeader.geometry.getAttribute('position');
    const originalOuterSpec=moon.outerLeader.userData.chartIsolatedLeaderSpec;
    const sunBefore=sun.glyph.position.clone();
    const moonBefore=moon.glyph.position.clone();
    const innerX=innerPosition.getX(0);
    const next=targetsWith(f.targets,'Sun',5);
    assert.notEqual(moon.inner.geometry,moon.outerLeader.geometry,
      'this regression uses distinct BufferGeometry objects');
    // Make both leaders' independent geometries share a live position
    // attribute with the same original anchor/profile. An in-place write
    // must never modify that aliased backing buffer.
    moon.outerLeader.geometry.setAttribute('position',innerPosition);
    moon.outerLeader.userData.chartIsolatedLeaderSpec={
      ...moon.inner.userData.chartIsolatedLeaderSpec
    };
    try{
      const rejected=applyIsolatedCoordinatePreview(f.scene,next);
      assert.equal(rejected.status,'rejected');
      assert.equal(rejected.updated,0);
      assert.ok(rejected.issues.includes('shared-leader-attribute:natal:Moon'),
        rejected.issues.join(','));
      assert.ok(sun.glyph.position.equals(sunBefore));
      assert.ok(moon.glyph.position.equals(moonBefore));
      assert.equal(innerPosition.getX(0),innerX);
      assert.equal(planChartCoordinateEffects(f.scene,f.targets).decision,'unchanged');
    }finally{
      moon.outerLeader.geometry.setAttribute('position',originalOuterPosition);
      moon.outerLeader.userData.chartIsolatedLeaderSpec=originalOuterSpec;
    }
    assert.equal(applyIsolatedCoordinatePreview(f.scene,next).status,'applied');
    assert.equal(applyIsolatedCoordinatePreview(f.scene,next).status,'unchanged');
  }
});


test('distinct BufferAttributes sharing a typed-array backing store fail closed',()=>{
  for (const mirrored of [false,true]) {
    const f=fixture({mirrored,close:true,profile:true,outer:true});
    const sun=f.parts.get('Sun'),moon=f.parts.get('Moon');
    const moonInner=moon.inner.geometry.getAttribute('position');
    const moonOuter=moon.outerLeader.geometry.getAttribute('position');
    const savedOuterSpec=moon.outerLeader.userData.chartIsolatedLeaderSpec;
    const sunBefore=sun.glyph.position.clone();
    const moonBefore=moon.glyph.position.clone();
    const oldInnerX=moonInner.getX(0);
    const next=targetsWith(f.targets,'Sun',5);

    // New THREE.BufferAttribute and new Float32Array view, but the SAME
    // underlying memory as Moon's other leader. The two geometry objects
    // and attribute instances are not equal.
    const aliasedView=new Float32Array(
      moonInner.array.buffer,moonInner.array.byteOffset,moonInner.array.length
    );
    const alias=new THREE.BufferAttribute(aliasedView,3);
    assert.notEqual(alias,moonInner);
    assert.notEqual(alias.array,moonInner.array);
    assert.equal(alias.array.buffer,moonInner.array.buffer);
    assert.notEqual(moon.inner.geometry,moon.outerLeader.geometry);
    moon.outerLeader.geometry.setAttribute('position',alias);
    moon.outerLeader.userData.chartIsolatedLeaderSpec={
      ...moon.inner.userData.chartIsolatedLeaderSpec
    };
    try {
      const report=applyIsolatedCoordinatePreview(f.scene,next);
      assert.equal(report.status,'rejected');
      assert.equal(report.updated,0);
      assert.ok(report.issues.includes('shared-leader-storage:natal:Moon'),
        report.issues.join(','));
      assert.ok(sun.glyph.position.equals(sunBefore));
      assert.ok(moon.glyph.position.equals(moonBefore));
      assert.equal(moonInner.getX(0),oldInnerX);
      assert.equal(planChartCoordinateEffects(f.scene,f.targets).decision,'unchanged');
    } finally {
      moon.outerLeader.geometry.setAttribute('position',moonOuter);
      moon.outerLeader.userData.chartIsolatedLeaderSpec=savedOuterSpec;
    }
    assert.equal(applyIsolatedCoordinatePreview(f.scene,next).status,'applied');
    assert.equal(applyIsolatedCoordinatePreview(f.scene,next).status,'unchanged');
  }
});


test('collision bounds caches update in place and restore their original objects on rollback',()=>{
  for(const mirrored of [false,true]){
    const f=fixture({mirrored,close:true,profile:true,outer:true});
    const sun=f.parts.get('Sun'),moon=f.parts.get('Moon');
    const changed=targetsWith(f.targets,'Sun',5);
    const lines=[sun.inner,sun.outerLeader,moon.inner,moon.outerLeader];
    // Verify nullable lazy caches as well as previously cached bounds.
    for(const line of [sun.inner,moon.inner]){
      line.geometry.computeBoundingSphere();
      line.geometry.computeBoundingBox();
    }
    // Moon outer WILL change during the collision patch, but starts with
    // neither lazy bounds cache populated. A failed transaction must
    // restore both null values, not retain a newly calculated sphere.
    assert.equal(moon.outerLeader.geometry.boundingSphere,null);
    assert.equal(moon.outerLeader.geometry.boundingBox,null);
    const previous=lines.map(line=>({
      line,
      position:line.geometry.getAttribute('position').array.slice(),
      sphere:line.geometry.boundingSphere,
      sphereValue:line.geometry.boundingSphere?.clone() ?? null,
      box:line.geometry.boundingBox,
      boxValue:line.geometry.boundingBox?.clone() ?? null
    }));
    assert.equal(previous[1].box,null,'outer Sun box remains lazy');
    assert.equal(previous[3].sphere,null,'changing outer Moon sphere starts lazy');
    assert.equal(previous[3].box,null,'changing outer Moon box starts lazy');
    const moonLayout=moon.owner.userData.chartBodyLayout;
    Object.defineProperty(moon.owner.userData,'chartBodyLayout',{
      configurable:true,enumerable:true,
      get:()=>moonLayout,
      set(next){if(next!==moonLayout)throw Error('synthetic bounding rollback fault');}
    });
    try{
      const report=applyIsolatedCoordinatePreview(f.scene,changed);
      assert.equal(report.status,'rejected');
      assert.deepEqual(report.issues,['transaction-rolled-back']);
      assert.equal(report.updated,0);
      for(const entry of previous){
        assert.deepEqual(
          Array.from(entry.line.geometry.getAttribute('position').array),
          Array.from(entry.position),
          'all endpoint vertex values must be restored');
        assert.equal(entry.line.geometry.boundingSphere,entry.sphere,
          'restore original cached sphere identity');
        assert.equal(entry.line.geometry.boundingBox,entry.box,
          'restore original cached box identity');
        if(entry.sphereValue)
          assert.ok(entry.sphere.equals(entry.sphereValue));
        if(entry.boxValue)
          assert.ok(entry.box.equals(entry.boxValue));
      }
    }finally{
      delete moon.owner.userData.chartBodyLayout;
      moon.owner.userData.chartBodyLayout=moonLayout;
    }
    assert.equal(planChartCoordinateEffects(f.scene,f.targets).decision,'unchanged');
    const success=applyIsolatedCoordinatePreview(f.scene,changed);
    assert.equal(success.status,'applied');
    for(const entry of previous){
      if(entry.sphere)
        assert.equal(entry.line.geometry.boundingSphere,entry.sphere);
      else if(entry.line===moon.outerLeader)
        assert.ok(entry.line.geometry.boundingSphere instanceof THREE.Sphere,
          'changed leader receives a lazily computed sphere on success');
      else
        assert.equal(entry.line.geometry.boundingSphere,null);
      assert.equal(entry.line.geometry.boundingBox,entry.box);
      if(entry.box){
        const expected=new THREE.Box3().setFromBufferAttribute(
          entry.line.geometry.getAttribute('position'));
        assert.ok(entry.box.equals(expected),'cached box must match new vertices');
      }
    }
    assert.equal(applyIsolatedCoordinatePreview(f.scene,changed).status,'unchanged');
  }
});


test('two independent synthetic charts keep geometry, layout and bounds isolated',()=>{
  for(const mirrored of [false,true]){
    const first=fixture({mirrored,close:true,profile:true,outer:true});
    const second=fixture({mirrored:!mirrored,close:true,profile:true,outer:true});
    const firstMoon=first.parts.get('Moon');
    const secondMoon=second.parts.get('Moon');
    const beforeSecond={
      position:secondMoon.glyph.position.clone(),
      inner:secondMoon.inner.geometry.getAttribute('position').array.slice(),
      outer:secondMoon.outerLeader.geometry.getAttribute('position').array.slice(),
      layout:secondMoon.owner.userData.chartBodyLayout,
      geometry:secondMoon.inner.geometry
    };
    const changeFirst=targetsWith(first.targets,'Sun',5);
    const changeSecond=targetsWith(second.targets,'Sun',5);
    const resultA=applyIsolatedCoordinatePreview(first.scene,changeFirst,[second.scene]);
    assert.equal(resultA.status,'applied');
    assert.ok(resultA.updated>=1);
    assert.equal(planChartCoordinateEffects(first.scene,changeFirst).decision,'unchanged');
    assert.ok(secondMoon.glyph.position.equals(beforeSecond.position));
    assert.deepEqual(secondMoon.inner.geometry.getAttribute('position').array,
      beforeSecond.inner);
    assert.deepEqual(secondMoon.outerLeader.geometry.getAttribute('position').array,
      beforeSecond.outer);
    assert.equal(secondMoon.owner.userData.chartBodyLayout,beforeSecond.layout);
    assert.equal(secondMoon.inner.geometry,beforeSecond.geometry);
    assert.equal(applyIsolatedCoordinatePreview(first.scene,changeFirst,[second.scene]).status,
      'unchanged');
    const resultB=applyIsolatedCoordinatePreview(second.scene,changeSecond,[first.scene]);
    assert.equal(resultB.status,'applied');
    assert.ok(resultB.updated>=1);
    assert.equal(applyIsolatedCoordinatePreview(second.scene,changeSecond,[first.scene]).status,
      'unchanged');
    assert.equal(planChartCoordinateEffects(first.scene,changeFirst).decision,'unchanged');
  }
});

test('peer roots prevent writes to aliased geometry, attributes and backing storage',()=>{
  for(const mode of ['geometry','attribute','storage']){
    const first=fixture({close:true,profile:true,outer:true});
    const second=fixture({close:true,profile:true,outer:true});
    const moon=first.parts.get('Moon');
    const external=second.parts.get('Moon');
    const oldExternalGeometry=external.inner.geometry;
    const oldExternalAttribute=external.inner.geometry.getAttribute('position');
    const mainAttr=moon.inner.geometry.getAttribute('position');
    const firstBefore=moon.glyph.position.clone();
    const peerBefore=external.glyph.position.clone();
    const peerLayout=external.owner.userData.chartBodyLayout;
    const input=targetsWith(first.targets,'Sun',5);
    if(mode==='geometry'){
      external.inner.geometry=moon.inner.geometry;
    } else if(mode==='attribute'){
      external.inner.geometry.setAttribute('position',mainAttr);
    } else {
      external.inner.geometry.setAttribute('position',new THREE.BufferAttribute(
        new Float32Array(mainAttr.array.buffer,
          mainAttr.array.byteOffset,mainAttr.array.length),3));
    }
    try{
      const refused=applyIsolatedCoordinatePreview(first.scene,input,[second.scene]);
      assert.equal(refused.status,'rejected');
      assert.equal(refused.updated,0);
      const expected={
        geometry:'shared-leader-geometry:natal:Moon',
        attribute:'shared-leader-attribute:natal:Moon',
        storage:'shared-leader-storage:natal:Moon'
      }[mode];
      assert.ok(refused.issues.includes(expected),refused.issues.join(','));
      assert.ok(moon.glyph.position.equals(firstBefore));
      assert.ok(external.glyph.position.equals(peerBefore));
      assert.equal(external.owner.userData.chartBodyLayout,peerLayout);
      assert.equal(planChartCoordinateEffects(first.scene,first.targets).decision,'unchanged');
    }finally{
      external.inner.geometry=oldExternalGeometry;
      oldExternalGeometry.setAttribute('position',oldExternalAttribute);
    }
    const success=applyIsolatedCoordinatePreview(first.scene,input,[second.scene]);
    assert.equal(success.status,'applied');
    assert.equal(applyIsolatedCoordinatePreview(first.scene,input,[second.scene]).status,
      'unchanged');
    assert.ok(external.glyph.position.equals(peerBefore));
  }
});

test('peer roots must be distinct disjoint synthetic objects',()=>{
  const first=fixture({close:true,profile:true,outer:true});
  const second=fixture({close:true,profile:true,outer:true});
  const target=targetsWith(first.targets,'Sun',5);
  const sunBefore=first.parts.get('Sun').glyph.position.clone();
  const other=new THREE.Group();
  const cases=[
    [first.scene],
    [second.scene,second.scene],
    [second.scene,other],
    [first.ring],
    [null],
    'not-an-array'
  ];
  for(const peers of cases){
    const refused=applyIsolatedCoordinatePreview(first.scene,target,peers);
    assert.equal(refused.status,'rejected');
    assert.deepEqual(refused.issues,['invalid-synthetic-peer-roots']);
    assert.equal(refused.updated,0);
    assert.ok(first.parts.get('Sun').glyph.position.equals(sunBefore));
  }
  assert.equal(applyIsolatedCoordinatePreview(first.scene,target,[second.scene]).status,
    'applied');
});


test('peer Points geometry can never share a collision leader backing buffer',()=>{
  for (const mirrored of [false,true]) {
    const primary=fixture({mirrored,close:true,profile:true,outer:true});
    const peer=fixture({mirrored:!mirrored,close:true,profile:true,outer:true});
    const moon=primary.parts.get('Moon');
    const sun=primary.parts.get('Sun');
    const attr=moon.inner.geometry.getAttribute('position');
    const target=targetsWith(primary.targets,'Sun',5);
    const sunBefore=sun.glyph.position.clone();
    const endpointBefore=attr.array.slice();
    const peerBefore=peer.parts.get('Sun').glyph.position.clone();

    // Points is NOT a subclass of THREE.Mesh or THREE.Line. Both an
    // identical geometry and independent views of its backing storage
    // must be visible to the peer-resource isolation gate.
    const sameGeometry=new THREE.Points(
      moon.inner.geometry,new THREE.PointsMaterial({size:0.01}));
    peer.scene.add(sameGeometry);
    try {
      const result=applyIsolatedCoordinatePreview(primary.scene,target,[peer.scene]);
      assert.equal(result.status,'rejected');
      assert.equal(result.updated,0);
      assert.ok(result.issues.includes('shared-leader-geometry:natal:Moon'));
    } finally {
      peer.scene.remove(sameGeometry);
      sameGeometry.material.dispose();
    }

    const pointsBuffer=new THREE.BufferAttribute(
      new Float32Array(attr.array.buffer,attr.array.byteOffset,attr.array.length),3);
    const points=new THREE.Points(
      new THREE.BufferGeometry().setAttribute('position',pointsBuffer),
      new THREE.PointsMaterial({size:0.01}));
    peer.scene.add(points);
    try {
      const result=applyIsolatedCoordinatePreview(primary.scene,target,[peer.scene]);
      assert.equal(result.status,'rejected');
      assert.equal(result.updated,0);
      assert.ok(result.issues.includes('shared-leader-storage:natal:Moon'));
      assert.ok(sun.glyph.position.equals(sunBefore));
      assert.deepEqual(attr.array,endpointBefore);
      assert.ok(peer.parts.get('Sun').glyph.position.equals(peerBefore));
      assert.equal(planChartCoordinateEffects(primary.scene,primary.targets).decision,
        'unchanged');
    } finally {
      peer.scene.remove(points);
      points.geometry.dispose();
      points.material.dispose();
    }
    assert.equal(applyIsolatedCoordinatePreview(primary.scene,target,[peer.scene]).status,
      'applied');
    assert.equal(applyIsolatedCoordinatePreview(primary.scene,target,[peer.scene]).status,
      'unchanged');
  }
});


test('alternating two isolated charts survives 48 updates and a failed collision transaction',()=>{
  for(const mirrored of [false,true]){
    const first=fixture({mirrored,close:true,profile:true,outer:true});
    const second=fixture({mirrored:!mirrored,close:true,profile:true,outer:true});
    const roots=[first,second];
    const baseline=roots.map(f=>new Map([...f.parts].map(([name,body])=>[name,{
      glyphGeometry:body.glyph.geometry,glyphMaterial:body.glyph.material,
      innerGeometry:body.inner.geometry,innerMaterial:body.inner.material,
      outerGeometry:body.outerLeader.geometry,outerMaterial:body.outerLeader.material,
      innerAttribute:body.inner.geometry.getAttribute('position'),
      outerAttribute:body.outerLeader.geometry.getAttribute('position')
    }])));
    const capture=f=>new Map([...f.parts].map(([name,body])=>[name,{
      position:body.glyph.position.clone(),tick:body.inner.rotation.z,
      outerTick:body.outerLeader.rotation.z,
      aspect:body.glyph.userData.chartAspectAngle,
      layout:body.owner.userData.chartBodyLayout,
      inner:body.inner.geometry.getAttribute('position').array.slice(),
      outer:body.outerLeader.geometry.getAttribute('position').array.slice(),
      sphere:body.inner.geometry.boundingSphere,
      box:body.inner.geometry.boundingBox
    }]));
    const unchanged=(f,snapshot)=>{
      for(const [name,expected] of snapshot){
        const body=f.parts.get(name);
        assert.ok(body.glyph.position.equals(expected.position),name+' glyph');
        assert.equal(body.inner.rotation.z,expected.tick,name+' inner rotation');
        assert.equal(body.outerLeader.rotation.z,expected.outerTick,name+' outer rotation');
        assert.equal(body.glyph.userData.chartAspectAngle,expected.aspect);
        assert.equal(body.owner.userData.chartBodyLayout,expected.layout);
        assert.deepEqual(body.inner.geometry.getAttribute('position').array,expected.inner);
        assert.deepEqual(body.outerLeader.geometry.getAttribute('position').array,expected.outer);
        assert.equal(body.inner.geometry.boundingSphere,expected.sphere);
        assert.equal(body.inner.geometry.boundingBox,expected.box);
      }
    };
    for(const [index,f] of roots.entries()){
      for(const [name,body] of f.parts){
        const expected=baseline[index].get(name);
        assert.equal(body.glyph.geometry,expected.glyphGeometry);
        assert.equal(body.glyph.material,expected.glyphMaterial);
      }
    }
    // Each chart toggles independently 10° -> 5° -> 10°. A failure
    // during Moon metadata assignment must revert both leaders and caches
    // without changing the other chart, then allow the same request.
    for(let step=0;step<48;step++){
      const activeIndex=step%2,active=roots[activeIndex],peer=roots[1-activeIndex];
      const peerBefore=capture(peer);
      const activeBefore=capture(active);
      const operation=Math.floor(step/2);
      const targets=targetsWith(active.targets,'Sun',operation%2===0?5:10);
      if(step===17){
        const moon=active.parts.get('Moon'),old=moon.owner.userData.chartBodyLayout;
        Object.defineProperty(moon.owner.userData,'chartBodyLayout',{
          configurable:true,enumerable:true,get:()=>old,
          set(next){if(next!==old)throw Error('synthetic multi-chart fault');}
        });
        try{
          const rejected=applyIsolatedCoordinatePreview(active.scene,targets,[peer.scene]);
          assert.equal(rejected.status,'rejected');
          assert.equal(rejected.updated,0);
          assert.deepEqual(rejected.issues,['transaction-rolled-back']);
          unchanged(active,activeBefore);
          unchanged(peer,peerBefore);
        }finally{
          delete moon.owner.userData.chartBodyLayout;
          moon.owner.userData.chartBodyLayout=old;
        }
      }
      const result=applyIsolatedCoordinatePreview(active.scene,targets,[peer.scene]);
      assert.equal(result.status,'applied','cycle '+step+' '+result.issues.join(','));
      assert.ok(result.updated>=1);
      assert.equal(planChartCoordinateEffects(active.scene,targets).decision,'unchanged');
      assert.equal(applyIsolatedCoordinatePreview(active.scene,targets,[peer.scene]).status,
        'unchanged');
      unchanged(peer,peerBefore);
      for(const [name,body] of active.parts){
        const expected=baseline[activeIndex].get(name);
        assert.equal(body.glyph.geometry,expected.glyphGeometry);
        assert.equal(body.glyph.material,expected.glyphMaterial);
        assert.equal(body.inner.geometry,expected.innerGeometry);
        assert.equal(body.inner.material,expected.innerMaterial);
        assert.equal(body.outerLeader.geometry,expected.outerGeometry);
        assert.equal(body.outerLeader.material,expected.outerMaterial);
        assert.equal(body.inner.geometry.getAttribute('position'),expected.innerAttribute);
        assert.equal(body.outerLeader.geometry.getAttribute('position'),expected.outerAttribute);
      }
    }
    // 24 operations per scene means both are back at their starting 10°.
    for(const f of roots){
      assert.equal(planChartCoordinateEffects(f.scene,f.targets).decision,'unchanged');
      assert.equal(applyIsolatedCoordinatePreview(f.scene,f.targets,
        roots.filter(other=>other!==f).map(other=>other.scene)).status,'unchanged');
    }
  }
});
