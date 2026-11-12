import * as THREE from 'three';
import { PlanetInteractionController } from '../../src/lib/renderers/planet-interaction.controller';

declare global {
  interface Window {
    runMultiChartGpuFocusProbe?: () => Record<string, boolean | number>;
  }
}

/** Two live WebGL contexts, shared base material and 1x1 synthetic texture.
 * Stress focus changes in BOTH charts; no private artwork or chart data.
 * renderer.info.memory counts GPU-backed textures/geometries (not materials).
 * Material disposal events separately account for owned temporary copies.
 */
window.runMultiChartGpuFocusProbe = () => {
  const result: Record<string, boolean | number> = {};
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  camera.position.z = 3;
  camera.updateProjectionMatrix();
  const texture = new THREE.DataTexture(
    new Uint8Array([255, 255, 255, 255]), 1, 1, THREE.RGBAFormat
  );
  texture.needsUpdate = true;
  const base = new THREE.MeshBasicMaterial({
    color:'#171717', map:texture, side:THREE.DoubleSide
  });
  let baseDisposals = 0;
  let textureDisposals = 0;
  base.addEventListener('dispose', () => baseDisposals++);
  texture.addEventListener('dispose', () => textureDisposals++);
  const focusSun = {layer:'natal' as const, name:'Sun'};
  const focusMoon = {layer:'natal' as const, name:'Moon'};
  const focusChoices = [focusSun, focusMoon, null] as const;
  const tracked = new Map<THREE.Material, number>();
  const canvases: HTMLCanvasElement[] = [];
  const renderers: THREE.WebGLRenderer[] = [];
  const make = (left:number) => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    Object.assign(canvas.style, {
      position:'fixed',left:left+'px',top:'0px',width:'128px',
      height:'128px',zIndex:'99999'
    });
    document.body.appendChild(canvas);
    canvases.push(canvas);
    const renderer = new THREE.WebGLRenderer({canvas,antialias:false});
    renderer.setPixelRatio(1);
    renderer.setSize(128,128,false);
    renderers.push(renderer);
    const scene = new THREE.Scene();
    const root = new THREE.Group();
    root.userData['chartAspectRadius'] = 0.35;
    scene.add(root);
    const makeGlyph = (layer:'natal'|'transit',name:string,
      x:number,angle:number) => {
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.13,0.13),base);
      mesh.position.x = x;
      mesh.userData['chartPlanet']={layer,name};
      mesh.userData['chartAspectAngle']=angle;
      root.add(mesh);
      return mesh;
    };
    const sun = makeGlyph('natal','Sun',-0.4,0);
    const moon = makeGlyph('natal','Moon',-0.1,Math.PI/3);
    const saturn = makeGlyph('transit','Saturn',0.65,Math.PI/2);
    const render = () => renderer.render(scene,camera);
    const controller = new PlanetInteractionController(canvas,camera,()=>{},render);
    controller.setRelations([
      {from:focusSun,to:{layer:'transit',name:'Saturn'},
        type:'quadrato',orb:1},
      {from:focusMoon,to:{layer:'transit',name:'Saturn'},
        type:'trigono',orb:0.5}
    ]);
    controller.setScene(scene);
    const meshes=[sun,moon,saturn];
    const watchFocusedClones = () => {
      for (const mesh of meshes) {
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const material of materials) {
          if (material===base || tracked.has(material)) continue;
          tracked.set(material,0);
          material.addEventListener('dispose', () => {
            tracked.set(material,(tracked.get(material) ?? 0)+1);
          });
        }
      }
    };
    return {renderer,scene,controller,meshes,render,watchFocusedClones};
  };

  let first: ReturnType<typeof make> | null = null;
  let second: ReturnType<typeof make> | null = null;
  try {
    const activeFirst = make(2);
    const activeSecond = make(140);
    first = activeFirst;
    second = activeSecond;
    result.twoSeparateWebGLContexts = activeFirst.renderer.getContext() !== activeSecond.renderer.getContext();
    activeFirst.render();
    activeSecond.render();
    const startA = {
      geometries:activeFirst.renderer.info.memory.geometries,
      textures:activeFirst.renderer.info.memory.textures,
      programs:activeFirst.renderer.info.programs?.length ?? 0
    };
    const startB = {
      geometries:activeSecond.renderer.info.memory.geometries,
      textures:activeSecond.renderer.info.memory.textures,
      programs:activeSecond.renderer.info.programs?.length ?? 0
    };
    result.initialScenesRendered = startA.geometries===3 &&
      startB.geometries===3 &&
      startA.textures>=1 && startB.textures>=1;

    const cycles = 60;
    let geometryCountStable = true;
    let textureCountStable = true;
    let shaderProgramsBounded = true;
    let independentFocusColors = true;
    let baseMaterialsUnchanged = true;
    let maxGeometriesA = startA.geometries;
    let maxGeometriesB = startB.geometries;
    let maxProgramsA = startA.programs;
    let maxProgramsB = startB.programs;
    for (let i=0;i<cycles;i++) {
      const aFocus=focusChoices[i%focusChoices.length];
      const bFocus=focusChoices[(i+1)%focusChoices.length];
      activeFirst.controller.highlight(aFocus);
      activeSecond.controller.highlight(bFocus);
      activeFirst.watchFocusedClones();
      activeSecond.watchFocusedClones();
      activeFirst.render();
      activeSecond.render();
      const aMem=activeFirst.renderer.info.memory;
      const bMem=activeSecond.renderer.info.memory;
      maxGeometriesA=Math.max(maxGeometriesA,aMem.geometries);
      maxGeometriesB=Math.max(maxGeometriesB,bMem.geometries);
      maxProgramsA=Math.max(maxProgramsA,activeFirst.renderer.info.programs?.length ?? 0);
      maxProgramsB=Math.max(maxProgramsB,activeSecond.renderer.info.programs?.length ?? 0);
      // One central colored aspect and one dashed outer transit guide
      // per selected natal planet. No highlighted body creates neither.
      geometryCountStable &&=
        aMem.geometries===startA.geometries+(aFocus?2:0) &&
        bMem.geometries===startB.geometries+(bFocus?2:0);
      textureCountStable &&=
        aMem.textures===startA.textures &&
        bMem.textures===startB.textures;
      shaderProgramsBounded &&=
        (activeFirst.renderer.info.programs?.length ?? 0)<=startA.programs+3 &&
        (activeSecond.renderer.info.programs?.length ?? 0)<=startB.programs+3;
      baseMaterialsUnchanged &&=
        (base.color.getHexString()==='171717') &&
        baseDisposals===0 && textureDisposals===0;
      const expected=(mesh:THREE.Mesh,name:string,selected:string|null) =>
        (mesh.material as THREE.MeshBasicMaterial).color.getHexString() ===
          (selected && (name===selected || name==='Saturn')
            ? ({Sun:'ff0000',Moon:'c0c0c0',Saturn:'9e02ff'} as Record<string,string>)[name]
            : '171717');
      independentFocusColors &&=
        activeFirst.meshes.every(mesh => expected(mesh,
          (mesh.userData['chartPlanet'] as {name:string}).name,aFocus?.name ?? null)) &&
        activeSecond.meshes.every(mesh => expected(mesh,
          (mesh.userData['chartPlanet'] as {name:string}).name,bFocus?.name ?? null));
    }
    result.cycles = cycles;
    result.focusGeometryCountsStable = geometryCountStable;
    result.focusTextureCountsStable = textureCountStable;
    result.shaderProgramsBounded = shaderProgramsBounded;
    result.independentFocusColors = independentFocusColors;
    result.baseMaterialsUntouched = baseMaterialsUnchanged;
    result.maxGeometriesA = maxGeometriesA;
    result.maxGeometriesB = maxGeometriesB;
    result.maxProgramsA = maxProgramsA;
    result.maxProgramsB = maxProgramsB;

    // Destroying only chart A must release its 2 focused overlays and
    // temporary glyph materials, without disturbing B's live scene.
    activeFirst.controller.highlight(focusSun);
    activeFirst.watchFocusedClones();
    activeFirst.render();
    activeSecond.controller.highlight(focusMoon);
    activeSecond.watchFocusedClones();
    activeSecond.render();
    const bLine=activeSecond.scene.getObjectByName('chart-interaction-aspect');
    const bGeometries=activeSecond.renderer.info.memory.geometries;
    activeFirst.controller.destroy();
    activeFirst.render();
    activeSecond.render();
    result.destroyOneChartDoesNotTouchOther =
      activeFirst.renderer.info.memory.geometries===startA.geometries &&
      activeSecond.renderer.info.memory.geometries===bGeometries &&
      activeSecond.scene.getObjectByName('chart-interaction-aspect')===bLine &&
      (activeSecond.meshes[1].material as THREE.MeshBasicMaterial).color.getHexString()==='c0c0c0';

    activeSecond.controller.destroy();
    activeSecond.render();
    result.bothOverlaySetsReleased =
      activeFirst.renderer.info.memory.geometries===startA.geometries &&
      activeSecond.renderer.info.memory.geometries===startB.geometries;
    result.allObservedFocusClonesDisposedOnce = tracked.size>=100 &&
      [...tracked.values()].every(disposals=>disposals===1);
    result.sharedBaseTextureNeverDisposed = baseDisposals===0 &&
      textureDisposals===0 &&
      activeFirst.meshes.every(mesh=>mesh.material===base) &&
      activeSecond.meshes.every(mesh=>mesh.material===base);
    result.observedFocusCloneCount = tracked.size;
  } finally {
    first?.controller.destroy();
    second?.controller.destroy();
    for (const c of [first,second]) {
      if (!c) continue;
      for (const mesh of c.meshes) mesh.geometry.dispose();
      c.renderer.dispose();
    }
    base.dispose();
    texture.dispose();
    for (const c of canvases) c.remove();
  }
  return result;
};
