import * as THREE from 'three';
import { PlanetInteractionController } from '../../src/lib/renderers/planet-interaction.controller';
import type { ChartPlanetInteractionEvent } from '../../src/lib/renderers/planet-interaction.types';

declare global {
  interface Window {
    runPlanetReentrantRenderProbe?: () => {
      enterLatchSingleRender: boolean;
      leaveSelectSingleRender: boolean;
      leaveSwapSkipsOldRender: boolean;
      replacementStillInteractive: boolean;
      sameSceneReindexSuppressesStaleEnter: boolean;
      reindexedSceneStillInteractive: boolean;
      updateDestroySkipsOldRender: boolean;
      destroyedListenersRemoved: boolean;
    };
  }
}

/** Synthetic meshes, DOM pointer events, and a render counter; no WebGL context. */
window.runPlanetReentrantRenderProbe = () => {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 400;
  Object.assign(canvas.style, {position:'fixed',left:'0px',top:'0px',
    width:'400px',height:'400px',zIndex:'99999'});
  document.body.appendChild(canvas);
  const camera = new THREE.OrthographicCamera(-1,1,1,-1,0.1,10);
  camera.position.z = 3;
  camera.updateProjectionMatrix();
  const scene = new THREE.Scene();
  const replacement = new THREE.Scene();
  const glyph = (root: THREE.Scene, name: string, x: number) => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.2,0.2),
      new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));
    mesh.position.x = x;
    mesh.userData['chartPlanet'] = {layer:'natal',name};
    root.add(mesh);
  };
  glyph(scene,'Sun',-0.4);
  glyph(scene,'Moon',0.4);
  glyph(replacement,'Mars',0.4);
  const events: ChartPlanetInteractionEvent[] = [];
  let renders = 0;
  let leaveAction: 'swap' | 'reindex' | null = null;
  let destroyOnUpdate = false;
  let latchOnEnter = false;
  let selectMoonOnLeave = false;
  const controller = new PlanetInteractionController(canvas,camera,event => {
    events.push(event);
    if (event.type === 'enter' && latchOnEnter) {
      latchOnEnter = false;
      controller.highlight(event.planet);
    }
    if (event.type === 'leave' && selectMoonOnLeave) {
      selectMoonOnLeave = false;
      controller.highlight({layer:'natal',name:'Moon'});
    }
    if (event.type === 'leave' && leaveAction) {
      const action = leaveAction;
      leaveAction = null;
      controller.setScene(action === 'swap' ? replacement : scene);
    }
    if (event.type === 'update' && destroyOnUpdate) {
      destroyOnUpdate = false;
      controller.destroy();
    }
  },()=>{renders++});
  const move = (x: number) => {
    const p = new THREE.Vector3(x,0,0).project(camera);
    const rect = canvas.getBoundingClientRect();
    canvas.dispatchEvent(new PointerEvent('pointermove', {bubbles:true,
      clientX:rect.left+(p.x+1)*rect.width/2,
      clientY:rect.top+(1-p.y)*rect.height/2}));
  };
  try {
    controller.setScene(scene);
    latchOnEnter = true;
    move(-0.4); // Host latches the Sun inside the enter callback.
    const enterLatchSingleRender = renders === 1 &&
      events.filter(event => event.type === 'enter').length === 1;
    const beforeLeaveSelection = renders;
    selectMoonOnLeave = true;
    canvas.dispatchEvent(new PointerEvent('pointerleave',{bubbles:true}));
    const leaveSelectSingleRender = renders === beforeLeaveSelection + 1
      && events.at(-1)?.type === 'leave';
    move(-0.4); // Re-enter the Sun for the existing scene-swap probe.
    const beforeSwap = renders;
    leaveAction = 'swap';
    canvas.dispatchEvent(new PointerEvent('pointerleave',{bubbles:true}));
    const leaveSwapSkipsOldRender = renders === beforeSwap
      && events.at(-1)?.type === 'leave';
    move(0.4);
    const replacementStillInteractive = events.at(-1)?.type === 'enter'
      && events.at(-1)?.planet.name === 'Mars' && renders === beforeSwap+1;

    controller.setScene(scene);
    move(-0.4); // Sun hovered again
    const beforeReindex = renders;
    const eventCount = events.length;
    leaveAction = 'reindex';
    move(0.4); // Moon was picked, but setScene(scene) re-indexed in leave
    const sameSceneReindexSuppressesStaleEnter = events.length === eventCount+1
      && events.at(-1)?.type === 'leave' && renders === beforeReindex;
    move(0.4);
    const reindexedSceneStillInteractive = events.at(-1)?.type === 'enter'
      && events.at(-1)?.planet.name === 'Moon' && renders === beforeReindex+1;

    const beforeDestroy = renders;
    destroyOnUpdate = true;
    controller.setRelations([{ // A changed payload emits 'update' for hovered Moon.
      from:{layer:'natal',name:'Moon'},to:{layer:'transit',name:'Sun'},
      type:'quadrato',orb:1.2
    }]);
    const updateDestroySkipsOldRender = events.at(-1)?.type === 'update'
      && renders === beforeDestroy;
    const eventCountAfterDestroy = events.length;
    move(-0.4);
    const destroyedListenersRemoved = events.length === eventCountAfterDestroy;
    return {enterLatchSingleRender,leaveSelectSingleRender,
      leaveSwapSkipsOldRender,replacementStillInteractive,
      sameSceneReindexSuppressesStaleEnter,reindexedSceneStillInteractive,
      updateDestroySkipsOldRender,destroyedListenersRemoved};
  } finally {
    controller.destroy();
    for (const root of [scene,replacement]) root.traverse(object=>{
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
        (object.material as THREE.Material).dispose();
      }
    });
    canvas.remove();
  }
};
