import * as THREE from 'three';
import { PlanetInteractionController } from '../../src/lib/renderers/planet-interaction.controller';
import type { ChartPlanetInteractionEvent } from '../../src/lib/renderers/planet-interaction.types';

declare global {
  interface Window {
    runPlanetSceneSwitchProbe?: () => {
      noStaleEnter: boolean;
      newSceneHoverWorks: boolean;
      nestedSceneWins: boolean;
      noHoverOnDetachedScene: boolean;
      listenersDetached: boolean;
      disposedControllerInert: boolean;
      sceneDetachKeepsSelectionData: boolean;
      destroyReleasesSelectionData: boolean;
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
  const obsolete = new THREE.Scene();
  glyph(original,'Sun',-0.4);
  glyph(original,'Moon',0.4);
  glyph(replacement,'Mars',0.4);
  glyph(obsolete,'Venus',0.4);
  const events: ChartPlanetInteractionEvent[] = [];
  let renderRequests = 0;
  let swapOnLeave = false;
  const controller = new PlanetInteractionController(canvas,camera,event => {
    events.push(event);
    if (swapOnLeave && event.type === 'leave' && event.planet.name === 'Sun') {
      swapOnLeave = false;
      controller.setScene(replacement);
    }
  },()=>{renderRequests++;});
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

    // The callback fired by setScene() itself can request a newer scene.
    // That nested replacement must win over the obsolete outer request.
    controller.setScene(original);
    move(-0.4);
    swapOnLeave = true;
    controller.setScene(obsolete);
    move(0.4);
    const nestedSceneWins = events.at(-1)?.type === 'enter'
      && events.at(-1)?.planet.name === 'Mars';

    controller.setScene(null);
    const oldEventCount = events.length;
    move(-0.4);
    const noHoverOnDetachedScene = oldEventCount === events.length;
    // setScene(null) during redraw must preserve the pin and upstream
    // aspect snapshot. Only terminal destroy may release those references.
    const beforeDestroyLinks = [{
      from:{layer:'natal' as const,name:'Mars'},
      to:{layer:'transit' as const,name:'Saturn'},
      type:'quadrato',orb:1.25
    }];
    controller.setRelations(beforeDestroyLinks);
    controller.highlight({layer:'natal',name:'Mars'});
    const snapshot = controller as unknown as {
      pinned: {layer:string;name:string}|null;
      relations: readonly {orb?:number}[];
    };
    const sceneDetachKeepsSelectionData = snapshot.pinned?.name==='Mars'
      && snapshot.relations.length===1 && snapshot.relations[0].orb===1.25;
    controller.destroy();
    const destroyReleasesSelectionData = snapshot.pinned===null
      && snapshot.relations.length===0;
    const afterDestroy = events.length;
    controller.setScene(null);
    move(0.4);
    const listenersDetached = afterDestroy === events.length;
    // A stale Angular callback can retain a reference to this destroyed
    // controller. No public setter may reattach a canvas/scene after teardown.
    const beforeLateWrites = renderRequests;
    controller.setScene(replacement);
    controller.setRelations([{
      from:{layer:'natal',name:'Mars'},to:{layer:'transit',name:'Saturn'},
      type:'quadrato',orb:1
    }]);
    controller.setNatalAspectPresentation('focused');
    controller.highlight({layer:'natal',name:'Mars'});
    move(0.4);
    controller.destroy(); // second teardown must be safe
    const marsMeshes = replacement.children.filter(obj => obj instanceof THREE.Mesh) as THREE.Mesh[];
    const disposedControllerInert = renderRequests === beforeLateWrites
      && events.length === afterDestroy
      && replacement.getObjectByName('chart-interaction-aspect') === undefined
      && marsMeshes.length === 1
      && (marsMeshes[0].material as THREE.MeshBasicMaterial).color.getHexString() === 'ffffff'
      && canvas.style.cursor !== 'pointer';
    return {noStaleEnter,newSceneHoverWorks,nestedSceneWins,
      noHoverOnDetachedScene,listenersDetached,disposedControllerInert,
      sceneDetachKeepsSelectionData,destroyReleasesSelectionData};
  } finally {
    controller.destroy();
    for (const scene of [original,replacement,obsolete]) {
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
