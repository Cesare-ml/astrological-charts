import * as THREE from 'three';

// Timelines belong to the scene object they animate, not to a global cache.
const sceneAnimations = new WeakMap<THREE.Object3D, Array<{kill(): unknown}>>();

export function registerSceneAnimation(object: THREE.Object3D, animation: {kill(): unknown}): void {
  const animations = sceneAnimations.get(object) ?? [];
  animations.push(animation);
  sceneAnimations.set(object, animations);
}

export function stopSceneAnimations(object: THREE.Object3D): void {
  for (const animation of sceneAnimations.get(object) ?? []) animation.kill();
  sceneAnimations.delete(object);
}
