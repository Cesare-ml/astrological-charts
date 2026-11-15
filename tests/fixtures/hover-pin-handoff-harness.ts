import * as THREE from 'three';
import { PlanetInteractionController } from '../../src/lib/renderers/planet-interaction.controller';
import type { ChartPlanetInteractionEvent } from '../../src/lib/renderers/planet-interaction.types';

declare global {
  interface Window {
    runHoverPinHandoffProbe?: () => Record<string, boolean | number>;
  }
}

/** Reproduces Angular's synchronous enter -> highlightPlanet() callback.
 * All positions and aspect data are synthetic; no private artwork.
 */
window.runHoverPinHandoffProbe = () => {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 400;
  Object.assign(canvas.style, {
    position:'fixed', left:'0px', top:'0px',
    width:'400px', height:'400px', zIndex:'99999'
  });
  document.body.appendChild(canvas);
  const camera = new THREE.OrthographicCamera(-1,1,1,-1,0.1,10);
  camera.position.z = 3;
  camera.updateProjectionMatrix();
  const scene = new THREE.Scene();
  const ring = new THREE.Group();
  ring.userData['chartAspectRadius'] = 0.3;
  scene.add(ring);
  const make = (layer:'natal'|'transit', name:string, x:number, angle:number) => {
    const body = new THREE.Mesh(
      new THREE.PlaneGeometry(0.15,0.15),
      new THREE.MeshBasicMaterial({color:'#171717', side:THREE.DoubleSide})
    );
    body.position.x = x;
    body.userData['chartPlanet'] = {layer,name};
    body.userData['chartAspectAngle'] = angle;
    ring.add(body);
    return body;
  };
  const sun = make('natal','Sun',-0.4,0);
  const saturn = make('transit','Saturn',0.65,Math.PI/2);
  let renders = 0;
  const events: ChartPlanetInteractionEvent[] = [];
  let controller: PlanetInteractionController;
  controller = new PlanetInteractionController(canvas,camera,event=>{
    events.push(event);
    if (event.type === 'enter') controller.highlight(event.planet);
  },()=>{renders++});
  controller.setRelations([{
    from:{layer:'natal',name:'Sun'},
    to:{layer:'transit',name:'Saturn'},
    type:'quadrato',orb:1
  }]);
  controller.setScene(scene);
  const send = (mesh: THREE.Mesh) => {
    const p = mesh.getWorldPosition(new THREE.Vector3()).project(camera);
    const rect = canvas.getBoundingClientRect();
    canvas.dispatchEvent(new PointerEvent('pointermove',{
      clientX:rect.left+(p.x+1)*rect.width/2,
      clientY:rect.top+(1-p.y)*rect.height/2,
      pointerType:'mouse',bubbles:true
    }));
  };
  const leave = () => canvas.dispatchEvent(new PointerEvent('pointerleave',{
    pointerType:'mouse',bubbles:true
  }));
  const aspect = () => scene.getObjectByName('chart-interaction-aspect');
  const spoke = () => scene.getObjectByName('chart-interaction-transit-connector');
  const color = (body:THREE.Mesh) =>
    (body.material as THREE.MeshBasicMaterial).color.getHexString();
  send(sun);
  const firstEnterPaintsExactlyOnce = renders===1 && !!aspect() && !!spoke() &&
    events.length===1 && events[0].type==='enter' && events[0].planet.name==='Sun';
  const originalLine = aspect();
  let lineDisposals = 0;
  (originalLine as THREE.Line)?.geometry.addEventListener('dispose',()=>lineDisposals++);
  send(sun);
  const duplicatePointerMoveSkipped = renders===1 && aspect()===originalLine &&
    events.length===1;
  send(saturn);
  const nextEnterPaintsExactlyOnce = renders===2 && lineDisposals===1 &&
    aspect()!==originalLine && events.length===3 &&
    events[1].type==='leave' && events[2].type==='enter' &&
    events[2].planet.name==='Saturn';
  const saturnLine = aspect();
  leave();
  const pinnedTransitLeaveKeepsOverlay = renders===2 && aspect()===saturnLine &&
    events.at(-1)?.type==='leave';
  for(let i=0;i<20;i++){send(saturn);leave();}
  const repeatedPinKeepsGpuObjects = renders===2 && aspect()===saturnLine &&
    events.length===44;
  // Button-selected focus changes while Saturn is hovered must NOT paint
  // Sun until the Saturn hover finishes. Its leave then restores Sun.
  send(saturn);
  const beforeButton = renders;
  const beforeButtonLine = aspect();
  controller.highlight({layer:'natal',name:'Sun'});
  const buttonWhileHoveredDoesNotRedraw = renders===beforeButton &&
    aspect()===beforeButtonLine;
  leave();
  const buttonFocusRestoredAfterLeave = renders===beforeButton+1 &&
    aspect()!==beforeButtonLine && !!spoke() &&
    color(sun)==='ff0000' && color(saturn)==='9e02ff';
  const noSymbolZoom = [sun,saturn].every(mesh =>
    mesh.scale.x===1 && mesh.scale.y===1);
  controller.highlight(null);
  const clearFocusWorks = !aspect() && !spoke() &&
    color(sun)==='171717' && color(saturn)==='171717';
  controller.destroy();
  for(const mesh of [sun,saturn]){
    mesh.geometry.dispose();
    (mesh.material as THREE.Material).dispose();
  }
  canvas.remove();
  return {
    firstEnterPaintsExactlyOnce, duplicatePointerMoveSkipped,
    nextEnterPaintsExactlyOnce, pinnedTransitLeaveKeepsOverlay,
    repeatedPinKeepsGpuObjects, buttonWhileHoveredDoesNotRedraw,
    buttonFocusRestoredAfterLeave, noSymbolZoom, clearFocusWorks,
    renders, eventCount:events.length
  };
};
