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
