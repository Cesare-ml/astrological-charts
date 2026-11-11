import * as THREE from 'three';
import { PlanetInteractionController } from '../../src/lib/renderers/planet-interaction.controller';

declare global {
  interface Window {
    runPlanetFocusStyleProbe?: () => Record<string, boolean>;
  }
}

/** Generated Three.js geometry only. No private symbols or astronomical data. */
window.runPlanetFocusStyleProbe = () => {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 400;
  document.body.appendChild(canvas);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  camera.position.z = 3;
  camera.updateProjectionMatrix();
  const scene = new THREE.Scene();
  const root = new THREE.Group();
  root.userData['chartAspectRadius'] = 0.5;
  scene.add(root);
  const glyph = (layer: 'natal' | 'transit', name: string, x: number, angle: number) => {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.12, 0.12),
      new THREE.MeshBasicMaterial({color:'#171717', side:THREE.DoubleSide})
    );
    mesh.position.set(x, 0, 0);
    mesh.userData['chartPlanet'] = {layer, name};
    mesh.userData['chartAspectAngle'] = angle;
    root.add(mesh);
    return mesh;
  };
  const sun = glyph('natal','Sun',-0.25,0);
  const moon = glyph('natal','Moon',-0.1,Math.PI/3);
  const saturn = glyph('transit','Saturn',0.85,Math.PI/2);
  const natalAspectGroup = new THREE.Group();
  natalAspectGroup.userData['chartNatalAspect'] = {
    from: 'Sun', to: 'Moon', type:'quadrato'
  };
  const aspectGeometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-0.25,0,0), new THREE.Vector3(-0.1,0.2,0)
  ]);
  const original = [1,0,0];
  aspectGeometry.setAttribute('instanceColorStart',
    new THREE.Float32BufferAttribute(original,3));
  aspectGeometry.setAttribute('instanceColorEnd',
    new THREE.Float32BufferAttribute(original,3));
  natalAspectGroup.add(new THREE.Line(aspectGeometry, new THREE.LineBasicMaterial()));
  root.add(natalAspectGroup);
  scene.updateMatrixWorld(true);
  let latchedFocus: string | null = null;
  let controller: PlanetInteractionController;
  controller = new PlanetInteractionController(canvas,camera,event=>{
    if (event.type === 'enter') {
      latchedFocus = event.planet.layer + ':' + event.planet.name;
      controller.highlight(event.planet); // Same host contract used by the demo.
    }
  },()=>{});
  controller.setRelations([
    {from:{layer:'natal',name:'Sun'},to:{layer:'transit',name:'Saturn'},
      type:'quadrato',orb:1}
  ]);
  controller.setScene(scene);
  const colorOf = (mesh: THREE.Mesh) =>
    (mesh.material as THREE.MeshBasicMaterial).color.getHexString();
  const start = aspectGeometry.getAttribute('instanceColorStart') as THREE.BufferAttribute;
  const neutralBefore = [sun,moon,saturn].every(mesh=>colorOf(mesh)==='171717');
  controller.setNatalAspectPresentation('muted');
  const grayTransitBackground = start.getX(0) < 0.5 &&
    Math.abs(start.getX(0)-start.getY(0)) < 0.00001;
  controller.highlight({layer:'transit',name:'Saturn'});
  const selectedAndPartnerColored = colorOf(saturn)==='9e02ff' &&
    colorOf(sun)==='ff0000' && colorOf(moon)==='171717';
  const dashed = scene.getObjectByName('chart-interaction-transit-connector') as THREE.Line | undefined;
  const dashedOuterConnector = !!dashed && dashed.material instanceof THREE.LineDashedMaterial &&
    (dashed.geometry as THREE.BufferGeometry).getAttribute('position').count === 2;
  // Natal-only mode has no cross-theme relations; native tagged
  // natal aspects are enough to color Sun and Moon.
  controller.setRelations([]);
  controller.setNatalAspectPresentation('focused');
  controller.highlight({layer:'natal',name:'Sun'});
  const focusedNatalColored = start.getX(0)>0.95 && start.getY(0)>0.12 &&
    start.getY(0)<0.25; // quadrato #FF7800 in linear-sRGB
  const natalAspectPartnerColored = colorOf(sun)==='ff0000' &&
    colorOf(moon)==='c0c0c0' && colorOf(saturn)==='171717';
  controller.highlight({layer:'transit',name:'Saturn'});
  const transitKeepsNatalMuted = start.getX(0) < 0.5 &&
    Math.abs(start.getX(0)-start.getY(0)) < 0.00001;
  controller.setNatalAspectPresentation('all');
  const allRestoresOriginal = Math.abs(start.getX(0)-1)<1e-6 &&
    Math.abs(start.getY(0))<1e-6;
  // An actual pointer-enter followed by pointer-leave must retain the
  // host-selected planet. Coordinates are computed from the fake camera
  // instead of assuming a fixed window layout.
  const world = sun.getWorldPosition(new THREE.Vector3()).project(camera);
  const rect = canvas.getBoundingClientRect();
  canvas.dispatchEvent(new PointerEvent('pointermove', {
    clientX: rect.left + (world.x + 1) * rect.width/2,
    clientY: rect.top + (1 - world.y) * rect.height/2,
    bubbles: true, pointerType:'mouse'
  }));
  canvas.dispatchEvent(new PointerEvent('pointerleave', {
    bubbles: true, pointerType:'mouse'
  }));
  const hoverLatchedAfterLeave = latchedFocus === 'natal:Sun' &&
    sun.scale.x > 1 && colorOf(sun)==='ff0000';
  controller.destroy();
  const neutralRestored = [sun,moon,saturn].every(mesh=>colorOf(mesh)==='171717');
  const overlaysDisposed = scene.getObjectByName('chart-interaction-transit-connector')===undefined;
  root.traverse(object=>{
    if(object instanceof THREE.Mesh || object instanceof THREE.Line) {
      (object as THREE.Mesh).geometry.dispose();
      const material=(object as THREE.Mesh).material;
      if(Array.isArray(material)) material.forEach(m=>m.dispose());
      else (material as THREE.Material).dispose();
    }
  });
  canvas.remove();
  return {
    neutralBefore, grayTransitBackground, selectedAndPartnerColored,
    dashedOuterConnector, focusedNatalColored, natalAspectPartnerColored,
    transitKeepsNatalMuted,
    allRestoresOriginal, hoverLatchedAfterLeave, neutralRestored, overlaysDisposed
  };
};
