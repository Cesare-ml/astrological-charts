import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';

const bundled=await build({
  stdin:{
    contents:`
      import * as THREE from 'three';
      export {THREE};
      export {applyIsolatedCoordinatePreview} from './src/lib/renderers/chart-coordinate-isolated-preview';
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
  layoutChartGlyphLongitudes,chartBodyRenderAngles}=runtime;

function fixture({mirrored=false,outer=false,close=false}={}) {
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
      const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0,0.25,0),new THREE.Vector3(0.03,0.61,0)
      ]),new THREE.LineBasicMaterial());
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
