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
    first = make(2);
    second = make(140);
    result.twoSeparateWebGLContexts = first.renderer.getContext() !== second.renderer.getContext();
    first.render();
    second.render();
    const startA = {
      geometries:first.renderer.info.memory.geometries,
      textures:first.renderer.info.memory.textures,
      programs:first.renderer.info.programs?.length ?? 0
    };
    const startB = {
      geometries:second.renderer.info.memory.geometries,
      textures:second.renderer.info.memory.textures,
      programs:second.renderer.info.programs?.length ?? 0
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
      first.controller.highlight(aFocus);
      second.controller.highlight(bFocus);
      first.watchFocusedClones();
      second.watchFocusedClones();
      first.render();
      second.render();
      const aMem=first.renderer.info.memory;
      const bMem=second.renderer.info.memory;
      maxGeometriesA=Math.max(maxGeometriesA,aMem.geometries);
      maxGeometriesB=Math.max(maxGeometriesB,bMem.geometries);
      maxProgramsA=Math.max(maxProgramsA,first.renderer.info.programs?.length ?? 0);
      maxProgramsB=Math.max(maxProgramsB,second.renderer.info.programs?.length ?? 0);
      // One central colored aspect and one dashed outer transit guide
      // per selected natal planet. No highlighted body creates neither.
      geometryCountStable &&=
        aMem.geometries===startA.geometries+(aFocus?2:0) &&
        bMem.geometries===startB.geometries+(bFocus?2:0);
      textureCountStable &&=
        aMem.textures===startA.textures &&
        bMem.textures===startB.textures;
      shaderProgramsBounded &&=
        (first.renderer.info.programs?.length ?? 0)<=startA.programs+3 &&
        (second.renderer.info.programs?.length ?? 0)<=startB.programs+3;
      baseMaterialsUnchanged &&=
        (base.color.getHexString()==='171717') &&
        baseDisposals===0 && textureDisposals===0;
      const expected=(mesh:THREE.Mesh,name:string,selected:string|null) =>
        (mesh.material as THREE.MeshBasicMaterial).color.getHexString() ===
          (selected && (name===selected || name==='Saturn')
            ? ({Sun:'ff0000',Moon:'c0c0c0',Saturn:'9e02ff'} as Record<string,string>)[name]
            : '171717');
      independentFocusColors &&=
        first.meshes.every(mesh => expected(mesh,
          (mesh.userData['chartPlanet'] as {name:string}).name,aFocus?.name ?? null)) &&
        second.meshes.every(mesh => expected(mesh,
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
    first.controller.highlight(focusSun);
    first.watchFocusedClones();
    first.render();
    second.controller.highlight(focusMoon);
    second.watchFocusedClones();
    second.render();
    const bLine=second.scene.getObjectByName('chart-interaction-aspect');
    const bGeometries=second.renderer.info.memory.geometries;
    first.controller.destroy();
    first.render();
    second.render();
    result.destroyOneChartDoesNotTouchOther =
      first.renderer.info.memory.geometries===startA.geometries &&
      second.renderer.info.memory.geometries===bGeometries &&
      second.scene.getObjectByName('chart-interaction-aspect')===bLine &&
      (second.meshes[1].material as THREE.MeshBasicMaterial).color.getHexString()==='c0c0c0';

    second.controller.destroy();
    second.render();
    result.bothOverlaySetsReleased =
      first.renderer.info.memory.geometries===startA.geometries &&
      second.renderer.info.memory.geometries===startB.geometries;
    result.allObservedFocusClonesDisposedOnce = tracked.size>=100 &&
      [...tracked.values()].every(disposals=>disposals===1);
    result.sharedBaseTextureNeverDisposed = baseDisposals===0 &&
      textureDisposals===0 &&
      first.meshes.every(mesh=>mesh.material===base) &&
      second.meshes.every(mesh=>mesh.material===base);
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
