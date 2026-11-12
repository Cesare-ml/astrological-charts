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
    colorOf(sun)==='ff0000' && colorOf(moon)==='171717' &&
    [sun,moon,saturn].every(mesh=>mesh.scale.x===1 && mesh.scale.y===1);
  const dashed = scene.getObjectByName('chart-interaction-transit-connector') as THREE.Line | undefined;
  const dashedOuterConnector = !!dashed && dashed.material instanceof THREE.LineDashedMaterial &&
    (dashed.geometry as THREE.BufferGeometry).getAttribute('position').count === 2;
  // Natal-only mode has no cross-theme relations; native tagged
  // natal aspects are enough to color Sun and Moon.
  controller.setRelations([]);
  controller.setNatalAspectPresentation('focused');
  controller.highlight({layer:'natal',name:'Sun'});
  const focusedNatalBackgroundGray = start.getX(0) < 0.5 &&
    Math.abs(start.getX(0)-start.getY(0)) < 0.00001;
  const foreground = scene.getObjectByName('chart-interaction-natal-focus') as THREE.Object3D | undefined;
  let foregroundLine: THREE.Line | undefined;
  foreground?.traverse(obj => {
    if (!foregroundLine && obj instanceof THREE.Line) foregroundLine = obj;
  });
  const foregroundColors = foregroundLine?.geometry.getAttribute('instanceColorStart') as THREE.BufferAttribute | undefined;
  const focusedNatalColored = !!foregroundColors &&
    foregroundColors.getX(0) > 0.95 && foregroundColors.getY(0) < 1e-6 &&
    foregroundColors.getZ(0) < 1e-6 &&
    foregroundColors !== start;
  const nativeForegroundGeometryIndependent =
    !!foregroundLine && foregroundLine.geometry !== aspectGeometry;
  let foregroundGeometryDisposals = 0;
  let foregroundMaterialDisposals = 0;
  foregroundLine?.geometry.addEventListener('dispose', () => foregroundGeometryDisposals++);
  (foregroundLine?.material as THREE.Material | undefined)?.addEventListener(
    'dispose', () => foregroundMaterialDisposals++
  );
  const natalAspectPartnerColored = colorOf(sun)==='ff0000' &&
    colorOf(moon)==='c0c0c0' && colorOf(saturn)==='171717';
  controller.highlight({layer:'transit',name:'Saturn'});
  const transitKeepsNatalMuted = start.getX(0) < 0.5 &&
    Math.abs(start.getX(0)-start.getY(0)) < 0.00001 &&
    !scene.getObjectByName('chart-interaction-natal-focus');
  const natalOverlayDisposedOnFocusChange =
    foregroundGeometryDisposals === 1 && foregroundMaterialDisposals === 1;
  controller.setNatalAspectPresentation('all');
  const allRestoresOriginal = Math.abs(start.getX(0)-1)<1e-6 &&
    Math.abs(start.getY(0))<1e-6 &&
    !scene.getObjectByName('chart-interaction-natal-focus');
  // Exercise many focus transitions without multiplying native lines
  // or leaking additional overlays into the same chart scene.
  let repeatedFocusCleanup = true;
  for (let i = 0; i < 30; i++) {
    controller.setNatalAspectPresentation('focused');
    controller.highlight({layer:'natal',name:'Sun'});
    let overlayCount = 0;
    scene.traverse(obj => {
      if (obj.name === 'chart-interaction-natal-focus') overlayCount++;
    });
    repeatedFocusCleanup &&= overlayCount === 1 &&
      Math.abs(start.getX(0) - start.getY(0)) < 1e-6;
    controller.setNatalAspectPresentation('all');
    repeatedFocusCleanup &&= !scene.getObjectByName('chart-interaction-natal-focus') &&
      Math.abs(start.getX(0)-1) < 1e-6 && Math.abs(start.getY(0)) < 1e-6;
  }

  // The native aspect registry is cached at setScene(). Moving its tagged
  // stroke to another chart must not let the old controller gray/clone
  // the foreign geometry. Returning it must restore ordinary focus.
  const foreignScene=new THREE.Scene();
  foreignScene.add(natalAspectGroup);
  controller.setNatalAspectPresentation('focused');
  const transferredNativeAspectIgnored=
    start.getX(0)>0.99 && start.getY(0)<0.01 &&
    !foreignScene.getObjectByName('chart-interaction-natal-focus');
  controller.setNatalAspectPresentation('all');
  root.add(natalAspectGroup);
  controller.setNatalAspectPresentation('focused');
  const returnedNativeAspectFocused=
    start.getX(0)<0.5 && Math.abs(start.getX(0)-start.getY(0))<1e-6 &&
    !!root.getObjectByName('chart-interaction-natal-focus');
  controller.setNatalAspectPresentation('all');

  // The cached aspect-ring group itself may be transferred, while
  // its existing planet meshes stay in the original chart. No dashed
  // transit guide may use geometry owned by the other canvas.
  const retainedBodies=new THREE.Group();
  scene.add(retainedBodies);
  for(const object of [sun,moon,saturn,natalAspectGroup])
    retainedBodies.add(object);
  foreignScene.add(root);
  controller.setRelations([{
    from:{layer:'natal',name:'Sun'},to:{layer:'transit',name:'Saturn'},
    type:'quadrato',orb:1
  }]);
  const transferredAspectRingIgnored=
    scene.getObjectByName('chart-interaction-transit-connector')===undefined;
  scene.add(root);
  for(const object of [sun,moon,saturn,natalAspectGroup])root.add(object);
  scene.remove(retainedBodies);
  // The original ring and native aspect return without reindexing.
  controller.setRelations([]);
  controller.setRelations([{
    from:{layer:'natal',name:'Sun'},to:{layer:'transit',name:'Saturn'},
    type:'quadrato',orb:1
  }]);
  const returnedAspectRingRestored=
    !!scene.getObjectByName('chart-interaction-transit-connector');
  controller.setRelations([]);

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
    colorOf(sun)==='ff0000' &&
    [sun,moon,saturn].every(mesh => mesh.scale.x === 1 && mesh.scale.y === 1);
  controller.destroy();
  const neutralRestored = [sun,moon,saturn].every(mesh=>
    colorOf(mesh)==='171717' && mesh.scale.x===1 && mesh.scale.y===1);
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
    dashedOuterConnector, focusedNatalColored, focusedNatalBackgroundGray,
    nativeForegroundGeometryIndependent, natalOverlayDisposedOnFocusChange,
    natalAspectPartnerColored,
    transitKeepsNatalMuted,
    allRestoresOriginal, repeatedFocusCleanup,
    transferredNativeAspectIgnored, returnedNativeAspectFocused,
    transferredAspectRingIgnored, returnedAspectRingRestored,
    hoverLatchedAfterLeave, neutralRestored, overlaysDisposed
  };
};
