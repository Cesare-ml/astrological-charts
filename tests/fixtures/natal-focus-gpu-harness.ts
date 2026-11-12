import * as THREE from 'three';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { PlanetInteractionController } from '../../src/lib/renderers/planet-interaction.controller';

declare global {
  interface Window {
    runNatalFocusGpuProbe?: () => Record<string, boolean | number>;
  }
}

/** Real WebGL accounting of temporary native Line2 foreground copies.
 * Uses only synthetic wheel strokes and glyphs, no private chart data.
 */
window.runNatalFocusGpuProbe = () => {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 160;
  Object.assign(canvas.style, {position:'fixed',left:'0px',top:'0px',
    width:'160px',height:'160px',zIndex:'99999'});
  document.body.appendChild(canvas);
  const renderer = new THREE.WebGLRenderer({canvas,antialias:false});
  renderer.setPixelRatio(1);
  renderer.setSize(160,160,false);
  const camera = new THREE.OrthographicCamera(-1,1,1,-1,0.1,10);
  camera.position.z = 3;
  camera.updateProjectionMatrix();
  const scene = new THREE.Scene();
  const wheel = new THREE.Group();
  scene.add(wheel);
  const glyphs: THREE.Mesh[] = [];
  for (const [name,x] of [['Sun',-0.4],['Moon',0],['Venus',0.4]] as const) {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.1,0.1),
      new THREE.MeshBasicMaterial({color:'#171717',side:THREE.DoubleSide}));
    mesh.position.x = x;
    mesh.userData['chartPlanet'] = {layer:'natal',name};
    wheel.add(mesh);
    glyphs.push(mesh);
  }
  const red = new THREE.Color('#D45028');
  const gray = new THREE.Color('#898989');
  const originals: Line2[] = [];
  for (const [from,to,y] of [
    ['Sun','Moon',-0.15],['Sun','Venus',0],['Moon','Venus',0.15]
  ] as const) {
    const tagged = new THREE.Group();
    tagged.userData['chartNatalAspect'] = {from,to,type:'trigono'};
    const geometry = new LineGeometry();
    geometry.setPositions([-0.35,y,0,0.35,y+0.04,0]);
    geometry.setColors([red.r,red.g,red.b,red.r,red.g,red.b]);
    const material = new LineMaterial({linewidth:1.5,vertexColors:true});
    material.resolution.set(160,160);
    const line = new Line2(geometry,material);
    tagged.add(line);
    originals.push(line);
    wheel.add(tagged);
  }

  let nativeDisposals = 0;
  for (const line of originals) {
    line.geometry.addEventListener('dispose',()=>nativeDisposals++);
    line.material.addEventListener('dispose',()=>nativeDisposals++);
  }
  const colorClose = (line:Line2, target:THREE.Color) => {
    const attr = line.geometry.getAttribute('instanceColorStart');
    return Math.abs(attr.getX(0)-target.r)<1e-5 &&
      Math.abs(attr.getY(0)-target.g)<1e-5 &&
      Math.abs(attr.getZ(0)-target.b)<1e-5;
  };
  const focusCopies = () => {
    const copies:Line2[] = [];
    wheel.traverse(obj => {
      if (obj instanceof Line2 && !originals.includes(obj)) copies.push(obj);
    });
    return copies;
  };
  const controller = new PlanetInteractionController(canvas,camera,()=>{},()=>{});
  const cycles = 120;
  let baselineGeometries = 0;
  let peakGeometries = 0;
  let copiesBounded = true;
  let gpuGeometriesBounded = true;
  let texturesStable = true;
  let programsStable = true;
  let clonesDisposedExactlyOnce = true;
  let nativeResourcesUntouched = true;
  let originalColorsMutedDuringFocus = true;
  let originalsRestored = false;
  let clearedToBaseline = false;
  let noGpuLeaksAfterTeardown = false;
  try {
    controller.setScene(scene);
    renderer.render(scene,camera);
    baselineGeometries = renderer.info.memory.geometries;
    const baselineTextures = renderer.info.memory.textures;
    controller.setNatalAspectPresentation('focused');
    // Warm up all native/focus shaders before recording program ceiling.
    controller.highlight({layer:'natal',name:'Sun'});
    renderer.render(scene,camera);
    const expectedFocusGeometries = baselineGeometries + 2;
    const maxPrograms = renderer.info.programs?.length ?? 0;
    let previousDisposals: {geometry:number;material:number} | null = null;
    for (let index=0; index<cycles; index++) {
      const name = (['Moon','Venus','Sun'] as const)[index%3];
      controller.highlight({layer:'natal',name});
      // Each new focus must release both previous foreground lines once.
      if (previousDisposals) clonesDisposedExactlyOnce &&=
        previousDisposals.geometry===2 && previousDisposals.material===2;
      renderer.render(scene,camera);
      const copies = focusCopies();
      copiesBounded &&= copies.length === 2 &&
        copies.every(copy => originals.every(native =>
          copy.geometry !== native.geometry && copy.material !== native.material));
      const count = renderer.info.memory.geometries;
      peakGeometries = Math.max(peakGeometries,count);
      gpuGeometriesBounded &&= count === expectedFocusGeometries;
      texturesStable &&= renderer.info.memory.textures === baselineTextures;
      programsStable &&= (renderer.info.programs?.length ?? 0) <= maxPrograms;
      originalColorsMutedDuringFocus &&= originals.every(line=>colorClose(line,gray));
      nativeResourcesUntouched &&= nativeDisposals===0;
      const disposal = {geometry:0,material:0};
      for (const copy of copies) {
        copy.geometry.addEventListener('dispose',()=>disposal.geometry++);
        copy.material.addEventListener('dispose',()=>disposal.material++);
      }
      previousDisposals = disposal;
    }
    controller.setNatalAspectPresentation('all');
    if (previousDisposals) clonesDisposedExactlyOnce &&=
      previousDisposals.geometry===2 && previousDisposals.material===2;
    renderer.render(scene,camera);
    clearedToBaseline = renderer.info.memory.geometries===baselineGeometries &&
      focusCopies().length===0;
    originalsRestored = originals.every(line=>colorClose(line,red)) &&
      nativeDisposals===0 && glyphs.every(glyph=>glyph.scale.x===1 && glyph.scale.y===1);
    controller.destroy();
    renderer.render(scene,camera);
    originalsRestored &&= originals.every(line=>colorClose(line,red));
    nativeResourcesUntouched &&= nativeDisposals===0;
    scene.remove(wheel);
    wheel.traverse(obj=>{
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const material of materials) material.dispose();
      }
    });
    renderer.render(scene,camera);
    noGpuLeaksAfterTeardown = renderer.info.memory.geometries===0 &&
      !scene.getObjectByName('chart-interaction-natal-focus');
  } finally {
    controller.destroy();
    renderer.dispose();
    canvas.remove();
  }
  return {
    copiesBounded, gpuGeometriesBounded, texturesStable, programsStable,
    clonesDisposedExactlyOnce, nativeResourcesUntouched,
    originalColorsMutedDuringFocus, originalsRestored,
    clearedToBaseline, noGpuLeaksAfterTeardown,
    cycles, baselineGeometries, peakGeometries
  };
};
