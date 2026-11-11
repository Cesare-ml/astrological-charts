import * as THREE from 'three';
import { PlanetInteractionController } from '../../src/lib/renderers/planet-interaction.controller';
import type { ChartPlanetInteractionEvent } from '../../src/lib/renderers/planet-interaction.types';

declare global {
  interface Window {
    runPinnedPointerIdempotenceProbe?: () => Record<string, boolean | number>;
  }
}

/** Real canvas pointer events and Three.js meshes. This probes controller
 * redraw behavior without any production data or private image assets.
 */
window.runPinnedPointerIdempotenceProbe = () => {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 400;
  Object.assign(canvas.style, {
    position:'fixed', left:'0px', top:'0px', width:'400px',
    height:'400px', zIndex:'99999'
  });
  document.body.appendChild(canvas);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  camera.position.z = 3;
  camera.updateProjectionMatrix();
  const scene = new THREE.Scene();
  const ring = new THREE.Group();
  ring.userData['chartAspectRadius'] = 0.3;
  scene.add(ring);
  const glyph = (layer:'natal'|'transit', name:string, x:number, angle:number) => {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.18,0.18),
      new THREE.MeshBasicMaterial({color:'#171717',side:THREE.DoubleSide})
    );
    mesh.position.x = x;
    mesh.userData['chartPlanet'] = {layer,name};
    mesh.userData['chartAspectAngle'] = angle;
    ring.add(mesh);
    return mesh;
  };
  const sun = glyph('natal','Sun',-0.4,0);
  const saturn = glyph('transit','Saturn',0.8,Math.PI/2);
  const events: ChartPlanetInteractionEvent[] = [];
  let renders = 0;
  const controller = new PlanetInteractionController(canvas,camera,
    event=>events.push(event),()=>{renders++});
  controller.setRelations([{
    from:{layer:'natal',name:'Sun'},
    to:{layer:'transit',name:'Saturn'},
    type:'quadrato',orb:1
  }]);
  controller.setScene(scene);
  controller.highlight({layer:'natal',name:'Sun'});
  const originalAspect = scene.getObjectByName('chart-interaction-aspect');
  const originalSpoke = scene.getObjectByName('chart-interaction-transit-connector');
  const baselineRenders = renders;
  let disposedOriginals = 0;
  for (const obj of [originalAspect, originalSpoke]) {
    if (!obj) continue;
    (obj as THREE.Line).geometry.addEventListener('dispose',()=>{disposedOriginals++});
    ((obj as THREE.Line).material as THREE.Material)
      .addEventListener('dispose',()=>{disposedOriginals++});
  }
  const send = (name:'Sun'|'Saturn') => {
    const mesh = name === 'Sun' ? sun : saturn;
    const projected = mesh.getWorldPosition(new THREE.Vector3()).project(camera);
    const rect = canvas.getBoundingClientRect();
    canvas.dispatchEvent(new PointerEvent('pointermove',{
      clientX:rect.left+(projected.x+1)*rect.width/2,
      clientY:rect.top+(1-projected.y)*rect.height/2,
      pointerType:'mouse',bubbles:true
    }));
  };
  const leave = () => canvas.dispatchEvent(new PointerEvent('pointerleave',{
    pointerType:'mouse',bubbles:true
  }));
  const color = (mesh:THREE.Mesh) =>
    (mesh.material as THREE.MeshBasicMaterial).color.getHexString();

  for(let i=0;i<30;i++){send('Sun');leave();}
  const pinnedHoverEventsRetained = events.length === 60 &&
    events.every((event,index)=>event.planet.name==='Sun' &&
      event.type===(index%2===0?'enter':'leave'));
  const pinnedHoverAvoidsRepaint = renders===baselineRenders &&
    scene.getObjectByName('chart-interaction-aspect')===originalAspect &&
    scene.getObjectByName('chart-interaction-transit-connector')===originalSpoke &&
    disposedOriginals===0;
  const pinnedColorAndSizeUnchanged = color(sun)==='ff0000' &&
    color(saturn)==='9e02ff' &&
    [sun,saturn].every(mesh=>mesh.scale.x===1&&mesh.scale.y===1);

  // A *different* hover must still repaint; its leave must restore the
  // pinned natal Sun and dispose the temporary foreground.
  send('Saturn');
  const differentHoverRepaints = renders===baselineRenders+1 &&
    disposedOriginals===4 && events.at(-1)?.type==='enter' &&
    events.at(-1)?.planet.name==='Saturn';
  const transitLine = scene.getObjectByName('chart-interaction-aspect');
  leave();
  const otherHoverRestoresPin = renders===baselineRenders+2 &&
    events.at(-1)?.type==='leave' &&
    events.at(-1)?.planet.name==='Saturn' &&
    scene.getObjectByName('chart-interaction-aspect')!==transitLine &&
    color(sun)==='ff0000' && color(saturn)==='9e02ff';

  controller.highlight(null);
  const clearRestoresNeutral = color(sun)==='171717'&&color(saturn)==='171717' &&
    !scene.getObjectByName('chart-interaction-aspect') &&
    !scene.getObjectByName('chart-interaction-transit-connector');
  controller.destroy();
  for(const mesh of [sun,saturn]){
    mesh.geometry.dispose();
    (mesh.material as THREE.Material).dispose();
  }
  canvas.remove();
  return {
    pinnedHoverEventsRetained, pinnedHoverAvoidsRepaint,
    pinnedColorAndSizeUnchanged, differentHoverRepaints,
    otherHoverRestoresPin, clearRestoresNeutral,
    eventCount:events.length, baselineRenders, renders, disposedOriginals
  };
};
