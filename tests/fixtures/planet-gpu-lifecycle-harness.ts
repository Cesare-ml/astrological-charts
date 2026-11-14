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
      duplicateFocusSkipRender: boolean;
      orbOnlyUpdatesSkipRender: boolean;
      orbOnlyUpdatesAvailableOnClick: boolean;
      orbOnlyUpdatesNotifyFrontend: boolean;
      winnerChangeRepaintsGuide: boolean;
      winnerRecolorKeepsGeometry: boolean;
      unrelatedUpdatesSkipRender: boolean;
      unrelatedUpdatesAvailableOnSelection: boolean;
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
    mesh('natal','Moon',-0.65,Math.PI);
    mesh('transit','Venus',0.5,Math.PI*1.5);
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
  let clickedName = '';
  let clickedOrbs: readonly (number | undefined)[] = [];
  let updateCount = 0;
  let updateOrbs: readonly (number | undefined)[] = [];
  const controller = new PlanetInteractionController(canvas,camera,event=>{
    if (event.type === 'click') {
      clickedName = event.planet.name;
      clickedOrbs = event.aspects.map(aspect => aspect.orb);
    }
    if (event.type === 'update' && event.planet.layer === 'natal'
        && event.planet.name === 'Sun') {
      updateCount++;
      updateOrbs = event.aspects.map(aspect => aspect.orb);
    }
  },render);
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
  let duplicateFocusSkipRender = false;
  let orbOnlyUpdatesSkipRender = false;
  let orbOnlyUpdatesAvailableOnClick = false;
  let orbOnlyUpdatesNotifyFrontend = false;
  let winnerChangeRepaintsGuide = false;
  let winnerRecolorKeepsGeometry = false;
  let unrelatedUpdatesSkipRender = false;
  let unrelatedUpdatesAvailableOnSelection = false;
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

    // Repeating the same button selection/focus mode must not dispose or
    // recreate foreground line geometry (or schedule GPU render requests).
    const beforeRepeatedFocus = renderCalls;
    for (let i = 0; i < 120; i++) {
      controller.highlight({layer:'natal',name:'Sun'});
      controller.setNatalAspectPresentation('all');
    }
    duplicateFocusSkipRender = renderCalls === beforeRepeatedFocus
      && renderer.info.memory.geometries === focusedGeometries
      && active.getObjectByName('chart-interaction-aspect') === initialOverlay
      && active.getObjectByName('chart-interaction-transit-connector') === initialSpoke;

    // Orb-only changes for a sole visible transit relationship must
    // preserve the live WebGL line and spoke while updating host data.
    const beforeOrbOnly = renderCalls;
    for (let i = 1; i <= 120; i++) {
      controller.setRelations([{...relation(0)[0],orb:i / 10}]);
    }
    orbOnlyUpdatesSkipRender = renderCalls === beforeOrbOnly
      && renderer.info.memory.geometries === focusedGeometries
      && active.getObjectByName('chart-interaction-aspect') === initialOverlay
      && active.getObjectByName('chart-interaction-transit-connector') === initialSpoke;
    orbOnlyUpdatesNotifyFrontend = updateCount >= 120
      && updateOrbs.length === 1 && updateOrbs[0] === 12;
    const sunPoint = new THREE.Vector3(-0.35,0,0).project(camera);
    const sunRect = canvas.getBoundingClientRect();
    canvas.dispatchEvent(new MouseEvent('click', {
      clientX:sunRect.left+(sunPoint.x+1)*sunRect.width/2,
      clientY:sunRect.top+(1-sunPoint.y)*sunRect.height/2,bubbles:true
    }));
    orbOnlyUpdatesAvailableOnClick = clickedName === 'Sun'
      && clickedOrbs.length === 1 && clickedOrbs[0] === 12;
    controller.setRelations(relation(0));

    // Off-focus updates must not touch the highlighted Sun/Saturn line.
    const beforeUnrelated = renderCalls;
    for (let i = 0; i < 120; i++) {
      controller.setRelations([...relation(0), {
        from:{layer:'natal' as const,name:'Moon'},
        to:{layer:'transit' as const,name:'Venus'},
        type:'sestile',orb:i / 10
      }]);
    }
    unrelatedUpdatesSkipRender = renderCalls === beforeUnrelated
      && renderer.info.memory.geometries === focusedGeometries
      && active.getObjectByName('chart-interaction-aspect') === initialOverlay
      && active.getObjectByName('chart-interaction-transit-connector') === initialSpoke;

    // Later clicks still receive the freshest off-focus data from the host.
    camera.updateMatrixWorld(true);
    const moonPoint = new THREE.Vector3(-0.65,0,0).project(camera);
    const rect = canvas.getBoundingClientRect();
    canvas.dispatchEvent(new MouseEvent('click', {
      clientX:rect.left + (moonPoint.x+1)*rect.width/2,
      clientY:rect.top + (1-moonPoint.y)*rect.height/2,bubbles:true
    }));
    unrelatedUpdatesAvailableOnSelection = clickedName === 'Moon'
      && clickedOrbs.length === 1 && clickedOrbs[0] === 11.9;

    for (let i = 1; i <= refreshCount; i++) {
      controller.setRelations(relation(i)); // requestRender() hits real WebGL
      const count = renderer.info.memory.geometries;
      peakGeometries = Math.max(peakGeometries,count);
      stableGpuGeometries &&= count === focusedGeometries;
      stableTextures &&= renderer.info.memory.textures === baselineTextures;
      stablePrograms &&= (renderer.info.programs?.length ?? 0) <= focusedPrograms;
    }

    // A shared transit spoke chooses its color from the tightest orb.
    // Changing that winner must repaint, even though all endpoints match.
    const square = {...relation(0)[0],type:'quadrato',orb:0.1};
    const trine = {...relation(0)[0],type:'trigono',orb:1.9};
    controller.setRelations([square,trine]);
    const beforeWinner = active.getObjectByName('chart-interaction-transit-connector') as THREE.Line;
    const firstColor = (beforeWinner?.material as THREE.LineDashedMaterial)?.color?.getHexString();
    const beforeWinnerMaterial = beforeWinner?.material;
    const beforeWinnerGeometry = beforeWinner?.geometry;
    const beforeCentral = active.getObjectByName('chart-interaction-aspect');
    const beforeWinnerGpuCount = renderer.info.memory.geometries;
    const beforeWinnerRender = renderCalls;
    controller.setRelations([{...square,orb:2.5},{...trine,orb:0.2}]);
    const afterWinner = active.getObjectByName('chart-interaction-transit-connector') as THREE.Line;
    const nextColor = (afterWinner?.material as THREE.LineDashedMaterial)?.color?.getHexString();
    winnerChangeRepaintsGuide = !!firstColor && !!nextColor && firstColor !== nextColor
      && renderCalls === beforeWinnerRender + 1;
    winnerRecolorKeepsGeometry = afterWinner === beforeWinner
      && afterWinner?.material === beforeWinnerMaterial
      && afterWinner?.geometry === beforeWinnerGeometry
      && active.getObjectByName('chart-interaction-aspect') === beforeCentral
      && renderer.info.memory.geometries === beforeWinnerGpuCount;
    controller.setRelations(relation(90));

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
    redrawsStable,duplicateRelationsSkipRender,duplicateFocusSkipRender,
    orbOnlyUpdatesSkipRender,orbOnlyUpdatesAvailableOnClick,
    orbOnlyUpdatesNotifyFrontend,winnerChangeRepaintsGuide,
    winnerRecolorKeepsGeometry,unrelatedUpdatesSkipRender,
    unrelatedUpdatesAvailableOnSelection,
    focusClearReleasesOverlays,teardownReleasesGpuGeometries,
    refreshCount,redrawCount,baselineGeometries,peakGeometries,finalGeometries
  };
};
