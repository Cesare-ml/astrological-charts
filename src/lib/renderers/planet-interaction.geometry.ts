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

/**
 * End the highlighted radial guide just before the real outer transit ring.
 * Both radii are measured in the same world-space units. A small clearance
 * keeps the dash from crossing the glyph's own ring or text; it cannot
 * change the chart's angular longitude or any astrological calculation.
 * Return null for invalid or nearly coincident circles.
 */
export function chartTransitConnectorRadii(
  innerRadius: number,
  transitRingRadius: number
): { startRadius: number; endRadius: number } | null {
  if (!Number.isFinite(innerRadius) || !Number.isFinite(transitRingRadius) ||
      innerRadius <= 0 || transitRingRadius <= innerRadius + 0.045) return null;
  const distance = transitRingRadius - innerRadius;
  const clearance = Math.min(0.11, Math.max(0.025, distance * 0.12));
  const endRadius = transitRingRadius - clearance;
  if (endRadius <= innerRadius + 0.02) return null;
  return { startRadius: innerRadius, endRadius };
}
