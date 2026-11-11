import * as THREE from 'three';
import { PlanetInteractionController } from '../../src/lib/renderers/planet-interaction.controller';
import type { ChartPlanetInteractionEvent } from '../../src/lib/renderers/planet-interaction.types';

interface PickingProbe {
  nearerRightSelected: boolean;
  nearerLeftSelected: boolean;
  zoomedRightSelected: boolean;
  outsideCanvasClearsHover: boolean;
  outsideClickIgnored: boolean;
  noStaleUpdateDuringLeave: boolean;
  frontLayerWins: boolean;
  resourcesRestored: boolean;
}

declare global {
  interface Window { runPlanetPickingProbe?: () => PickingProbe; }
}

/** Explicit geometry fixture: overlapping glyphs at equal depth and one foreground glyph. */
window.runPlanetPickingProbe = (): PickingProbe => {
  const canvas = document.createElement('canvas');
  canvas.width = 400; canvas.height = 400;
  Object.assign(canvas.style, {
    position: 'fixed', left: '0px', top: '0px',
    width: '400px', height: '400px', zIndex: '99999'
  });
  document.body.appendChild(canvas);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  camera.position.z = 3;
  camera.updateProjectionMatrix();
  const scene = new THREE.Scene();
  const glyph = (name: string, x: number, depth = 0) => {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.4, 0.4),
      new THREE.MeshBasicMaterial({side: THREE.DoubleSide})
    );
    mesh.position.set(x, 0, depth);
    mesh.userData['chartPlanet'] = {layer: 'natal', name};
    scene.add(mesh);
    return mesh;
  };
  // The left glyph is inserted first, intentionally reproducing the earlier
  // first-intersection bias when the two hit rectangles overlap.
  const left = glyph('Sun', -0.08);
  const right = glyph('Moon', 0.08);
  const offscreen = glyph('Mars', 1.05);
  const events: ChartPlanetInteractionEvent[] = [];
  let replaceAspectsOnLeave = false;
  const controller = new PlanetInteractionController(canvas, camera, event => {
    events.push(event);
    if (replaceAspectsOnLeave && event.type === 'leave') controller.setRelations([]);
  }, () => {});
  const pointer = (worldX: number, type: 'pointermove' | 'click' = 'pointermove') => {
    camera.updateMatrixWorld(true);
    const projected = new THREE.Vector3(worldX, 0, 0).project(camera);
    const rect = canvas.getBoundingClientRect();
    const init = {
      clientX: rect.left + (projected.x + 1) * rect.width / 2,
      clientY: rect.top + (1 - projected.y) * rect.height / 2,
      bubbles: true
    };
    canvas.dispatchEvent(type === 'click' ? new MouseEvent(type, init) : new PointerEvent(type, init));
  };
  try {
    controller.setScene(scene);
    pointer(0.09);
    const nearerRightSelected = events.at(-1)?.type === 'enter'
      && events.at(-1)?.planet.name === 'Moon';
    pointer(-0.09);
    const nearerLeftSelected = events.at(-1)?.type === 'enter'
      && events.at(-1)?.planet.name === 'Sun';
    camera.zoom = 1.5;
    camera.updateProjectionMatrix();
    pointer(0.09);
    const zoomedRightSelected = events.at(-1)?.type === 'enter'
      && events.at(-1)?.planet.name === 'Moon';
    const beforeLeave = events.length;
    replaceAspectsOnLeave = true;
    pointer(1.05);
    replaceAspectsOnLeave = false;
    const leavingEvents = events.slice(beforeLeave);
    const outsideCanvasClearsHover = leavingEvents.length === 1
      && leavingEvents[0].type === 'leave'
      && leavingEvents[0].planet.name === 'Moon';
    const noStaleUpdateDuringLeave = leavingEvents.every(event => event.type !== 'update');
    const beforeClick = events.length;
    pointer(1.05, 'click');
    const outsideClickIgnored = events.length === beforeClick;
    // A clearly nearer camera-depth mesh must win even if its center is
    // farther in 2D than another overlapping back-layer glyph.
    camera.zoom = 1;
    camera.updateProjectionMatrix();
    const front = glyph('Venus', -0.10, 0.12);
    // Index the new glyph. A fresh pointer ray should prioritize its depth.
    controller.setScene(scene);
    pointer(0.08);
    const frontLayerWins = events.at(-1)?.type === 'enter'
      && events.at(-1)?.planet.name === 'Venus';
    controller.destroy();
    const resourcesRestored = left.scale.x === 1 && right.scale.x === 1
      && front.scale.x === 1 && offscreen.scale.x === 1;
    return {
      nearerRightSelected, nearerLeftSelected, zoomedRightSelected,
      outsideCanvasClearsHover, outsideClickIgnored, noStaleUpdateDuringLeave,
      frontLayerWins, resourcesRestored
    };
  } finally {
    controller.destroy();
    scene.traverse(obj => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        (obj.material as THREE.Material).dispose();
      }
    });
    canvas.remove();
  }
};
