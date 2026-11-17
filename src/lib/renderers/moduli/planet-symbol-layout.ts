/** Collision-aware placements for symbols around a circular chart.
 *
 * The longitude is never modified: `displayDegree` only determines where the
 * glyph is drawn. Callers must anchor ticks and leader lines to the source
 * longitude, not to the displaced glyph.
 */
export interface SymbolPosition {
  displayDegree: number;
  radius: number;
}

interface Body {
  key: string;
  degree: number;
  unwrapped: number;
}

export function normalizeDegree(degree: number): number {
  return ((degree % 360) + 360) % 360;
}

/** Integer degree within the current sign (0–29), never the displaced angle. */
export function degreeWithinSign(longitude: number): number {
  return Math.floor(normalizeDegree(longitude) % 30);
}

// Least-squares projection onto ordered positions separated by minGap. The
// pooled-adjacent-violators solution spreads a conjunction *both* ways rather
// than pushing every following body forward (as the old two-pass loop did).
function spreadLane(bodies: Body[], minGap: number): number[] {
  const blocks: Array<{ start: number; end: number; sum: number; count: number }> = [];
  bodies.forEach((body, i) => {
    blocks.push({ start: i, end: i, sum: body.unwrapped - i * minGap, count: 1 });
    while (blocks.length > 1) {
      const b = blocks[blocks.length - 1];
      const a = blocks[blocks.length - 2];
      if (a.sum / a.count <= b.sum / b.count) break;
      a.end = b.end;
      a.sum += b.sum;
      a.count += b.count;
      blocks.pop();
    }
  });
  const result = new Array<number>(bodies.length);
  for (const block of blocks) {
    const mean = block.sum / block.count;
    for (let i = block.start; i <= block.end; i++) result[i] = mean + i * minGap;
  }
  return result;
}

export function layoutPlanetSymbols(
  longitudes: Record<string, number>,
  innerRadius: number,
  outerRadius: number,
  symbolWidth: number,
  symbolHeight: number,
  showDegrees: boolean,
  chartRotation = 0,
): Record<string, SymbolPosition> {
  const bodies: Body[] = Object.entries(longitudes)
    .filter(([, longitude]) => Number.isFinite(longitude))
    .map(([key, longitude]) => ({ key, degree: normalizeDegree(longitude), unwrapped: 0 }))
    .sort((a, b) => a.degree - b.degree || a.key.localeCompare(b.key));
  if (!bodies.length) return {};

  // Start after the widest empty arc so conjunctions crossing 0° stay together.
  let start = 0;
  let largestGap = -1;
  for (let i = 0; i < bodies.length; i++) {
    const next = (i + 1) % bodies.length;
    const gap = bodies[next].degree + (next <= i ? 360 : 0) - bodies[i].degree;
    if (gap > largestGap) { largestGap = gap; start = next; }
  }
  const circular = Array.from({ length: bodies.length }, (_, i) => {
    const index = (start + i) % bodies.length;
    return { ...bodies[index], unwrapped: bodies[index].degree + (index < start ? 360 : 0) };
  });

  const radiusMid = (innerRadius + outerRadius) / 2;
  const margin = 0.015 + symbolHeight / 2;
  const canUseTwoLanes = outerRadius - innerRadius >= 2 * margin + symbolHeight + 0.02;
  const radii = canUseTwoLanes
    ? [innerRadius + margin, outerRadius - margin]
    : [radiusMid];
  // Degree labels sit beside the glyph, so their *horizontal* footprint counts.
  const footprint = symbolWidth + (showDegrees ? symbolWidth * 0.53 : 0) + 0.018;
  const minimumGap = radii.map(radius =>
    2 * Math.asin(Math.min(1, footprint / (2 * radius))) * 180 / Math.PI);
  const lanes: Body[][] = radii.map(() => []);
  const lastAvailable = radii.map(() => -Infinity);

  for (const body of circular) {
    let selected = 0;
    let lowestPenalty = Infinity;
    for (let lane = 0; lane < lanes.length; lane++) {
      const penalty = Math.max(0, lastAvailable[lane] + minimumGap[lane] - body.unwrapped)
        + lane * 0.01;
      if (penalty < lowestPenalty) { lowestPenalty = penalty; selected = lane; }
    }
    lanes[selected].push(body);
    lastAvailable[selected] = Math.max(body.unwrapped, lastAvailable[selected] + minimumGap[selected]);
  }

  const result: Record<string, SymbolPosition> = {};
  lanes.forEach((lane, index) => {
    const angles = spreadLane(lane, minimumGap[index]);
    lane.forEach((body, i) => {
      result[body.key] = { displayDegree: normalizeDegree(angles[i]), radius: radii[index] };
    });
  });
  // Keep unconnected, well-separated glyphs on the original central orbit.
  // Radial staggering is only noticeable where there is actual crowding.
  if (canUseTwoLanes) {
    bodies.forEach((body, i) => {
      const previous = bodies[(i + bodies.length - 1) % bodies.length];
      const next = bodies[(i + 1) % bodies.length];
      const gapBefore = normalizeDegree(body.degree - previous.degree);
      const gapAfter = normalizeDegree(next.degree - body.degree);
      if (bodies.length === 1 ||
          (gapBefore > minimumGap[0] && gapAfter > minimumGap[0])) {
        result[body.key].radius = radiusMid;
      }
    });
  }

  // Radial separation alone is insufficient around the diagonal quadrants:
  // horizontal glyphs in different lanes may still overlap in screen X/Y.
  // Resolve the remaining real bounding-box collisions with small, symmetric
  // angular nudges. The rotation is the same one used by the Three.js scene.
  function rectangles(body: SymbolPosition) {
    const radians = (chartRotation + body.displayDegree) * Math.PI / 180;
    const x = -Math.sin(radians) * body.radius;
    const y = Math.cos(radians) * body.radius;
    const output = [{ x, y, width: symbolWidth, height: symbolHeight }];
    if (showDegrees) {
      const offset = symbolWidth * (0.17 / 0.22);
      output.push({
        x: x - Math.cos(radians) * offset,
        y: y - Math.sin(radians) * offset,
        width: symbolWidth * (0.12 / 0.22),
        height: symbolWidth * (0.06 / 0.22),
      });
    }
    return output;
  }
  function collides(first: SymbolPosition, second: SymbolPosition): boolean {
    for (const a of rectangles(first)) for (const b of rectangles(second)) {
      const dx = (a.width + b.width) / 2 - Math.abs(a.x - b.x);
      const dy = (a.height + b.height) / 2 - Math.abs(a.y - b.y);
      if (dx > 0 && dy > 0) return true;
    }
    return false;
  }
  const keys = circular.map(body => body.key);
  for (let iteration = 0; iteration < 400; iteration++) {
    let adjusted = false;
    for (let i = 0; i < keys.length; i++) for (let j = i + 1; j < keys.length; j++) {
      const a = result[keys[i]], b = result[keys[j]];
      if (!collides(a, b)) continue;
      const separation = ((b.displayDegree - a.displayDegree + 540) % 360) - 180;
      const direction = separation < 0 ? -1 : 1;
      a.displayDegree -= 0.35 * direction;
      b.displayDegree += 0.35 * direction;
      adjusted = true;
    }
    if (!adjusted) break;
  }
  for (const key of keys) result[key].displayDegree = normalizeDegree(result[key].displayDegree);
  return result;
}
