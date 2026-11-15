import * as THREE from 'three';
import { disposeSceneResources } from '../../src/lib/renderers/scene-resources';
import { registerSceneAnimation } from '../../src/lib/renderers/scene-animations';

declare global {
  interface Window {
    runSceneResourceLifecycleProbe?: () => {
      sharedGeometryDisposedOnce: boolean;
      sharedMaterialDisposedOnce: boolean;
      sharedTextureDisposedOnce: boolean;
      shaderUniformTextureDisposedOnce: boolean;
      shaderUniformMaterialDisposedOnce: boolean;
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
  const shaderTexture = new THREE.Texture();
  const shaderMaterial = new THREE.ShaderMaterial({
    uniforms: {
      single: {value: shaderTexture},
      multiple: {value: [shaderTexture, texture]},
      brightness: {value: 1.5}
    },
    vertexShader:'void main(){gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader:'void main(){gl_FragColor=vec4(1.0);}'
  });
  const detachedGeometry = new THREE.PlaneGeometry(1, 1);
  const detachedMaterial = new THREE.MeshBasicMaterial();
  const detachedMesh = new THREE.Mesh(detachedGeometry,detachedMaterial);
  group.add(new THREE.Mesh(geometry,material));
  group.add(new THREE.Mesh(geometry,material));
  group.add(new THREE.Mesh(geometry,[material,secondMaterial]));
  group.add(new THREE.Mesh(geometry,shaderMaterial));
  let geometryCount = 0, materialCount = 0, textureCount = 0;
  let secondMaterialCount = 0, shaderMaterialCount = 0;
  let shaderTextureCount = 0, detachedCount = 0;
  let groupAnimations = 0, childAnimations = 0;
  geometry.addEventListener('dispose', () => { geometryCount++; });
  material.addEventListener('dispose', () => { materialCount++; });
  texture.addEventListener('dispose', () => { textureCount++; });
  secondMaterial.addEventListener('dispose', () => { secondMaterialCount++; });
  shaderMaterial.addEventListener('dispose', () => { shaderMaterialCount++; });
  shaderTexture.addEventListener('dispose', () => { shaderTextureCount++; });
  detachedGeometry.addEventListener('dispose', () => { detachedCount++; });
  registerSceneAnimation(group,{kill:()=>{groupAnimations++;}});
  registerSceneAnimation(group.children[0],{kill:()=>{childAnimations++;}});
  disposeSceneResources(root);
  const result = {
    sharedGeometryDisposedOnce:geometryCount === 1,
    sharedMaterialDisposedOnce:materialCount === 1,
    sharedTextureDisposedOnce:textureCount === 1,
    shaderUniformTextureDisposedOnce:shaderTextureCount === 1,
    shaderUniformMaterialDisposedOnce:shaderMaterialCount === 1,
    distinctMaterialDisposedOnce:secondMaterialCount === 1,
    groupAnimationsStopped:groupAnimations === 1,
    childAnimationsStopped:childAnimations === 1,
    detachedMeshUnchanged:detachedCount === 0
  };
  detachedGeometry.dispose();
  detachedMaterial.dispose();
  return result;
};
