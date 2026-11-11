/** Rendering geometry only: never calculates planetary positions or aspects. */
export interface ChartPoint2D { x: number; y: number; }

/**
 * Position on the canonical central aspect circle, rotating the top point (0,r).
 * Match AspettiRender.renderArchi: new THREE.Vector2(0, r).rotateAround(origin, angle).
 * This is NOT the conventional cos/sin polar coordinate (which starts at right).
 */
export function chartAspectCirclePoint(
  angleRadians: number,
  radius: number
): ChartPoint2D | null {
  if (!Number.isFinite(angleRadians) || !Number.isFinite(radius) || radius <= 0) return null;
  return { x: -radius * Math.sin(angleRadians), y: radius * Math.cos(angleRadians) };
}
