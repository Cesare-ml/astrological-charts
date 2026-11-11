import * as THREE from 'three';
import { PlanetInteractionController } from '../../src/lib/renderers/planet-interaction.controller';

declare global {
  interface Window {
    runPlanetGpuLifecycleProbe?: () => {
      activeOverlayRendered: boolean;
      stableGpuGeometries: boolean;
      stableTextures: boolean;
      stablePrograms: boolean;
      redrawsStable: boolean;
      duplicateRelationsSkipRender: boolean;
      focusClearReleasesOverlays: boolean;
      teardownReleasesGpuGeometries: boolean;
      refreshCount: number;
      redrawCount: number;
      baselineGeometries: number;
      peakGeometries: number;
      finalGeometries: number;
    };
  }
}

/** Real browser WebGL accounting; generated meshes only, no asset requests. */
window.runPlanetGpuLifecycleProbe = () => {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  Object.assign(canvas.style, {
    position:'fixed',left:'0px',top:'0px',
    width:'128px',height:'128px',zIndex:'99999'
  });
  document.body.appendChild(canvas);
  const renderer = new THREE.WebGLRenderer({canvas,antialias:false});
  renderer.setPixelRatio(1);
  renderer.setSize(128,128,false);
  const camera = new THREE.OrthographicCamera(-1,1,1,-1,0.1,10);
  camera.position.z = 3;
  camera.updateProjectionMatrix();
  const createScene = () => {
    const scene = new THREE.Scene();
    const root = new THREE.Group();
    root.userData['chartAspectRadius'] = 0.32;
    scene.add(root);
    const mesh = (layer:'natal'|'transit',name:string,x:number,angle:number) => {
      const body = new THREE.Mesh(new THREE.PlaneGeometry(0.15,0.15),
        new THREE.MeshBasicMaterial({color:'#444444',side:THREE.DoubleSide}));
      body.position.x = x;
      body.userData['chartPlanet'] = {layer,name};
      body.userData['chartAspectAngle'] = angle;
      root.add(body);
    };
    mesh('natal','Sun',-0.35,0);
    mesh('transit','Saturn',0.75,Math.PI/2);
    return scene;
  };
  const disposeGlyphs = (scene: THREE.Scene) => scene.traverse(object => {
    if (object instanceof THREE.Mesh) {
      object.geometry.dispose();
      const mats = Array.isArray(object.material) ? object.material : [object.material];
      for (const mat of mats) mat.dispose();
    }
  });
  let active = createScene();
  let renderCalls = 0;
  const render = () => {
    renderCalls++;
    renderer.render(active,camera);
  };
  const controller = new PlanetInteractionController(canvas,camera,()=>{},render);
  const focus = {layer:'natal' as const,name:'Sun'};
  const relation = (n: number) => [{
    from:focus, to:{layer:'transit' as const,name:'Saturn'},
    type:n%2?'quadrato':'trigono',orb:n/10
  }];
  let baselineGeometries = 0;
  let peakGeometries = 0;
  let finalGeometries = 0;
  let activeOverlayRendered = false;
  let stableGpuGeometries = true;
  let stableTextures = true;
  let stablePrograms = true;
  let redrawsStable = true;
  let duplicateRelationsSkipRender = false;
  let focusClearReleasesOverlays = false;
  let teardownReleasesGpuGeometries = false;
  const refreshCount = 90;
  const redrawCount = 20;
  try {
    render();
    baselineGeometries = renderer.info.memory.geometries;
    const baselineTextures = renderer.info.memory.textures;
    controller.setRelations(relation(0));
    controller.highlight(focus);
    controller.setScene(active);
    render();
    const focusedGeometries = renderer.info.memory.geometries;
    const focusedPrograms = renderer.info.programs?.length ?? 0;
    activeOverlayRendered = focusedGeometries === baselineGeometries + 2
      && !!active.getObjectByName('chart-interaction-aspect')
      && !!active.getObjectByName('chart-interaction-transit-connector');
    peakGeometries = focusedGeometries;

    const initialOverlay = active.getObjectByName('chart-interaction-aspect');
    const initialSpoke = active.getObjectByName('chart-interaction-transit-connector');
    const beforeDuplicates = renderCalls;
    for (let i = 0; i < 120; i++) {
      controller.setRelations(relation(0));
    }
    duplicateRelationsSkipRender = renderCalls === beforeDuplicates
      && renderer.info.memory.geometries === focusedGeometries
      && active.getObjectByName('chart-interaction-aspect') === initialOverlay
      && active.getObjectByName('chart-interaction-transit-connector') === initialSpoke;

    for (let i = 1; i <= refreshCount; i++) {
      controller.setRelations(relation(i)); // requestRender() hits real WebGL
      const count = renderer.info.memory.geometries;
      peakGeometries = Math.max(peakGeometries,count);
      stableGpuGeometries &&= count === focusedGeometries;
      stableTextures &&= renderer.info.memory.textures === baselineTextures;
      stablePrograms &&= (renderer.info.programs?.length ?? 0) <= focusedPrograms;
    }

    for (let i = 0; i < redrawCount; i++) {
      const old = active;
      active = createScene();
      controller.setScene(active);
      // Scene resources are owned/disposed by the host, not the controller.
      disposeGlyphs(old);
      render();
      const count = renderer.info.memory.geometries;
      peakGeometries = Math.max(peakGeometries,count);
      redrawsStable &&= count === focusedGeometries;
      stableTextures &&= renderer.info.memory.textures === baselineTextures;
      stablePrograms &&= (renderer.info.programs?.length ?? 0) <= focusedPrograms;
    }

    controller.highlight(null);
    render();
    focusClearReleasesOverlays = renderer.info.memory.geometries === baselineGeometries
      && !active.getObjectByName('chart-interaction-aspect')
      && !active.getObjectByName('chart-interaction-transit-connector');

    controller.destroy();
    disposeGlyphs(active);
    finalGeometries = renderer.info.memory.geometries;
    teardownReleasesGpuGeometries = finalGeometries === 0;
  } finally {
    controller.destroy();
    disposeGlyphs(active);
    renderer.dispose();
    renderer.forceContextLoss();
    canvas.remove();
  }
  return {
    activeOverlayRendered,stableGpuGeometries,stableTextures,stablePrograms,
    redrawsStable,duplicateRelationsSkipRender,focusClearReleasesOverlays,teardownReleasesGpuGeometries,
    refreshCount,redrawCount,baselineGeometries,peakGeometries,finalGeometries
  };
};
