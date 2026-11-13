import type * as THREE from 'three';

// Timelines belong to the scene object they animate, not to a global cache.
// A Set prevents a single timeline from being killed twice if it was registered
// more than once for the same scene object.
type SceneAnimation = { kill(): unknown };
const sceneAnimations = new WeakMap<THREE.Object3D, Set<SceneAnimation>>();

export function registerSceneAnimation(object: THREE.Object3D, animation: SceneAnimation): void {
  let animations = sceneAnimations.get(object);
  if (!animations) {
    animations = new Set<SceneAnimation>();
    sceneAnimations.set(object, animations);
  }
  animations.add(animation);
}

export function stopSceneAnimations(object: THREE.Object3D): void {
  const animations = sceneAnimations.get(object);
  if (!animations) return;

  // Unregister before calling external kill() hooks: they may recursively call
  // stopSceneAnimations or register a replacement timeline for the same object.
  sceneAnimations.delete(object);
  for (const animation of animations) animation.kill();
}
