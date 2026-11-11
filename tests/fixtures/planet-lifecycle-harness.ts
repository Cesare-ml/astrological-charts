import * as THREE from 'three';
import { PlanetInteractionController } from '../../src/lib/renderers/planet-interaction.controller';
import type { ChartPlanetInteractionEvent } from '../../src/lib/renderers/planet-interaction.types';

interface LifecycleProbe {
  isolatedEvents: boolean;
  initialEventIsolation: boolean;
  continuedEventIsolation: boolean;
  isolatedVisuals: boolean;
  independentAspectTypes: boolean;
  redrawRestoresScale: boolean;
  redrawReleasesOverlays: boolean;
  pinSurvivesRedraw: boolean;
  mirrorMatchesCanonicalRing: boolean;
  listenersRemovedOnDestroy: boolean;
  reentrantLeaveCleanup: boolean;
  cycles: number;
}

declare global {
  interface Window { runPlanetLifecycleProbe?: () => LifecycleProbe; }
}

/**
 * Synthetic two-canvas controller test. No WebGLRenderer/asset files required.
 * Checks JS/Three geometry and disposal signals; GPU memory needs separate tests.
 */
window.runPlanetLifecycleProbe = () => {
  const canvases: HTMLCanvasElement[] = [];
  const scenes: THREE.Scene[] = [];
  const makeCanvas = (left: number): HTMLCanvasElement => {
    const canvas = document.createElement('canvas');
    canvas.width = 240;
    canvas.height = 240;
    Object.assign(canvas.style, {
      position: 'fixed', left: left + 'px', top: '4px', width: '240px',
      height: '240px', zIndex: '99999'
    });
    document.body.appendChild(canvas);
    canvases.push(canvas);
    return canvas;
  };
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  camera.position.z = 3;
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
  const makeScene = (mirror = false) => {
    const scene = new THREE.Scene();
    const root = new THREE.Group();
    root.userData['chartAspectRadius'] = 0.6;
    if (mirror) root.rotation.y = Math.PI;
    scene.add(root);
    const glyph = (layer: 'natal' | 'transit', name: string, x: number, angle: number) => {
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(0.2, 0.2),
        new THREE.MeshBasicMaterial({side: THREE.DoubleSide})
      );
      mesh.position.x = x;
      mesh.userData['chartPlanet'] = {layer, name};
      mesh.userData['chartAspectAngle'] = angle;
      root.add(mesh);
      return mesh;
    };
    const natal = glyph('natal', 'Sun', -0.4, 0);
    const transit = glyph('transit', 'Saturn', 0.4, Math.PI / 2);
    scenes.push(scene);
    return {scene, natal, transit};
  };
  const move = (canvas: HTMLCanvasElement, x: number, y = 0) => {
    const rect = canvas.getBoundingClientRect();
    const projected = new THREE.Vector3(x, y, 0).project(camera);
    canvas.dispatchEvent(new PointerEvent('pointermove', {
      clientX: rect.left + (projected.x + 1) * rect.width / 2,
      clientY: rect.top + (1 - projected.y) * rect.height / 2
    }));
  };
  const link = (type: string) => [{
    from: {layer: 'natal' as const, name: 'Sun'},
    to: {layer: 'transit' as const, name: 'Saturn'},
    type, orb: 1
  }];
  const observeDisposal = (scene: THREE.Scene) => {
    const line = scene.getObjectByName('chart-interaction-aspect') as THREE.Line | undefined;
    let geometryDisposes = 0;
    let materialDisposes = 0;
    line?.geometry.addEventListener('dispose', () => geometryDisposes++);
    (line?.material as THREE.Material | undefined)?.addEventListener('dispose', () => materialDisposes++);
    return {line, released: () => !!line && geometryDisposes === 1 && materialDisposes === 1};
  };
  const first = makeScene();
  const second = makeScene();
  const canvasA = makeCanvas(4);
  const canvasB = makeCanvas(264);
  const eventsA: ChartPlanetInteractionEvent[] = [];
  const eventsB: ChartPlanetInteractionEvent[] = [];
  let selectTransitOnLeave = false;
  const controllerA = new PlanetInteractionController(canvasA, camera, event => {
    eventsA.push(event);
    if (selectTransitOnLeave && event.type === 'leave') {
      // Simulate an Angular host that synchronously reacts to the old scene's
      // last pointer event by selecting a different planet.
      controllerA.highlight({layer: 'transit', name: 'Saturn'});
    }
  }, () => {});
  const controllerB = new PlanetInteractionController(canvasB, camera, event => eventsB.push(event), () => {});
  try {
    controllerA.setRelations(link('quadrato'));
    controllerB.setRelations(link('trigono'));
    controllerA.setScene(first.scene);
    controllerB.setScene(second.scene);

    move(canvasA, -0.4);
    const noEventsB = eventsB.length === 0 && second.natal.scale.x === 1
      && !second.scene.getObjectByName('chart-interaction-aspect');
    move(canvasB, 0.4);
    const isolatedEvents = noEventsB && eventsA.length === 1 && eventsB.length === 1
      && eventsA[0].planet.layer === 'natal' && eventsB[0].planet.layer === 'transit';
    const independentAspectTypes = eventsA[0]?.aspects[0]?.type === 'quadrato'
      && eventsB[0]?.aspects[0]?.type === 'trigono';
    const initialBLine = second.scene.getObjectByName('chart-interaction-aspect');
    const isolatedVisuals = first.natal.scale.x > 1 && first.transit.scale.x > 1
      && second.natal.scale.x > 1 && second.transit.scale.x > 1
      && !!initialBLine && !!first.scene.getObjectByName('chart-interaction-aspect');

    controllerA.highlight({layer: 'natal', name: 'Sun'});
    controllerB.highlight({layer: 'transit', name: 'Saturn'});
    // highlight() intentionally replaces B's focus overlay. The baseline
    // for subsequent isolation checks must be taken AFTER that explicit
    // change, not before it (otherwise a legitimate replacement fails).
    const bLine = second.scene.getObjectByName('chart-interaction-aspect');
    const bLineReplacedByOwnFocus = !!bLine && bLine !== initialBLine;
    let state = first;
    let redrawRestoresScale = true;
    let redrawReleasesOverlays = true;
    let pinSurvivesRedraw = true;
    const bEventsBeforeRedraws = eventsB.length;
    const cycles = 50;
    for (let i = 0; i < cycles; i++) {
      const old = state;
      const oldOverlay = observeDisposal(old.scene);
      state = makeScene(i === cycles - 1);
      controllerA.setScene(state.scene);
      redrawRestoresScale &&= old.natal.scale.x === 1 && old.transit.scale.x === 1;
      redrawReleasesOverlays &&= oldOverlay.released()
        && !old.scene.getObjectByName('chart-interaction-aspect');
      pinSurvivesRedraw &&= state.natal.scale.x > 1
        && !!state.scene.getObjectByName('chart-interaction-aspect');
    }
    const mirroredLine = state.scene.getObjectByName('chart-interaction-aspect') as THREE.Line | undefined;
    const points = (mirroredLine?.geometry as THREE.BufferGeometry | undefined)
      ?.getAttribute('position') as THREE.BufferAttribute | undefined;
    // Clockwise? No: canonical +90° is left. Y-axis mirror flips left to right.
    const mirrorMatchesCanonicalRing = !!points && points.count === 2
      && Math.abs(points.getX(0)) < 1e-5
      && Math.abs(points.getY(0) - 0.6) < 1e-5
      && Math.abs(points.getX(1) - 0.6) < 1e-5
      && Math.abs(points.getY(1)) < 1e-5;

    const stillIsolated = bLineReplacedByOwnFocus
      && eventsB.length === bEventsBeforeRedraws
      && second.scene.getObjectByName('chart-interaction-aspect') === bLine
      && second.transit.scale.x > 1;
    // The last scene is horizontally mirrored, so natal Sun is at +0.4.
    move(canvasA, 0.4);
    const oldScene = state;
    const oldOverlay = observeDisposal(oldScene.scene);
    selectTransitOnLeave = true;
    state = makeScene(false);
    controllerA.setScene(state.scene);
    const reentrantLeaveCleanup = oldOverlay.released()
      && oldScene.scene.getObjectByName('chart-interaction-aspect') === undefined
      && oldScene.natal.scale.x === 1 && oldScene.transit.scale.x === 1
      && state.transit.scale.x > state.natal.scale.x
      && !!state.scene.getObjectByName('chart-interaction-aspect');
    selectTransitOnLeave = false;

    const lastA = observeDisposal(state.scene);
    const lastB = observeDisposal(second.scene);
    controllerA.destroy();
    controllerB.destroy();
    const afterDestroyA = eventsA.length;
    const afterDestroyB = eventsB.length;
    move(canvasA, -0.4);
    move(canvasB, 0.4);
    const listenersRemovedOnDestroy = lastA.released() && lastB.released()
      && eventsA.length === afterDestroyA && eventsB.length === afterDestroyB
      && state.natal.scale.x === 1 && state.transit.scale.x === 1
      && second.natal.scale.x === 1 && second.transit.scale.x === 1;
    return {
      isolatedEvents: isolatedEvents && stillIsolated,
      initialEventIsolation: isolatedEvents,
      continuedEventIsolation: stillIsolated,
      independentAspectTypes, isolatedVisuals,
      redrawRestoresScale, redrawReleasesOverlays,
      pinSurvivesRedraw, mirrorMatchesCanonicalRing,
      listenersRemovedOnDestroy, reentrantLeaveCleanup, cycles
    };
  } finally {
    controllerA.destroy();
    controllerB.destroy();
    for (const scene of scenes) scene.traverse(obj => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        (obj.material as THREE.Material).dispose();
      }
    });
    for (const canvas of canvases) canvas.remove();
  }
};
