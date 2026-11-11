import * as THREE from 'three';
import { PlanetInteractionController } from '../../src/lib/renderers/planet-interaction.controller';
import type { ChartPlanetInteractionEvent } from '../../src/lib/renderers/planet-interaction.types';

declare global {
  interface Window {
    runPlanetPointerProbe?: () => {
      events: { type: string; key: string; aspects: number }[];
      natalHovered: boolean;
      transitHovered: boolean;
      clickEmitted: boolean;
      removedListeners: boolean;
      transitPinRestored: boolean;
      centralOverlay: boolean;
      centralOverlayGeometry: boolean;
      refreshedWhileHovered: boolean;
      noRefreshAfterLeave: boolean;
      destroyedRestoredScale: boolean;
    };
  }
}

window.runPlanetPointerProbe = () => {
  const canvas = document.createElement('canvas');
  canvas.width = 400; canvas.height = 400;
  Object.assign(canvas.style, {
    position: 'fixed', left: '0px', top: '0px', width: '400px', height: '400px', zIndex: '99999'
  });
  document.body.appendChild(canvas);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  camera.position.z = 3;
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
  const scene = new THREE.Scene();
  const root = new THREE.Group();
  root.userData['chartAspectRadius'] = 0.6;
  scene.add(root);
  const glyph = (layer: string, name: string, x: number, angle: number) => {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.25, 0.25), new THREE.MeshBasicMaterial({side: THREE.DoubleSide})
    );
    mesh.position.x = x;
    mesh.userData['chartPlanet'] = {layer, name};
    mesh.userData['chartAspectAngle'] = angle;
    root.add(mesh);
    return mesh;
  };
  const natal = glyph('natal', 'Sun', -0.4, 0);
  const transit = glyph('transit', 'Saturn', 0.4, Math.PI/2);
  scene.updateMatrixWorld(true);
  const events: ChartPlanetInteractionEvent[] = [];
  const controller = new PlanetInteractionController(canvas, camera, event => events.push(event), () => {});
  controller.setRelations([{
    from: {layer: 'natal', name: 'Sun'},
    to: {layer: 'transit', name: 'Saturn'},
    type: 'quadrato', orb: 1
  }]);
  controller.setScene(scene);
  const rect = canvas.getBoundingClientRect();
  const send = (x: number, y: number, type: 'pointermove' | 'click') => {
    const world = new THREE.Vector3(x, y, 0).project(camera);
    const options = {
      clientX: rect.left + (world.x + 1) * rect.width / 2,
      clientY: rect.top + (1 - world.y) * rect.height / 2,
      bubbles: true,
    };
    canvas.dispatchEvent(type === 'pointermove' ? new PointerEvent(type, options) : new MouseEvent(type, options));
  };
  send(-0.4, 0, 'pointermove');
  const natalHovered = events[0]?.type === 'enter'
    && events[0].planet.layer === 'natal' && events[0].planet.name === 'Sun'
    && events[0].aspects.length === 1;
  const overlay = scene.getObjectByName('chart-interaction-aspect') as THREE.Line | undefined;
  const centralOverlay = overlay !== undefined;
  const coordinates = (overlay?.geometry as THREE.BufferGeometry | undefined)?.getAttribute('position') as THREE.BufferAttribute | undefined;
  // Match the established AspettiRender coordinates: rotate from (0,r).
  // 0° natal endpoint (0,r), 90° transit endpoint (-r,0).
  const centralOverlayGeometry = !!coordinates && coordinates.count === 2
    && Math.abs(coordinates.getX(0)) < 1e-5
    && Math.abs(coordinates.getY(0) - 0.6) < 1e-5
    && Math.abs(coordinates.getX(1) + 0.6) < 1e-5
    && Math.abs(coordinates.getY(1)) < 1e-5;
  controller.setRelations([{
    from: {layer: 'natal', name: 'Sun'},
    to: {layer: 'transit', name: 'Saturn'},
    type: 'trigono', orb: 0.5
  }]);
  const updated = events.at(-1);
  const refreshedWhileHovered = updated?.type === 'update'
    && updated.planet.layer === 'natal' && updated.aspects.length === 1
    && updated.aspects[0].type === 'trigono' && updated.aspects[0].orb === 0.5;
  send(-0.4, 0, 'click');
  const clickEmitted = events.some(event => event.type === 'click' && event.planet.name === 'Sun');
  send(0.4, 0, 'pointermove');
  const transitHovered = events.some(event => event.type === 'enter'
    && event.planet.layer === 'transit' && event.planet.name === 'Saturn'
    && event.aspects.length === 1);
  controller.highlight({layer: 'transit', name: 'Saturn'});
  canvas.dispatchEvent(new PointerEvent('pointerleave', {bubbles: true}));
  const transitPinRestored = transit.scale.x > 1 && natal.scale.x === 1;
  const beforeRelationsAfterLeave = events.length;
  controller.setRelations([]);
  const noRefreshAfterLeave = events.length === beforeRelationsAfterLeave
    && scene.getObjectByName('chart-interaction-aspect') === undefined
    && transit.scale.x > 1;
  const simplifiedEvents = events.map(e => ({
    type: e.type, key: e.planet.layer + ':' + e.planet.name, aspects: e.aspects.length
  }));
  controller.destroy();
  const beforeDestroyedMove = events.length;
  send(-0.4, 0, 'pointermove');
  const removedListeners = events.length === beforeDestroyedMove;
  const destroyedRestoredScale = natal.scale.x === 1 && transit.scale.x === 1
    && scene.getObjectByName('chart-interaction-aspect') === undefined;
  root.traverse(object => {
    if (object instanceof THREE.Mesh) {
      object.geometry.dispose();
      (object.material as THREE.Material).dispose();
    }
  });
  canvas.remove();
  return {events: simplifiedEvents, natalHovered, transitHovered, clickEmitted,
    removedListeners, transitPinRestored, centralOverlay, centralOverlayGeometry,
    refreshedWhileHovered, noRefreshAfterLeave, destroyedRestoredScale};
};
