/** Rendering geometry only: never calculates planetary positions or aspects. */
export interface ChartPoint2D { x: number; y: number; }

/** Polar endpoint on the canonical central aspect circle. */
export function chartAspectCirclePoint(
  angleRadians: number,
  radius: number
): ChartPoint2D | null {
  if (!Number.isFinite(angleRadians) || !Number.isFinite(radius) || radius <= 0) return null;
  return { x: radius * Math.cos(angleRadians), y: radius * Math.sin(angleRadians) };
}
