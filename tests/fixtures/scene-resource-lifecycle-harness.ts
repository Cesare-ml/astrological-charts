import * as THREE from 'three';
import { disposeSceneResources } from '../../src/lib/renderers/scene-resources';
import { registerSceneAnimation } from '../../src/lib/renderers/scene-animations';

declare global {
  interface Window {
    runSceneResourceLifecycleProbe?: () => {
      sharedGeometryDisposedOnce: boolean;
      sharedMaterialDisposedOnce: boolean;
      sharedTextureDisposedOnce: boolean;
      distinctMaterialDisposedOnce: boolean;
      groupAnimationsStopped: boolean;
      childAnimationsStopped: boolean;
      detachedMeshUnchanged: boolean;
    };
  }
}

/** No browser assets or user data: synthetic Three.js scene ownership probe. */
window.runSceneResourceLifecycleProbe = () => {
  const root = new THREE.Group();
  const group = new THREE.Group();
  root.add(group);
  const geometry = new THREE.PlaneGeometry(1, 1);
  const texture = new THREE.Texture();
  const material = new THREE.MeshBasicMaterial({map:texture});
  const secondMaterial = new THREE.MeshBasicMaterial();
  const detachedGeometry = new THREE.PlaneGeometry(1, 1);
  const detachedMaterial = new THREE.MeshBasicMaterial();
  const detachedMesh = new THREE.Mesh(detachedGeometry,detachedMaterial);
  group.add(new THREE.Mesh(geometry,material));
  group.add(new THREE.Mesh(geometry,material));
  group.add(new THREE.Mesh(geometry,[material,secondMaterial]));
  let geometryCount = 0, materialCount = 0, textureCount = 0;
  let secondMaterialCount = 0, detachedCount = 0;
  let groupAnimations = 0, childAnimations = 0;
  geometry.addEventListener('dispose', () => { geometryCount++; });
  material.addEventListener('dispose', () => { materialCount++; });
  texture.addEventListener('dispose', () => { textureCount++; });
  secondMaterial.addEventListener('dispose', () => { secondMaterialCount++; });
  detachedGeometry.addEventListener('dispose', () => { detachedCount++; });
  registerSceneAnimation(group,{kill:()=>{groupAnimations++;}});
  registerSceneAnimation(group.children[0],{kill:()=>{childAnimations++;}});
  disposeSceneResources(root);
  const result = {
    sharedGeometryDisposedOnce:geometryCount === 1,
    sharedMaterialDisposedOnce:materialCount === 1,
    sharedTextureDisposedOnce:textureCount === 1,
    distinctMaterialDisposedOnce:secondMaterialCount === 1,
    groupAnimationsStopped:groupAnimations === 1,
    childAnimationsStopped:childAnimations === 1,
    detachedMeshUnchanged:detachedCount === 0
  };
  detachedGeometry.dispose();
  detachedMaterial.dispose();
  return result;
};
