import type * as THREE from 'three';

// Timelines belong to the scene object they animate, not to a global cache.
const sceneAnimations = new WeakMap<THREE.Object3D, Array<{kill(): unknown}>>();

export function registerSceneAnimation(object: THREE.Object3D, animation: {kill(): unknown}): void {
  const animations = sceneAnimations.get(object) ?? [];
  animations.push(animation);
  sceneAnimations.set(object, animations);
}

/** Always release the registry and attempt every kill, even if one timeline fails. */
export function stopSceneAnimations(object: THREE.Object3D): void {
  const animations = sceneAnimations.get(object);
  if (!animations) return;

  // A failed or re-entrant kill must not leave the old registry attached.
  sceneAnimations.delete(object);
  let failures = 0;
  for (const animation of animations) {
    try {
      animation.kill();
    } catch {
      // Scene disposal must continue to release other timelines and GPU resources.
      failures++;
    }
  }
  if (failures > 0) {
    console.warn(`Failed to stop ${failures} scene animation(s) during cleanup.`);
  }
}
