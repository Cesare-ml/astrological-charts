import * as THREE from 'three';
import { PlanetInteractionController } from '../../src/lib/renderers/planet-interaction.controller';
import type { ChartPlanetInteractionEvent } from '../../src/lib/renderers/planet-interaction.types';

declare global {
  interface Window {
    runPlanetSceneSwitchProbe?: () => {
      noStaleEnter: boolean;
      newSceneHoverWorks: boolean;
      noHoverOnDetachedScene: boolean;
      listenersDetached: boolean;
    };
  }
}

/** Synthetic scene swaps from inside a synchronous frontend pointer callback. */
window.runPlanetSceneSwitchProbe = () => {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 400;
  Object.assign(canvas.style, {position:'fixed',left:'0px',top:'0px',
    width:'400px',height:'400px',zIndex:'99999'});
  document.body.appendChild(canvas);
  const camera = new THREE.OrthographicCamera(-1,1,1,-1,0.1,10);
  camera.position.z = 3;
  camera.updateProjectionMatrix();
  const glyph = (scene: THREE.Scene, name: string, x: number) => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.2,0.2),
      new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));
    mesh.position.x = x;
    mesh.userData['chartPlanet'] = {layer:'natal',name};
    scene.add(mesh);
    return mesh;
  };
  const original = new THREE.Scene();
  const replacement = new THREE.Scene();
  glyph(original,'Sun',-0.4);
  glyph(original,'Moon',0.4);
  glyph(replacement,'Mars',0.4);
  const events: ChartPlanetInteractionEvent[] = [];
  let swapOnLeave = false;
  const controller = new PlanetInteractionController(canvas,camera,event => {
    events.push(event);
    if (swapOnLeave && event.type === 'leave' && event.planet.name === 'Sun') {
      controller.setScene(replacement);
      swapOnLeave = false;
    }
  },()=>{});
  const move = (x: number) => {
    const rect = canvas.getBoundingClientRect();
    const projected = new THREE.Vector3(x,0,0).project(camera);
    canvas.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,
      clientX:rect.left + (projected.x + 1)*rect.width/2,
      clientY:rect.top + (1 - projected.y)*rect.height/2}));
  };
  try {
    controller.setScene(original);
    move(-0.4); // Sun enters old scene
    swapOnLeave = true;
    move(0.4); // old Moon hit is invalidated while Sun leave swaps scenes
    const noStaleEnter = events.map(e=>e.type+':'+e.planet.name).join('|')
      === 'enter:Sun|leave:Sun';
    move(0.4); // new scene Mars can now be hit
    const newSceneHoverWorks = events.at(-1)?.type === 'enter'
      && events.at(-1)?.planet.name === 'Mars';
    controller.setScene(null);
    const oldEventCount = events.length;
    move(-0.4);
    const noHoverOnDetachedScene = oldEventCount === events.length;
    controller.destroy();
    const afterDestroy = events.length;
    controller.setScene(null);
    move(0.4);
    const listenersDetached = afterDestroy === events.length;
    return {noStaleEnter,newSceneHoverWorks,noHoverOnDetachedScene,listenersDetached};
  } finally {
    controller.destroy();
    for (const scene of [original,replacement]) {
      scene.traverse(obj=>{
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          (obj.material as THREE.Material).dispose();
        }
      });
    }
    canvas.remove();
  }
};
