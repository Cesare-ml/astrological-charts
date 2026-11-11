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
  const x = -radius * Math.sin(angleRadians);
  // Math.sin(0) === 0, but negating the result produces -0. Keep an
  // ordinary +0 for stable snapshot/strict-equality geometry tests.
  return { x: x === 0 ? 0 : x, y: radius * Math.cos(angleRadians) };
}
