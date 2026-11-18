/** Collision-aware placements for symbols around a circular chart.
 *
 * The longitude is never modified: `displayDegree` only determines where the
 * glyph is drawn. Callers must anchor ticks and leader lines to the source
 * longitude, not to the displaced glyph.
 */
export interface SymbolPosition {
  displayDegree: number;
  radius: number;
  /** Glyph size relative to the requested dimensions (crowded groups only). */
  scale?: number;
}

export interface BoundedSymbolOptions {
  /** Maximum difference between a symbol's displayed and true longitude. */
  maxAngularDisplacement: number;
  /** Dimensions of the degree badge placed beside the glyph. */
  labelWidth?: number;
  labelHeight?: number;
  /** Tangential distance from glyph centre to degree badge centre. */
  labelTangentOffset?: number;
  /** Prefer one fixed radius; use only one second radius for conjunctions. */
  fixedTwoLanes?: boolean;
  /** Inward radial offset of the degree annotation from its planet. */
  labelRadialOffset?: number;
  /** Enlargement reserved for genuinely isolated bodies, not conjunctions. */
  isolatedScale?: number;
  /** Extra inward gap between an isolated glyph and the zodiac ring. */
  isolatedRadialInset?: number;
  /** Real house-boundary ticks, checked against each degree badge separately. */
  houseTickInnerRadius?: number;
  houseTickOuterRadius?: number;
  /** Preserve the full-size natal symbols within a reduced composite wheel. */
  compactPrimaryTransit?: boolean;
}

export interface CompositeSymbolOptions {
  /** Longitudes of the primary chart's axes, whose external arrows must stay clear. */
  protectedAxisDegrees?: number[];
  /** Transits sit directly outside the external degree ruler, not at the far edge. */
  preferInnerOrbit?: boolean;
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

/**
 * Compact composite wheels (transits and synastry) use exactly one preferred
 * orbit, with a single second orbit for conjunctions. Their relatively thin
 * bands must never trigger the adaptive multi-radius natal fallback.
 *
 * The true longitude is deliberately untouched: only the display angle may
 * shift, and all geometry/ephemerides retain their source coordinates.
 */
export function layoutCompositePlanetSymbols(
  longitudes: Record<string, number>, innerRadius: number, outerRadius: number,
  symbolWidth: number, symbolHeight: number, chartRotation = 0,
  options: CompositeSymbolOptions = {},
): Record<string, SymbolPosition> {
  const bodies = Object.entries(longitudes)
    .filter(([, longitude]) => Number.isFinite(longitude))
    .map(([key, longitude]) => ({key, degree: normalizeDegree(longitude)}));
  if (!bodies.length) return {};

  // A margin around the full square bounding box keeps rotated positions
  // inside the thin ring even at 45 degrees on the screen.
  const clearance = Math.max(symbolWidth, symbolHeight) / 2 + 0.015;
  // In transit mode the ruler extends up to 0.08 beyond the zodiac. Keep the
  // main planet orbit just past that tick line, and use the outer orbit only
  // when needed for conjunctions. Synastry uses its existing outer preference.
  const nearGridRadius = innerRadius + 0.08 + clearance + 0.012;
  const mainRadius = options.preferInnerOrbit ? nearGridRadius : outerRadius - clearance;
  if (mainRadius <= innerRadius + clearance) {
    throw new Error('Insufficient space for the composite planetary ring');
  }
  const secondRadius = options.preferInnerOrbit
    ? outerRadius - clearance : mainRadius - Math.max(symbolWidth, symbolHeight) - 0.015;
  const secondFits = options.preferInnerOrbit
    ? secondRadius > mainRadius + 0.065
    : secondRadius >= innerRadius + clearance;
  const radii = secondFits
    ? [mainRadius, secondRadius] : [mainRadius];
  const protectedDegrees = (options.protectedAxisDegrees ?? [])
    .filter(Number.isFinite)
    .flatMap(degree => [normalizeDegree(degree), normalizeDegree(degree + 180)]);
  const minAxisGap = (radius: number) =>
    Math.asin(Math.min(1, (Math.max(symbolWidth, symbolHeight) / 2 + 0.035) / radius)) * 180 / Math.PI + 3.5;
  const distanceDegrees = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180);
  const blockedByAxis = (angle: number, radius: number) =>
    protectedDegrees.some(axis => distanceDegrees(angle, axis) < minAxisGap(radius));

  function collides(a: SymbolPosition, b: SymbolPosition): boolean {
    const ar = (chartRotation + a.displayDegree) * Math.PI / 180;
    const br = (chartRotation + b.displayDegree) * Math.PI / 180;
    const ax = -Math.sin(ar) * a.radius, ay = Math.cos(ar) * a.radius;
    const bx = -Math.sin(br) * b.radius, by = Math.cos(br) * b.radius;
    return Math.abs(ax - bx) < symbolWidth + 0.012 &&
      Math.abs(ay - by) < symbolHeight + 0.012;
  }

  // Place tight conjunctions from their centre first, and keep the result
  // independent of the caller's planet enumeration order. An isolated body
  // stays on the main orbit at its true longitude whenever possible.
  const ordered = [...bodies].sort((a, b) => {
    const density = (body: typeof a) => Math.min(...bodies
      .filter(other => other.key !== body.key)
      .map(other => distanceDegrees(body.degree, other.degree)), 360);
    return density(a) - density(b) || a.degree - b.degree || a.key.localeCompare(b.key);
  });

  const placements: Record<string, SymbolPosition> = {};
  const occupied: SymbolPosition[] = [];
  // The inner lane costs roughly 2 degrees of display movement: ordinary
  // isolated symbols therefore occupy one shared radius, while conjunctions
  // can share their real longitude on two clearly separated radial tracks.
  const proposals: Array<{delta: number; lane: number; cost: number}> = [];
  for (let step = 0; step <= 240; step++) {
    const magnitude = step * 0.5;
    for (const sign of step ? [-1, 1] : [1]) {
      radii.forEach((_, lane) => proposals.push({
        delta: sign * magnitude, lane, cost: magnitude + (lane ? 2 : 0),
      }));
    }
  }
  proposals.sort((a, b) => a.cost - b.cost || a.lane - b.lane ||
    Math.abs(a.delta) - Math.abs(b.delta) || a.delta - b.delta);

  for (const body of ordered) {
    const found = proposals.find(({delta, lane}) => {
      const displayDegree = normalizeDegree(body.degree + delta);
      const radius = radii[lane];
      if (blockedByAxis(displayDegree, radius)) return false;
      return !occupied.some(other => collides({displayDegree, radius}, other));
    });
    if (!found) {
      throw new Error(`Unable to place composite planet ${body.key} on two orbits`);
    }
    const position = {displayDegree: normalizeDegree(body.degree + found.delta),
      radius: radii[found.lane]};
    placements[body.key] = position;
    occupied.push(position);
  }
  return placements;
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

interface TickSegment { x1: number; y1: number; x2: number; y2: number }

function houseTickSegments(bodies: Body[], rotation: number, options: BoundedSymbolOptions): TickSegment[] {
  const from = options.houseTickInnerRadius;
  const to = options.houseTickOuterRadius;
  if (from === undefined || to === undefined || to <= from) return [];
  return bodies.filter(body => !['AS', 'DS', 'MC', 'IC'].includes(body.key)).map(body => {
    const radians = (rotation + body.degree) * Math.PI / 180;
    return { x1: -Math.sin(radians) * from, y1: Math.cos(radians) * from,
      x2: -Math.sin(radians) * to, y2: Math.cos(radians) * to };
  });
}

/** The degree's actual rectangular footprint may not cover *any* tick line. */
function badgeClearsTicks(position: SymbolPosition, rotation: number,
  radialOffset: number, tangentOffset: number, labelWidth: number, labelHeight: number,
  ticks: TickSegment[]): boolean {
  if (!ticks.length) return true;
  const scale = position.scale ?? 1;
  const angle = (rotation + position.displayDegree) * Math.PI / 180;
  const x = -Math.sin(angle) * (position.radius - radialOffset * scale) - Math.cos(angle) * tangentOffset * scale;
  const y = Math.cos(angle) * (position.radius - radialOffset * scale) - Math.sin(angle) * tangentOffset * scale;
  const clearance = 0.006; // line thickness + a small screen-space breathing room
  const left = x - labelWidth * scale / 2 - clearance;
  const right = x + labelWidth * scale / 2 + clearance;
  const bottom = y - labelHeight * scale / 2 - clearance;
  const top = y + labelHeight * scale / 2 + clearance;

  for (const tick of ticks) {
    // Parametric segment vs axis-aligned rectangle (slab clipping). A line
    // may cross a badge even when both endpoints lie outside its rectangle.
    let start = 0, end = 1;
    for (const [coordinate, delta, min, max] of [
      [tick.x1, tick.x2 - tick.x1, left, right],
      [tick.y1, tick.y2 - tick.y1, bottom, top],
    ]) {
      if (Math.abs(delta) < 1e-12) {
        if (coordinate < min || coordinate > max) { start = 2; break; }
      } else {
        const a = (min - coordinate) / delta;
        const b = (max - coordinate) / delta;
        start = Math.max(start, Math.min(a, b));
        end = Math.min(end, Math.max(a, b));
        if (start > end) break;
      }
    }
    if (start <= end) return false;
  }
  return true;
}

/** Fixed-size, two-track layout for ordinary conjunctions.
 * For mathematically overfull clusters the caller can retain the established
 * adaptive fallback rather than losing a planet or failing the entire chart.
 */
function layoutTwoFixedLanes(
  bodies: Body[], innerRadius: number, outerRadius: number,
  symbolWidth: number, symbolHeight: number, showDegrees: boolean,
  chartRotation: number, options: BoundedSymbolOptions,
): Record<string, SymbolPosition> | undefined {
  const labelWidth = options.labelWidth ?? 0.13;
  const labelHeight = options.labelHeight ?? 0.075;
  const radialOffset = options.labelRadialOffset ?? 0.15;
  const tangentOffset = options.labelTangentOffset ?? 0;
  const isolatedScale = Math.max(1, options.isolatedScale ?? 1);
  // Reserve enough room for the isolated large glyph independently: making
  // its inward inset should not unnecessarily compress the conjunction lanes.
  const compactPrimaryTransit = options.compactPrimaryTransit === true;
  const outerLane = outerRadius - symbolWidth / 2 - (compactPrimaryTransit ? 0.012 : 0.03);
  const isolatedLane = Math.min(outerLane,
    outerRadius - symbolWidth * isolatedScale / 2 - 0.01 - Math.max(0, options.isolatedRadialInset ?? 0));
  const innerLane = Math.max(
    innerRadius + (showDegrees ? radialOffset + labelWidth / 2 : symbolWidth / 2) + 0.01,
    compactPrimaryTransit && showDegrees && options.houseTickOuterRadius !== undefined
      ? options.houseTickOuterRadius + radialOffset + labelHeight / 2 + 0.006
      : 0,
  );
  if (innerLane >= outerLane - symbolWidth - 0.015) return undefined;
  const ticks = showDegrees ? houseTickSegments(bodies, chartRotation, options) : [];

  function boxes(position: SymbolPosition) {
    const scale = position.scale ?? 1;
    const theta = (chartRotation + position.displayDegree) * Math.PI / 180;
    const x = -Math.sin(theta) * position.radius;
    const y = Math.cos(theta) * position.radius;
    const objects = [{x, y, w: symbolWidth * scale, h: symbolHeight * scale}];
    if (showDegrees) objects.push({
      x: x + Math.sin(theta) * radialOffset * scale - Math.cos(theta) * tangentOffset * scale,
      y: y - Math.cos(theta) * radialOffset * scale - Math.sin(theta) * tangentOffset * scale,
      w: labelWidth * scale, h: labelHeight * scale,
    });
    return objects;
  }
  function collides(a: SymbolPosition, b: SymbolPosition) {
    for (const first of boxes(a)) for (const second of boxes(b)) {
      if (Math.abs(first.x - second.x) < (first.w + second.w) / 2 + 0.002 &&
          Math.abs(first.y - second.y) < (first.h + second.h) / 2 + 0.002) return true;
    }
    return false;
  }

  const source = [...bodies].sort((a, b) => a.degree - b.degree || a.key.localeCompare(b.key));
  let cut = 0, widest = -1;
  for (let i = 0; i < source.length; i++) {
    const next = (i + 1) % source.length;
    const gap = source[next].degree + (next <= i ? 360 : 0) - source[i].degree;
    if (gap > widest) { widest = gap; cut = next; }
  }
  const circular = Array.from({length: source.length}, (_, index) => {
    const originalIndex = (cut + index) % source.length;
    return {...source[originalIndex], unwrapped: source[originalIndex].degree + (originalIndex < cut ? 360 : 0)};
  });
  const groups: Body[][] = [];
  for (const body of circular) {
    if (!groups.length || body.unwrapped - groups[groups.length - 1][groups[groups.length - 1].length - 1].unwrapped > 16) groups.push([]);
    groups[groups.length - 1].push(body);
  }
  const placed: Record<string, SymbolPosition> = {};
  const driftLimit = options.maxAngularDisplacement;
  const deltas = [0];
  for (let delta = 0.5; delta <= driftLimit + 1e-8; delta += 0.5) {
    deltas.push(-Math.min(delta, driftLimit), Math.min(delta, driftLimit));
  }
  if (deltas.every(delta => Math.abs(delta) < driftLimit - 1e-8)) deltas.push(-driftLimit, driftLimit);

  for (const group of groups) {
    // Every truly solitary body is larger. Neighbours in a conjunction keep
    // the compact uniform footprint, whether they occupy one or two lanes.
    const groupScale = group.length === 1 ? isolatedScale : 1;
    const fixed = Object.values(placed);
    const center = (group[0].unwrapped + group[group.length - 1].unwrapped) / 2;
    const centerFirst = [...group].sort((a, b) =>
      Math.abs(a.unwrapped - center) - Math.abs(b.unwrapped - center) || a.unwrapped - b.unwrapped);
    const orders = [centerFirst, group, [...group].reverse(), [...centerFirst].reverse()];
    const tryGroup = (radii: number[]): Record<string, SymbolPosition> | undefined => {
      for (const order of orders) {
        const chosen: Record<string, SymbolPosition> = {};
        let explored = 0;
        // A dense seven-body group may be geometrically impossible within two
        // fixed tracks. Bound the search so rendering never stalls the UI.
        const maxSearchNodes = compactPrimaryTransit ? 150000 : group.length >= 7 ? 3000 : 13000;
        const search = (i: number): boolean => {
          if (i === order.length) return true;
          if (++explored > maxSearchNodes) return false;
          const body = order[i];
          for (const delta of deltas) for (const radius of radii) {
            const candidate = {displayDegree: normalizeDegree(body.degree + delta), radius, scale: groupScale};
            if (!badgeClearsTicks(candidate, chartRotation, radialOffset, tangentOffset,
              labelWidth, labelHeight, ticks)) continue;
            if (fixed.some(other => collides(candidate, other)) ||
                Object.values(chosen).some(other => collides(candidate, other))) continue;
            chosen[body.key] = candidate;
            if (search(i + 1)) return true;
            delete chosen[body.key];
          }
          return false;
        };
        if (search(0)) return chosen;
      }
      return undefined;
    };
    // One main orbit for most charts; introduce the inner orbit only when
    // the actual body/degree rectangles would collide.
    const span = group[group.length - 1].unwrapped - group[0].unwrapped;
    const minimumSameLaneGap = 2 * Math.atan2(Math.min(symbolWidth, symbolHeight) / 2,
      outerLane) * 180 / Math.PI;
    const needsTwoLanes = span < (group.length - 1) * minimumSameLaneGap;
    const radii = group.length === 1 ? [isolatedLane] : [outerLane, innerLane];
    const match = (needsTwoLanes ? undefined : tryGroup([radii[0]])) ??
      (group.length === 1 ? undefined : tryGroup(radii));
    if (!match) return undefined;
    Object.assign(placed, match);
  }
  return placed;
}

/**
 * A dense conjunction cannot be shown faithfully by spreading positions around
 * the zodiac. Instead, use additional radial tracks. If even those are full,
 * reduce only the glyphs in that group, preserving their true order/longitude.
 * Each candidate is checked against its actual screen-aligned glyph and label
 * rectangles, not just against distances along the circumference.
 */
function layoutBoundedSymbols(
  bodies: Body[], innerRadius: number, outerRadius: number,
  symbolWidth: number, symbolHeight: number, showDegrees: boolean,
  chartRotation: number, options: BoundedSymbolOptions,
): Record<string, SymbolPosition> {
  const maxDrift = Math.max(0, options.maxAngularDisplacement);
  const band = outerRadius - innerRadius;
  const labelWidth = options.labelWidth ?? symbolWidth * (0.12 / 0.22);
  const labelHeight = options.labelHeight ?? symbolHeight * (0.06 / (0.22 * 605 / 875));
  const tangentOffset = options.labelTangentOffset ?? symbolWidth * (0.17 / 0.22);
  const radialOffset = options.labelRadialOffset ?? 0;
  const radiusMid = (innerRadius + outerRadius) / 2;
  const isolatedScale = Math.max(1, options.isolatedScale ?? 1);
  const ticks = showDegrees ? houseTickSegments(bodies, chartRotation, options) : [];

  function rectangles(placement: SymbolPosition) {
    const angle = (chartRotation + placement.displayDegree) * Math.PI / 180;
    const scale = placement.scale ?? 1;
    const x = -Math.sin(angle) * placement.radius;
    const y = Math.cos(angle) * placement.radius;
    const boxes = [{ x, y, width: symbolWidth * scale, height: symbolHeight * scale }];
    if (showDegrees) boxes.push({
      x: x + Math.sin(angle) * radialOffset * scale - Math.cos(angle) * tangentOffset * scale,
      y: y - Math.cos(angle) * radialOffset * scale - Math.sin(angle) * tangentOffset * scale,
      width: labelWidth * scale,
      height: labelHeight * scale,
    });
    return boxes;
  }

  function collides(first: SymbolPosition, second: SymbolPosition): boolean {
    for (const a of rectangles(first)) for (const b of rectangles(second)) {
      if (Math.abs(a.x - b.x) < (a.width + b.width) / 2 + 0.004 &&
          Math.abs(a.y - b.y) < (a.height + b.height) / 2 + 0.004) return true;
    }
    return false;
  }

  // The widest gap is the natural circular break; a conjunction at 359°/0°
  // therefore belongs to one group instead of being split at the Aries point.
  const sorted = [...bodies].sort((a, b) => a.degree - b.degree || a.key.localeCompare(b.key));
  let start = 0;
  let largestGap = -1;
  for (let i = 0; i < sorted.length; i++) {
    const next = (i + 1) % sorted.length;
    const gap = sorted[next].degree + (next <= i ? 360 : 0) - sorted[i].degree;
    if (gap > largestGap) { largestGap = gap; start = next; }
  }
  const circular = Array.from({ length: sorted.length }, (_, i) => {
    const index = (start + i) % sorted.length;
    return { ...sorted[index], unwrapped: sorted[index].degree + (index < start ? 360 : 0) };
  });
  const groupGap = Math.max(9, 2 * maxDrift + 2 * Math.atan2(symbolWidth, radiusMid) * 180 / Math.PI);
  const groups: Body[][] = [];
  for (const body of circular) {
    if (!groups.length || body.unwrapped - groups[groups.length - 1][groups[groups.length - 1].length - 1].unwrapped > groupGap) {
      groups.push([]);
    }
    groups[groups.length - 1].push(body);
  }

  const placed: Record<string, SymbolPosition> = {};
  for (const group of groups) {
    const fixed = Object.values(placed);
    const center = (group[0].unwrapped + group[group.length - 1].unwrapped) / 2;
    const centerFirst = [...group].sort((a, b) =>
      Math.abs(a.unwrapped - center) - Math.abs(b.unwrapped - center) || a.unwrapped - b.unwrapped);
    const orders = [group, [...group].reverse(), centerFirst, [...centerFirst].reverse()];
    let winning: Record<string, SymbolPosition> | undefined;
    let winningScore = Infinity;

    // Uniform scaling within a dense group prevents misleading emphasis on an
    // individual planet; isolated planets always retain their full glyph size.
    const preferredScale = group.length === 1 ? isolatedScale : 1;
    const targetRadius = group.length === 1
      ? outerRadius - symbolWidth * preferredScale / 2 - 0.01 - Math.max(0, options.isolatedRadialInset ?? 0)
      : radiusMid;
    for (const fraction of [1, 0.95, 0.9, 0.85, 0.8, 0.75, 0.7, 0.65, 0.6, 0.55, 0.5,
      0.45, 0.4, 0.35, 0.3, 0.25, 0.2, 0.15, 0.1, 0.07, 0.04, 0.02]) {
      const scale = fraction * preferredScale;
      const radialMargin = symbolHeight * scale / 2 + 0.007;
      if (band < 2 * radialMargin) continue;
      const radialStep = Math.max(0.01, symbolHeight * scale * 0.42);
      const radialSlots: number[] = [];
      for (let radius = innerRadius + radialMargin; radius <= outerRadius - radialMargin + 1e-8; radius += radialStep) {
        radialSlots.push(Math.min(radius, outerRadius - radialMargin));
      }
      radialSlots.push(outerRadius - radialMargin);
      radialSlots.sort((a, b) => Math.abs(a - targetRadius) - Math.abs(b - targetRadius));
      const offsets: number[] = [0];
      const angularStep = maxDrift ? Math.min(0.5, maxDrift) : 1;
      for (let value = angularStep; value < maxDrift + 1e-8; value += angularStep) {
        offsets.push(-Math.min(value, maxDrift), Math.min(value, maxDrift));
      }
      if (maxDrift && offsets.every(value => Math.abs(value) < maxDrift - 1e-8)) {
        offsets.push(-maxDrift, maxDrift);
      }
      // Limit angular displacements first, then prefer a middle radial track.
      const candidates = (body: Body): SymbolPosition[] => offsets.flatMap(offset =>
        radialSlots.map(radius => ({ displayDegree: normalizeDegree(body.degree + offset), radius, scale })));

      for (const order of orders) {
        const selected: Record<string, SymbolPosition> = {};
        let possible = true;
        for (const body of order) {
          const location = candidates(body).find(candidate =>
          badgeClearsTicks(candidate, chartRotation, radialOffset, tangentOffset,
            labelWidth, labelHeight, ticks) && !fixed.some(other => collides(candidate, other)) &&
            !Object.values(selected).some(other => collides(candidate, other)));
          if (!location) { possible = false; break; }
          selected[body.key] = location;
        }
        if (!possible) continue;
        const locations = group.map(body => selected[body.key]);
        const drifts = group.map((body, i) =>
          Math.abs(((locations[i].displayDegree - body.degree + 540) % 360) - 180));
        const score = Math.max(...drifts) * 100 + drifts.reduce((sum, delta) => sum + delta * delta, 0)
          + locations.reduce((sum, location) => sum + Math.abs(location.radius - radiusMid), 0);
        if (score < winningScore) { winning = selected; winningScore = score; }
      }
      if (winning) break;
    }
    if (!winning) {
      // A physically impossibly dense group (or a zero-width ring) should
      // never silently spread beyond the requested longitude constraint.
      throw new Error('Insufficient radial space for collision-free planetary symbols');
    }
    Object.assign(placed, winning);
  }
  return placed;
}

export function layoutPlanetSymbols(
  longitudes: Record<string, number>,
  innerRadius: number,
  outerRadius: number,
  symbolWidth: number,
  symbolHeight: number,
  showDegrees: boolean,
  chartRotation = 0,
  bounded?: BoundedSymbolOptions,
): Record<string, SymbolPosition> {
  const bodies: Body[] = Object.entries(longitudes)
    .filter(([, longitude]) => Number.isFinite(longitude))
    .map(([key, longitude]) => ({ key, degree: normalizeDegree(longitude), unwrapped: 0 }))
    .sort((a, b) => a.degree - b.degree || a.key.localeCompare(b.key));
  if (!bodies.length) return {};
  if (bounded?.fixedTwoLanes) {
    const fixed = layoutTwoFixedLanes(bodies, innerRadius, outerRadius,
      symbolWidth, symbolHeight, showDegrees, chartRotation, bounded);
    if (fixed) return fixed;
  }
  if (bounded) return layoutBoundedSymbols(
    bodies, innerRadius, outerRadius, symbolWidth, symbolHeight,
    showDegrees, chartRotation, bounded,
  );

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

  // The angular spread is a safe fallback, but for a tight conjunction it can
  // look like a false separation of several zodiacal degrees. Repack groups
  // into *radial* slots first, and only use the minimum angular displacement
  // needed to keep the actual horizontal glyph rectangles separate. Search
  // several deterministic insertion orders: a simple forward greedy order
  // otherwise tends to push the last planet far away from the cluster.
  const denseGroups: Body[][] = [];
  let cluster: Body[] = [];
  const clusteringGap = Math.max(...minimumGap) * 1.15;
  for (const body of circular) {
    if (cluster.length && body.unwrapped - cluster[cluster.length - 1].unwrapped > clusteringGap) {
      if (cluster.length >= 3) denseGroups.push(cluster);
      cluster = [];
    }
    cluster.push(body);
  }
  if (cluster.length >= 3) denseGroups.push(cluster);

  const maxRadialOffset = Math.max(0, (outerRadius - innerRadius) / 2 - margin);
  const radiiToTry = [0, -1, 1, -0.5, 0.5].map(factor =>
    radiusMid + factor * maxRadialOffset);
  for (const group of denseGroups) {
    const members = new Set(group.map(body => body.key));
    const fixed = Object.entries(result).filter(([key]) => !members.has(key)).map(([, position]) => position);
    // All glyphs in this API have the same measured footprint. Assigning the
    // occupied screen slots back to planets in zodiacal order does not change
    // *any* collision, and eliminates misleading crossed/reversed leaders.
    const orderPositions = (positions: SymbolPosition[]): SymbolPosition[] => {
      const center = (group[0].unwrapped + group[group.length - 1].unwrapped) / 2;
      return [...positions].sort((a, b) => {
        const unwrap = (p: SymbolPosition) => center +
          ((p.displayDegree - normalizeDegree(center) + 540) % 360) - 180;
        return unwrap(a) - unwrap(b);
      });
    };
    const old = orderPositions(group.map(body => result[body.key]));
    const score = (placements: SymbolPosition[]) => {
      const drifts = placements.map((position, index) =>
        Math.abs(((position.displayDegree - group[index].degree + 540) % 360) - 180));
      return Math.max(...drifts) * 100 + drifts.reduce((sum, d) => sum + d * d, 0);
    };
    let best = old;
    let bestScore = score(old);
    const centerOut = [...group].sort((a, b) =>
      Math.abs(a.unwrapped - (group[0].unwrapped + group[group.length - 1].unwrapped) / 2)
      - Math.abs(b.unwrapped - (group[0].unwrapped + group[group.length - 1].unwrapped) / 2)
      || a.unwrapped - b.unwrapped);
    const orders = [group, [...group].reverse(), centerOut, [...centerOut].reverse()];
    for (const order of orders) {
      const chosen: Record<string, SymbolPosition> = {};
      let complete = true;
      for (const body of order) {
        let position: SymbolPosition | undefined;
        // A 0.5° search step is fine enough to avoid visual over-spreading,
        // yet bounded so a group never drifts arbitrarily around the circle.
        for (let deltaSteps = 0; deltaSteps <= 50 && !position; deltaSteps++) {
          for (const sign of deltaSteps ? [-1, 1] : [0]) {
            for (const radius of radiiToTry) {
              const candidate = { displayDegree: body.degree + sign * deltaSteps * 0.5, radius };
              if (fixed.some(other => collides(candidate, other)) ||
                  Object.values(chosen).some(other => collides(candidate, other))) continue;
              position = candidate;
              break;
            }
            if (position) break;
          }
        }
        if (!position) { complete = false; break; }
        chosen[body.key] = position;
      }
      if (!complete) continue;
      const placed = orderPositions(group.map(body => chosen[body.key]));
      const candidateScore = score(placed);
      if (candidateScore + 1e-9 < bestScore) {
        bestScore = candidateScore;
        best = placed;
      }
    }
    group.forEach((body, index) => { result[body.key] = best[index]; });
  }
  for (const key of keys) result[key].displayDegree = normalizeDegree(result[key].displayDegree);
  return result;
}
