import * as THREE from 'three';
import { inspectChartBodyOwners } from './chart-body-ownership';
import { planChartCoordinateEffects } from './chart-coordinate-plan';
import type { ChartCoordinateTarget } from './chart-coordinate-plan';
import { chartPlanetKey } from './planet-interaction.types';

/**
 * EXPERIMENTAL: isolated synthetic wheels only. The real renderer has
 * houses, aspect lines, decorations and host state outside body owners.
 * This function cannot be called from the public Angular render service.
 */
export interface IsolatedCoordinatePreviewResult {
  readonly status: 'applied' | 'unchanged' | 'rejected';
  readonly updated: number;
  readonly issues: readonly string[];
}

const result = (
  status: IsolatedCoordinatePreviewResult['status'],
  updated: number,
  issues: string[] = []
): IsolatedCoordinatePreviewResult =>
  Object.freeze({status,updated,issues:Object.freeze([...issues])});

const nearAngle = (a: number,b: number): boolean =>
  Math.abs(Math.atan2(Math.sin(a-b),Math.cos(a-b))) < 1e-6;

/**
 * Exact synthetic copy of the legacy shortened leader endpoint: the
 * anchor stays at x=0, y=anchorY while the other endpoint follows the
 * collision-displaced glyph at radius r. Only for opt-in test geometry.
 */
export function isolatedSyntheticLeaderEndpoint(
  radius: number, shiftDegrees: number, anchorY: number, trim: number
): THREE.Vector3 | null {
  if (![radius,shiftDegrees,anchorY,trim].every(Number.isFinite) ||
      radius <= 0 || trim < 0) return null;
  const radians = THREE.MathUtils.degToRad(shiftDegrees);
  const glyphX = -radius * Math.sin(radians);
  const glyphY = radius * Math.cos(radians);
  const length = Math.hypot(glyphX,glyphY-anchorY);
  if (!Number.isFinite(length) || length <= 0) return null;
  const factor = (length - Math.min(trim,length)) / length;
  return new THREE.Vector3(glyphX*factor,anchorY+(glyphY-anchorY)*factor,0);
}

interface StagedLeader {
  line: THREE.Line;
  position: THREE.BufferAttribute;
  oldEnd: THREE.Vector3;
  nextEnd: THREE.Vector3;
  oldBounds: THREE.Sphere | null;
}

interface StagedBody {
  group: THREE.Group;
  glyph: THREE.Mesh;
  lines: THREE.Object3D[];
  oldPosition: THREE.Vector3;
  nextPosition: THREE.Vector3;
  oldAngles: number[];
  leaderGeometry: StagedLeader[];
  newTickAngle: number;
  oldAspectAngle: unknown;
  oldLayout: unknown;
  newLayout: Record<string,unknown>;
}

/**
 * First atomic geometry experiment: for explicit SYNTHETIC fixtures
 * containing only normal planet glyphs and inner/outer leader lines,
 * rotate all supported visuals together with zero new GPU allocations.
 *
 * Strictly refuses collision-displacement changes, lunar/dodecatemore
 * decorations, native aspect strokes, any untracked scene objects,
 * malformed owners, unsupported wheel dependencies, or a missing opt-in
 * fixture marker. Re-checks the full input before each attempt.
 *
 * This is NOT a safe updater for real astrological chart scenes.
 * There is intentionally no production call site or public API export.
 */
export function applyIsolatedCoordinatePreview(
  root: THREE.Object3D,
  targets: readonly ChartCoordinateTarget[]
): IsolatedCoordinatePreviewResult {
  if (root.userData['chartSyntheticIsolatedWheel'] !== true)
    return result('rejected',0,['synthetic-fixture-required']);

  const plan = planChartCoordinateEffects(root,targets);
  if (plan.decision === 'unsupported')
    return result('rejected',0,[...plan.issues]);

  const inspection = inspectChartBodyOwners(root);
  if (!inspection.complete) return result('rejected',0,[...inspection.issues]);

  // No native aspect line, house, decoration, background or stray object may
  // exist. The isolation marker alone is NOT an authorization to edit a chart.
  const allowed = new Set<THREE.Object3D>([root]);
  for (const owner of inspection.owners.values()) {
    if (owner.extras.size) return result('rejected',0,['unsupported-decorations']);
    const nodes = [owner.group,owner.glyph,owner.innerLeader,owner.outerLeader]
      .filter((node): node is THREE.Object3D => !!node);
    for (const node of nodes) allowed.add(node);
    let parent = owner.group.parent;
    while (parent) {
      allowed.add(parent);
      if (parent === root) break;
      parent = parent.parent;
    }
  }
  let unknown = false;
  root.traverse(node => {
    if (!allowed.has(node) ||
        node.userData['chartNatalAspect'] !== undefined ||
        node.userData['chartAspectRadius'] !== undefined) unknown = true;
  });
  if (unknown) return result('rejected',0,['untracked-scene-visuals']);

  // Even a zero-impact coordinate plan is not evidence of sound glyph or
  // leader transforms: a host can move a mesh without updating its layout.
  // Always validate the wheel before reporting an unchanged scene.
  // Capture real geometry ownership first. A shared BufferGeometry could
  // mutate a *different* line when one body's collision offset changes.
  const geometryRefs = new Map<THREE.BufferGeometry,number>();
  const attributeRefs = new Map<THREE.BufferAttribute,number>();
  root.traverse(node => {
    if (!(node instanceof THREE.Mesh || node instanceof THREE.Line)) return;
    const geometry = node.geometry;
    if (!(geometry instanceof THREE.BufferGeometry)) return;
    geometryRefs.set(geometry,(geometryRefs.get(geometry) ?? 0)+1);
    // Different THREE.BufferGeometry objects can reference the SAME
    // position attribute. Writing one endpoint would also modify another
    // line (or glyph) even though geometry object identities differ.
    const position = geometry.getAttribute('position');
    if (position instanceof THREE.BufferAttribute)
      attributeRefs.set(position,(attributeRefs.get(position) ?? 0)+1);
  });

  // Validate EVERY body in this isolated wheel before touching the scene,
  // not just the planets included in the impact plan. A stationary Moon can
  // already have a stale glyph/leader transform while the Sun is moving.
  // Applying the Sun update in that state would compound a corrupt chart.
  const stages: StagedBody[] = [];
  const changed = new Map(plan.impacts.map(impact => [chartPlanetKey(impact.ref),impact]));
  for (const [key,owner] of inspection.owners) {
    const impact = changed.get(key);
    const oldShift = impact
      ? impact.previousAdjusted - impact.previousLongitude
      : owner.layout.glyphDisplacementDegrees;
    const newShift = impact
      ? impact.nextAdjusted - impact.nextLongitude
      : oldShift;
    const shiftChanged = Math.abs(newShift-oldShift) > 1e-9;
    const glyph = owner.glyph;
    const oldGlyphDegrees = impact
      ? impact.previousGlyphDegrees
      : owner.layout.tickDegrees + owner.layout.glyphDisplacementDegrees;
    const oldGlyphAngle = THREE.MathUtils.degToRad(oldGlyphDegrees);
    const nextGlyphAngle = THREE.MathUtils.degToRad(
      impact ? impact.nextGlyphDegrees : oldGlyphDegrees);
    const radius = Math.hypot(glyph.position.x,glyph.position.y);
    if (!Number.isFinite(radius) || radius <= 0 ||
        Math.abs(glyph.position.x + radius*Math.sin(oldGlyphAngle)) > 1e-6 ||
        Math.abs(glyph.position.y - radius*Math.cos(oldGlyphAngle)) > 1e-6 ||
        glyph.rotation.x !== 0 || glyph.rotation.y !== 0 ||
        glyph.rotation.z !== 0)
      return result('rejected',0,['stale-glyph-geometry:'+key]);

    const oldTick = THREE.MathUtils.degToRad(
      impact ? impact.previousTickDegrees : owner.layout.tickDegrees);
    const tick = THREE.MathUtils.degToRad(
      impact ? impact.nextTickDegrees : owner.layout.tickDegrees);
    const lines = [owner.innerLeader,owner.outerLeader]
      .filter((line): line is THREE.Object3D => !!line);
    for (const line of lines) {
      // A role tag alone does not guarantee a drawable radial line.
      // Never rotate arbitrary host Object3Ds as if they were leaders.
      if (!(line instanceof THREE.Line) ||
          !(line.geometry instanceof THREE.BufferGeometry) ||
          !(line.geometry.getAttribute('position') instanceof THREE.BufferAttribute) ||
          line.geometry.getAttribute('position').count < 2 ||
          !nearAngle(line.rotation.z,oldTick) ||
          line.rotation.x !== 0 || line.rotation.y !== 0 ||
          line.position.lengthSq() !== 0 ||
          line.scale.x !== 1 || line.scale.y !== 1 || line.scale.z !== 1)
        return result('rejected',0,['stale-leader-geometry:'+key]);
    }
    const leaderGeometry: StagedLeader[] = [];
    for (const candidate of lines) {
        const line = candidate as THREE.Line;
        const spec: unknown = line.userData['chartIsolatedLeaderSpec'];
        // A profiled leader must match its saved endpoint even if no
        // coordinates or collision offsets changed. Non-profiled legacy
        // fixtures are only supported when their displacement is stable.
        if (spec === undefined) {
          if (shiftChanged)
            return result('rejected',0,['collision-geometry-changed:'+key]);
          continue;
        }
        const data = spec as {anchorY?:unknown;trim?:unknown} | null;
        const anchorY = data?.anchorY;
        const trim = data?.trim;
        const geometry = line.geometry;
        const attr = geometry.getAttribute('position');
        if (typeof anchorY !== 'number' || typeof trim !== 'number' ||
            !Number.isFinite(anchorY) || !Number.isFinite(trim) ||
            trim < 0 || !(attr instanceof THREE.BufferAttribute) ||
            attr.itemSize !== 3 || attr.count !== 2 || geometry.index !== null ||
            Object.keys(geometry.attributes).some(k=>k !== 'position')) {
          return result('rejected',0,['collision-geometry-changed:'+key]);
        }
        if (shiftChanged && geometryRefs.get(geometry) !== 1)
          return result('rejected',0,['shared-leader-geometry:'+key]);
        if (shiftChanged && attributeRefs.get(attr) !== 1)
          return result('rejected',0,['shared-leader-attribute:'+key]);
        const oldEnd = isolatedSyntheticLeaderEndpoint(radius,oldShift,anchorY,trim);
        const nextEnd = shiftChanged
          ? isolatedSyntheticLeaderEndpoint(radius,newShift,anchorY,trim)
          : oldEnd;
        const vertices = [
          attr.getX(0),attr.getY(0),attr.getZ(0),
          attr.getX(1),attr.getY(1),attr.getZ(1)
        ];
        if (!oldEnd || !nextEnd || !vertices.every(Number.isFinite) ||
            Math.abs(attr.getX(0)-oldEnd.x) > 2e-6 ||
            Math.abs(attr.getY(0)-oldEnd.y) > 2e-6 ||
            Math.abs(attr.getZ(0)) > 2e-6 ||
            Math.abs(attr.getX(1)) > 2e-6 ||
            Math.abs(attr.getY(1)-anchorY) > 2e-6 ||
            Math.abs(attr.getZ(1)) > 2e-6)
          return result('rejected',0,['stale-leader-endpoints:'+key]);
        if (shiftChanged) {
          leaderGeometry.push({
            line,position:attr,
            oldEnd:new THREE.Vector3(attr.getX(0),attr.getY(0),attr.getZ(0)),
            nextEnd,oldBounds:geometry.boundingSphere?.clone() ?? null
          });
        }
    }
    // Unchanged symbols are verified but never moved or reallocated.
    if (!impact) continue;
    stages.push({
      group:owner.group,glyph,lines,
      oldPosition:glyph.position.clone(),
      nextPosition:new THREE.Vector3(
        -radius*Math.sin(nextGlyphAngle),
        radius*Math.cos(nextGlyphAngle),
        glyph.position.z
      ),
      oldAngles:lines.map(line=>line.rotation.z),
      leaderGeometry,
      newTickAngle:tick,
      oldAspectAngle:glyph.userData['chartAspectAngle'],
      oldLayout:owner.group.userData['chartBodyLayout'],
      newLayout:{
        ...owner.group.userData['chartBodyLayout'],
        original:impact.nextLongitude,
        adjusted:impact.nextAdjusted,
        tickDegrees:impact.nextTickDegrees,
        glyphDisplacementDegrees:newShift
      }
    });
  }

  // A no-op is only safe AFTER every glyph/leader has passed preflight.
  // Do not allocate, reposition or replace any object for this outcome.
  if (plan.decision === 'unchanged') return result('unchanged',0);

  // A failed application restores every staged transform, including
  // metadata, so the next owner redraw can start from its original scene.
  try {
    for (const stage of stages) {
      stage.glyph.position.copy(stage.nextPosition);
      for (const change of stage.leaderGeometry) {
        change.position.setXYZ(0,change.nextEnd.x,change.nextEnd.y,0);
        change.position.needsUpdate = true;
        change.line.geometry.computeBoundingSphere();
      }
      for (const line of stage.lines) line.rotation.z = stage.newTickAngle;
      stage.glyph.userData['chartAspectAngle'] = stage.newTickAngle;
      stage.group.userData['chartBodyLayout'] = stage.newLayout;
    }
  } catch {
    for (const stage of stages) {
      stage.glyph.position.copy(stage.oldPosition);
      for (const change of stage.leaderGeometry) {
        change.position.setXYZ(0,change.oldEnd.x,change.oldEnd.y,change.oldEnd.z);
        change.position.needsUpdate = true;
        change.line.geometry.boundingSphere = change.oldBounds?.clone() ?? null;
      }
      stage.lines.forEach((line,index)=>{line.rotation.z=stage.oldAngles[index];});
      stage.glyph.userData['chartAspectAngle']=stage.oldAspectAngle;
      stage.group.userData['chartBodyLayout']=stage.oldLayout;
    }
    return result('rejected',0,['transaction-rolled-back']);
  }
  return result('applied',stages.length);
}
