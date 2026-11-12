import * as THREE from 'three';
import { PlanetInteractionController } from '../../src/lib/renderers/planet-interaction.controller';

declare global {
  interface Window {
    runTransferredGlyphIsolationProbe?: () => Record<string, boolean>;
  }
}

/** Two independent chart controllers with a glyph moved between scenes.
 * Tests stale cached glyph lists without any real chart or private images.
 */
window.runTransferredGlyphIsolationProbe = () => {
  const result: Record<string, boolean> = {};
  const canvases: HTMLCanvasElement[] = [];
  const makeCanvas = (left:number) => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 240;
    Object.assign(canvas.style,{
      position:'fixed',left:left+'px',top:'0px',
      width:'240px',height:'240px',zIndex:'99999'
    });
    document.body.appendChild(canvas);
    canvases.push(canvas);
    return canvas;
  };
  const camera = new THREE.OrthographicCamera(-1,1,1,-1,0.1,10);
  camera.position.z = 3;
  camera.updateProjectionMatrix();
  const sceneA = new THREE.Scene();
  const sceneB = new THREE.Scene();
  const ringA = new THREE.Group();
  const ringB = new THREE.Group();
  ringA.userData['chartAspectRadius'] = 0.35;
  ringB.userData['chartAspectRadius'] = 0.35;
  sceneA.add(ringA);
  sceneB.add(ringB);
  const glyph = (parent: THREE.Group, layer:'natal'|'transit',
    name:string, x:number, angle:number) => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.11,0.11),
      new THREE.MeshBasicMaterial({color:'#171717',side:THREE.DoubleSide}));
    mesh.position.x=x;
    mesh.userData['chartPlanet']={layer,name};
    mesh.userData['chartAspectAngle']=angle;
    parent.add(mesh);
    return mesh;
  };
  const sun = glyph(ringA,'natal','Sun',-0.4,0);
  // Old Saturn appears first in the source controller's cached index.
  const transferredSaturn = glyph(ringA,'transit','Saturn',0.45,Math.PI/2);
  const localSaturn = glyph(ringA,'transit','Saturn',0.7,Math.PI*2/3);
  const moon = glyph(ringB,'natal','Moon',-0.4,Math.PI);
  const controllerA = new PlanetInteractionController(makeCanvas(2),camera,()=>{},()=>{});
  const controllerB = new PlanetInteractionController(makeCanvas(248),camera,()=>{},()=>{});
  const relationA = [{
    from:{layer:'natal' as const,name:'Sun'},
    to:{layer:'transit' as const,name:'Saturn'},
    type:'quadrato',orb:1
  }];
  const relationB = [{
    from:{layer:'natal' as const,name:'Moon'},
    to:{layer:'transit' as const,name:'Saturn'},
    type:'trigono',orb:1
  }];
  const color = (mesh:THREE.Mesh) =>
    (mesh.material as THREE.MeshBasicMaterial).color.getHexString();
  try {
    controllerA.setRelations(relationA);
    controllerA.setScene(sceneA);
    // Transfer without notifying A. B legitimately reindexes its own scene.
    ringB.add(transferredSaturn);
    controllerB.setRelations(relationB);
    controllerB.setScene(sceneB);
    controllerB.highlight({layer:'natal',name:'Moon'});
    const bLine = sceneB.getObjectByName('chart-interaction-aspect');
    result.destinationFocusWorks = !!bLine &&
      color(moon)==='c0c0c0' && color(transferredSaturn)==='9e02ff';

    controllerA.highlight({layer:'natal',name:'Sun'});
    const aLine = sceneA.getObjectByName('chart-interaction-aspect') as THREE.Line|undefined;
    const coords = aLine?.geometry.getAttribute('position') as THREE.BufferAttribute|undefined;
    const end = coords && new THREE.Vector3().fromBufferAttribute(coords,1);
    const expectedAngle = -Math.sin(Math.PI*2/3)*0.35;
    result.usesStillAttachedSaturn = !!aLine && !!end &&
      Math.abs(end.x-expectedAngle)<1e-5;
    result.doesNotRecolorTransferredGlyph =
      color(transferredSaturn)==='9e02ff' &&
      color(localSaturn)==='9e02ff' &&
      color(sun)==='ff0000';
    result.doesNotAlterDestinationOverlays =
      sceneB.getObjectByName('chart-interaction-aspect')===bLine;
    controllerA.highlight(null);
    controllerA.highlight({layer:'natal',name:'Sun'});
    result.independentSourceFocusCycles =
      sceneB.getObjectByName('chart-interaction-aspect')===bLine &&
      color(transferredSaturn)==='9e02ff' &&
      !!sceneA.getObjectByName('chart-interaction-aspect');

    // With no remaining source transit, A must no longer create a
    // colored cross-chart link or modify B's symbol.
    ringB.add(localSaturn);
    controllerA.highlight(null);
    controllerA.highlight({layer:'natal',name:'Sun'});
    result.missingPartnerSkipsSourceOverlay =
      !sceneA.getObjectByName('chart-interaction-aspect') &&
      !sceneA.getObjectByName('chart-interaction-transit-connector') &&
      color(transferredSaturn)==='9e02ff' &&
      color(localSaturn)==='171717';

    controllerB.highlight(null);
    result.eachControllerRestoresOnlyItsOwnPalette =
      color(transferredSaturn)==='171717' &&
      color(sun)==='ff0000' &&
      color(moon)==='171717';
    controllerA.highlight(null);
    result.sourcePaletteRestored = color(sun)==='171717';
  } finally {
    controllerA.destroy();
    controllerB.destroy();
    for (const mesh of [sun,transferredSaturn,localSaturn,moon]) {
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    }
    for (const canvas of canvases) canvas.remove();
  }
  return result;
};
