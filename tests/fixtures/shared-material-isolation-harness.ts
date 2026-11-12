import * as THREE from 'three';
import { PlanetInteractionController } from '../../src/lib/renderers/planet-interaction.controller';

declare global {
  interface Window {
    runSharedMaterialIsolationProbe?: () => Record<string, boolean>;
  }
}

/** Synthetic two-chart material sharing, including in-flight mesh transfer.
 * Uses the same base Material and Texture reference in both independent scenes.
 * Focus clones are allowed; disposing original materials or textures is not.
 */
window.runSharedMaterialIsolationProbe = () => {
  const checks: Record<string, boolean> = {};
  const canvases: HTMLCanvasElement[] = [];
  const canvas = (left: number) => {
    const c = document.createElement('canvas');
    c.width = c.height = 200;
    Object.assign(c.style, {
      position:'fixed',left:left+'px',top:'0px',width:'200px',
      height:'200px',zIndex:'99999'
    });
    document.body.appendChild(c);
    canvases.push(c);
    return c;
  };
  const camera = new THREE.OrthographicCamera(-1,1,1,-1,0.1,10);
  camera.position.z = 3;
  camera.updateProjectionMatrix();

  const sharedTexture = new THREE.Texture();
  const sharedMaterial = new THREE.MeshBasicMaterial({
    color:'#171717',map:sharedTexture,side:THREE.DoubleSide
  });
  let originalMaterialDisposed = 0;
  let originalTextureDisposed = 0;
  sharedMaterial.addEventListener('dispose',()=>originalMaterialDisposed++);
  sharedTexture.addEventListener('dispose',()=>originalTextureDisposed++);

  const sceneA = new THREE.Scene();
  const sceneB = new THREE.Scene();
  const groupA = new THREE.Group();
  const groupB = new THREE.Group();
  groupA.userData['chartAspectRadius'] = 0.35;
  groupB.userData['chartAspectRadius'] = 0.35;
  sceneA.add(groupA);
  sceneB.add(groupB);

  const create = (group:THREE.Group,layer:'natal'|'transit',
    name:string,x:number,angle:number,multi=false) => {
    const material: THREE.Material | THREE.Material[] = multi
      ? [sharedMaterial,sharedMaterial] : sharedMaterial;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.12,0.12),material);
    mesh.position.x=x;
    mesh.userData['chartPlanet']={layer,name};
    mesh.userData['chartAspectAngle']=angle;
    group.add(mesh);
    return mesh;
  };
  const sun = create(groupA,'natal','Sun',-0.4,0,true);
  const saturn = create(groupA,'transit','Saturn',0.65,Math.PI/2);
  const moon = create(groupB,'natal','Moon',-0.4,Math.PI);
  const venus = create(groupB,'transit','Venus',0.65,Math.PI/2);
  const a = new PlanetInteractionController(canvas(2),camera,()=>{},()=>{});
  const b = new PlanetInteractionController(canvas(212),camera,()=>{},()=>{});
  const color = (material: THREE.Material) =>
    (material as THREE.MeshBasicMaterial).color.getHexString();
  const colors = (mesh:THREE.Mesh) =>
    (Array.isArray(mesh.material)?mesh.material:[mesh.material]).map(color);
  const sunLink = [{
    from:{layer:'natal' as const,name:'Sun'},
    to:{layer:'transit' as const,name:'Saturn'},
    type:'quadrato',orb:1
  }];
  const moonLink = [{
    from:{layer:'natal' as const,name:'Moon'},
    to:{layer:'transit' as const,name:'Venus'},
    type:'trigono',orb:1
  }];
  let disposedSunCopies=0,disposedSaturnA=0,disposedSaturnB=0;
  try {
    a.setRelations(sunLink);
    b.setRelations(moonLink);
    a.setScene(sceneA);
    b.setScene(sceneB);
    a.highlight({layer:'natal',name:'Sun'});
    const sunCopies = sun.material as THREE.Material[];
    const saturnCopyA = saturn.material as THREE.Material;
    sunCopies.forEach(m=>m.addEventListener('dispose',()=>disposedSunCopies++));
    saturnCopyA.addEventListener('dispose',()=>disposedSaturnA++);

    checks.sameBaseNotTinted = color(sharedMaterial)==='171717';
    checks.arrayMaterialsOwnSeparateClones = Array.isArray(sun.material) &&
      sunCopies.length===2 && sunCopies[0]!==sunCopies[1] &&
      sunCopies.every(m=>m!==sharedMaterial && color(m)==='ff0000' &&
        (m as THREE.MeshBasicMaterial).map===sharedTexture);
    checks.unfocusedSecondChartStillNeutral =
      colors(moon).join(',')==='171717' && colors(venus).join(',')==='171717';
    checks.firstChartFocusedOnlyOwnMeshes =
      colors(saturn).join(',')==='9e02ff' &&
      colors(sun).join(',')==='ff0000,ff0000';

    b.highlight({layer:'natal',name:'Moon'});
    const moonCopy = moon.material as THREE.Material;
    checks.secondChartIndependentPalette =
      colors(moon).join(',')==='c0c0c0' &&
      colors(venus).join(',')==='009933' &&
      colors(sun).join(',')==='ff0000,ff0000' &&
      moonCopy!==sharedMaterial && (moonCopy as THREE.MeshBasicMaterial).map===sharedTexture;
    checks.originalStillNeverMutated = color(sharedMaterial)==='171717' &&
      originalMaterialDisposed===0 && originalTextureDisposed===0;
    // Release B's first selection before retargeting its active relation.
    // Otherwise setScene() would legitimately paint the new Saturn before
    // we can inspect the material supplied by the transferring A canvas.
    b.highlight(null);

    // Move the already focused Saturn from A to B. B then uses the
    // transferred symbol as its relation partner while the A clone still
    // exists. The baseline must be the untinted source material, not A's
    // temporary clone, otherwise teardown restores a disposed material.
    groupB.add(saturn);
    b.setRelations([{
      from:{layer:'natal',name:'Moon'},
      to:{layer:'transit',name:'Saturn'},
      type:'quadrato',orb:1
    }]);
    b.setScene(sceneB);
    const saturnBeforeB = saturn.material as THREE.Material;
    checks.movedWasPreviouslyTinted = saturnBeforeB===saturnCopyA;
    b.highlight({layer:'natal',name:'Moon'});
    const saturnCopyB = saturn.material as THREE.Material;
    saturnCopyB.addEventListener('dispose',()=>disposedSaturnB++);
    checks.destinationClonesFromUntintedBase =
      saturnCopyB!==saturnCopyA && saturnCopyB!==sharedMaterial &&
      color(saturnCopyB)==='9e02ff' &&
      (saturnCopyB as THREE.MeshBasicMaterial).map===sharedTexture;

    a.highlight(null);
    checks.sourceClearDoesNotStompDestination =
      saturn.material===saturnCopyB && color(saturnCopyB)==='9e02ff' &&
      disposedSaturnA===1 && disposedSunCopies===2 &&
      colors(moon).join(',')==='c0c0c0';
    b.highlight(null);
    checks.destinationRestoresLiveBaseNotDisposedClone =
      saturn.material===sharedMaterial && moon.material===sharedMaterial &&
      color(sharedMaterial)==='171717' && disposedSaturnB===1;
    checks.originalTextureNeverDisposed = originalMaterialDisposed===0 &&
      originalTextureDisposed===0;

    // Future focus cycles must work after the cross-controller teardown.
    b.highlight({layer:'natal',name:'Moon'});
    checks.refocusAfterTransferWorks = colors(saturn).join(',')==='9e02ff' &&
      colors(moon).join(',')==='c0c0c0' && color(sharedMaterial)==='171717';
    b.highlight(null);
  } finally {
    a.destroy();
    b.destroy();
    for (const m of [sun,saturn,moon,venus]) m.geometry.dispose();
    sharedMaterial.dispose();
    sharedTexture.dispose();
    canvases.forEach(c=>c.remove());
  }
  return checks;
};
