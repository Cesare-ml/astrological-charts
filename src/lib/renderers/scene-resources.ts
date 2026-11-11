import * as THREE from 'three';
import { stopSceneAnimations } from './scene-animations';

/**
 * Release resources owned by a rendered or partially constructed scene.
 * Within one call, shared geometry, materials and textures are disposed once.
 * Do not use this on a subtree whose resources are still owned by a live chart.
 */
export function disposeSceneResources(root: THREE.Object3D): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  root.traverse((object: any) => {
    stopSceneAnimations(object);
    if (object.geometry) geometries.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (!material) continue;
      materials.add(material);
      for (const value of Object.values(material)) {
        if (value instanceof THREE.Texture) textures.add(value);
      }
      // A ShaderMaterial's texture uniforms are held in uniform.value, not
      // as direct material properties. Arrays may share texture instances.
      const uniforms = (material as THREE.ShaderMaterial).uniforms;
      if (uniforms) for (const uniform of Object.values(uniforms)) {
        const value = uniform?.value;
        if (value instanceof THREE.Texture) textures.add(value);
        else if (Array.isArray(value)) for (const item of value) {
          if (item instanceof THREE.Texture) textures.add(item);
        }
      }
    }
  });
  textures.forEach(texture => texture.dispose());
  materials.forEach(material => material.dispose());
  geometries.forEach(geometry => geometry.dispose());
}
