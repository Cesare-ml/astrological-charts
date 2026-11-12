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

interface StagedBody {
  group: THREE.Group;
  glyph: THREE.Mesh;
  lines: THREE.Object3D[];
  oldPosition: THREE.Vector3;
  nextPosition: THREE.Vector3;
  oldAngles: number[];
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
  if (plan.decision === 'unchanged') return result('unchanged',0);

  // Stage and validate EVERY body before touching any Three.js transform.
  // Existing leader geometry depends on glyph displacement, so only a
  // constant collision offset permits a rotation-only transform.
  const stages: StagedBody[] = [];
  for (const impact of plan.impacts) {
    const key = chartPlanetKey(impact.ref);
    const owner = inspection.owners.get(key);
    if (!owner) return result('rejected',0,['missing-owner:'+key]);
    const oldShift = impact.previousAdjusted - impact.previousLongitude;
    const newShift = impact.nextAdjusted - impact.nextLongitude;
    if (Math.abs(newShift-oldShift) > 1e-9)
      return result('rejected',0,['collision-geometry-changed:'+key]);
    const glyph = owner.glyph;
    const oldGlyphAngle = THREE.MathUtils.degToRad(impact.previousGlyphDegrees);
    const nextGlyphAngle = THREE.MathUtils.degToRad(impact.nextGlyphDegrees);
    const radius = Math.hypot(glyph.position.x,glyph.position.y);
    if (!Number.isFinite(radius) || radius <= 0 ||
        Math.abs(glyph.position.x + radius*Math.sin(oldGlyphAngle)) > 1e-6 ||
        Math.abs(glyph.position.y - radius*Math.cos(oldGlyphAngle)) > 1e-6 ||
        glyph.rotation.x !== 0 || glyph.rotation.y !== 0 ||
        glyph.rotation.z !== 0)
      return result('rejected',0,['stale-glyph-geometry:'+key]);

    const oldTick = THREE.MathUtils.degToRad(impact.previousTickDegrees);
    const tick = THREE.MathUtils.degToRad(impact.nextTickDegrees);
    const lines = [owner.innerLeader,owner.outerLeader]
      .filter((line): line is THREE.Object3D => !!line);
    for (const line of lines) {
      if (!nearAngle(line.rotation.z,oldTick) ||
          line.rotation.x !== 0 || line.rotation.y !== 0 ||
          line.position.lengthSq() !== 0)
        return result('rejected',0,['stale-leader-geometry:'+key]);
    }
    stages.push({
      group:owner.group,glyph,lines,
      oldPosition:glyph.position.clone(),
      nextPosition:new THREE.Vector3(
        -radius*Math.sin(nextGlyphAngle),
        radius*Math.cos(nextGlyphAngle),
        glyph.position.z
      ),
      oldAngles:lines.map(line=>line.rotation.z),
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

  // A failed application restores every staged transform, including
  // metadata, so the next owner redraw can start from its original scene.
  try {
    for (const stage of stages) {
      stage.glyph.position.copy(stage.nextPosition);
      for (const line of stage.lines) line.rotation.z = stage.newTickAngle;
      stage.glyph.userData['chartAspectAngle'] = stage.newTickAngle;
      stage.group.userData['chartBodyLayout'] = stage.newLayout;
    }
  } catch {
    for (const stage of stages) {
      stage.glyph.position.copy(stage.oldPosition);
      stage.lines.forEach((line,index)=>{line.rotation.z=stage.oldAngles[index];});
      stage.glyph.userData['chartAspectAngle']=stage.oldAspectAngle;
      stage.group.userData['chartBodyLayout']=stage.oldLayout;
    }
    return result('rejected',0,['transaction-rolled-back']);
  }
  return result('applied',stages.length);
}
