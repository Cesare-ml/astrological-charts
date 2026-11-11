import * as THREE from 'three';
import { Colori } from './_colori.config';
import { chartAspectCirclePoint } from './planet-interaction.geometry';
import {
  ChartAspectRelation, ChartPlanetRef, ChartPlanetInteractionEvent,
  chartPlanetKey, isChartPlanetRef, relatedChartAspects, sameChartPlanet
} from './planet-interaction.types';

/** Interactive canvas only. Export canvases remain independent of pointer state. */
export class PlanetInteractionController {
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private scene: THREE.Scene | null = null;
  private sceneRevision = 0;
  private glyphs = new Map<string, THREE.Mesh[]>();
  private glyphTints = new Map<THREE.Material, THREE.Color>();
  private natalLineColors = new Map<any, number[]>();
  private natalAspectTags: { root: THREE.Object3D; from: string; to: string; type: string }[] = [];
  private natalAspectPresentation: 'all' | 'focused' | 'muted' = 'all';
  private lines: THREE.Line[] = [];
  private aspectRing: { root: THREE.Object3D; radius: number } | null = null;
  private relations: readonly ChartAspectRelation[] = [];
  private hovered: ChartPlanetRef | null = null;
  private pinned: ChartPlanetRef | null = null;
  private readonly cursor: string;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly camera: THREE.Camera,
    private readonly emit: (event: ChartPlanetInteractionEvent) => void,
    private readonly requestRender: () => void
  ) {
    this.cursor = canvas.style.cursor;
    canvas.addEventListener('pointermove', this.move);
    canvas.addEventListener('pointerleave', this.leave);
    canvas.addEventListener('pointerup', this.finishPointer);
    canvas.addEventListener('pointercancel', this.finishPointer);
    canvas.addEventListener('click', this.click);
  }

  setScene(scene: THREE.Scene | null): void {
    const revision = ++this.sceneRevision;
    this.clearVisuals();
    // Detach old scene and glyph references before notifying the host.
    // The synchronous leave callback may call highlight() / setRelations():
    // those must not re-create visuals on a scene that is being disposed.
    const leaving = this.hovered;
    this.hovered = null;
    this.canvas.style.cursor = this.cursor;
    this.scene = null;
    this.glyphs.clear();
    this.natalAspectTags = [];
    this.aspectRing = null;
    if (leaving) this.send('leave', leaving);
    // The synchronous callback may itself call setScene() or destroy().
    // Never overwrite a newer scene (or resurrect one after destruction).
    if (revision !== this.sceneRevision) return;
    this.scene = scene;
    if (!scene) return;
    scene.traverse(obj => {
      const natal: unknown = obj.userData['chartNatalAspect'];
      if (natal && typeof natal === 'object') {
        const tag = natal as { from?: unknown; to?: unknown; type?: unknown };
        if (typeof tag.from === 'string' && typeof tag.to === 'string' &&
            typeof tag.type === 'string') {
          this.natalAspectTags.push({ root: obj, from: tag.from, to: tag.to, type: tag.type });
        }
      }
      const radius: unknown = obj.userData['chartAspectRadius'];
      if (!this.aspectRing && typeof radius === 'number' && Number.isFinite(radius) && radius > 0) {
        this.aspectRing = { root: obj, radius };
      }
      const ref: unknown = obj.userData['chartPlanet'];
      if (!(obj instanceof THREE.Mesh) || !isChartPlanetRef(ref)) return;
      const key = chartPlanetKey(ref);
      const list = this.glyphs.get(key) ?? [];
      list.push(obj);
      this.glyphs.set(key, list);
    });
    this.updateVisuals();
  }

  setRelations(relations: readonly ChartAspectRelation[]): void {
    this.relations = relations.slice();
    this.updateVisuals();
    const activeScene = this.scene;
    const revision = this.sceneRevision;
    if (activeScene) {
      // A stationary hover receives new links without a second enter event.
      if (this.hovered) this.send('update', this.hovered);
      // The host may have destroyed/replaced the canvas during 'update'.
      if (this.scene === activeScene && this.sceneRevision === revision) this.requestRender();
    }
  }

  highlight(planet: ChartPlanetRef | null): void {
    this.pinned = planet && isChartPlanetRef(planet) ? { ...planet } : null;
    this.updateVisuals();
    if (this.scene) this.requestRender();
  }

  setNatalAspectPresentation(presentation: 'all' | 'focused' | 'muted'): void {
    this.natalAspectPresentation = presentation;
    this.updateVisuals();
    if (this.scene) this.requestRender();
  }

  destroy(): void {
    ++this.sceneRevision;
    this.canvas.removeEventListener('pointermove', this.move);
    this.canvas.removeEventListener('pointerleave', this.leave);
    this.canvas.removeEventListener('pointerup', this.finishPointer);
    this.canvas.removeEventListener('pointercancel', this.finishPointer);
    this.canvas.removeEventListener('click', this.click);
    this.clearVisuals();
    this.canvas.style.cursor = this.cursor;
    this.scene = null;
    this.hovered = null;
    this.glyphs.clear();
    this.natalAspectTags = [];
    this.aspectRing = null;
  }

  private send(type: ChartPlanetInteractionEvent['type'], planet: ChartPlanetRef): void {
    this.emit({ type, planet: { ...planet }, aspects: relatedChartAspects(planet, this.relations) });
  }

  private pick(event: MouseEvent): ChartPlanetRef | null {
    if (!this.scene) return null;
    const rect = this.canvas.getBoundingClientRect();
    if (!(rect.width > 0 && rect.height > 0)) return null;
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    // Pointer capture and synthetic clicks can deliver coordinates outside
    // the canvas. Do not select a partly off-screen planet in that case.
    if (!Number.isFinite(x) || !Number.isFinite(y) ||
        x < 0 || x > 1 || y < 0 || y > 1) return null;
    this.pointer.set(x * 2 - 1, 1 - y * 2);
    this.scene.updateMatrixWorld(true);
    this.camera.updateMatrixWorld(true);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    // Only tagged planet glyphs: decorative meshes never intercept a hit.
    const targets = [...this.glyphs.values()].flat();
    const hits = this.raycaster.intersectObjects(targets, false);
    if (!hits.length) return null;
    // When close glyph rectangles overlap at the same depth, Three.js picks
    // the earliest traversed mesh. Prefer the symbol whose projected CENTER
    // is nearest to the pointer, but never select a farther depth layer over
    // a frontmost one. This works after camera zoom and chart mirroring.
    const nearestDepth = hits[0].distance;
    const center = new THREE.Vector3();
    let best = hits[0];
    let bestDistanceSquared = Infinity;
    for (const hit of hits) {
      if (hit.distance - nearestDepth > 0.025) break;
      hit.object.getWorldPosition(center).project(this.camera);
      const dx = center.x - this.pointer.x;
      const dy = center.y - this.pointer.y;
      const distanceSquared = dx * dx + dy * dy;
      if (distanceSquared < bestDistanceSquared) {
        best = hit;
        bestDistanceSquared = distanceSquared;
      }
    }
    const ref: unknown = best.object.userData['chartPlanet'];
    return isChartPlanetRef(ref) ? ref : null;
  }

  private move = (event: PointerEvent): void => {
    // Pointer hits are computed against one particular scene. A synchronous
    // leave listener may redraw or destroy that scene before we emit enter.
    const hitScene = this.scene;
    const hitRevision = this.sceneRevision;
    const next = this.pick(event);
    if (sameChartPlanet(next, this.hovered)) return;
    const previous = this.hovered;
    this.hovered = null;
    if (previous) this.send('leave', previous);
    if (this.scene !== hitScene || this.sceneRevision !== hitRevision) return;
    this.hovered = next ? { ...next } : null;
    if (this.hovered) this.send('enter', this.hovered);
    // The enter callback may itself cause a chart replacement. setScene()
    // has already reset the cursor/hover and installed the new glyph index.
    if (this.scene !== hitScene || this.sceneRevision !== hitRevision) return;
    this.canvas.style.cursor = this.hovered ? 'pointer' : this.cursor;
    this.updateVisuals();
    this.requestRender();
  };
  private leave = (): void => {
    const leaving = this.hovered;
    if (!leaving) return;
    // Clear before the callback so synchronous setRelations() cannot emit
    // a stale hover-update after leave has already been delivered.
    this.hovered = null;
    this.canvas.style.cursor = this.cursor;
    const activeScene = this.scene;
    const revision = this.sceneRevision;
    this.send('leave', leaving);
    if (this.scene !== activeScene || this.sceneRevision !== revision) return;
    this.updateVisuals();
    if (this.scene) this.requestRender();
  };
  /** Touch has no persistent hover; a tap's synthetic click is handled separately. */
  private finishPointer = (event: PointerEvent): void => {
    if (event.pointerType === 'touch' || event.type === 'pointercancel') this.leave();
  };
  private click = (event: MouseEvent): void => {
    const planet = this.pick(event);
    if (planet) this.send('click', planet);
  };

  private clearVisuals(): void {
    for (const [material, previous] of this.glyphTints) {
      const paint = material as THREE.MeshBasicMaterial;
      paint.color?.copy(previous);
    }
    this.glyphTints.clear();
    for (const [attribute, values] of this.natalLineColors) {
      for (let i = 0; i < values.length; i += 3) {
        attribute.setXYZ(i / 3, values[i], values[i + 1], values[i + 2]);
      }
      if (attribute.data) attribute.data.needsUpdate = true;
      else attribute.needsUpdate = true;
    }
    this.natalLineColors.clear();
    for (const line of this.lines) {
      line.parent?.remove(line);
      line.geometry.dispose();
      (line.material as THREE.Material).dispose();
    }
    this.lines = [];
  }

  /** Recolor only the on-screen glyph material, keeping the texture and
   * baseline skin tint untouched for future redraws/PNG exports.
   */
  private tintGlyph(mesh: THREE.Mesh, color: string): void {
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of materials) {
      const paint = material as THREE.MeshBasicMaterial;
      if (!paint.color) continue;
      if (!this.glyphTints.has(material)) this.glyphTints.set(material, paint.color.clone());
      paint.color.set(color);
    }
  }

  /** The existing AspettiRender creates vertex-colored Line2 geometry.
   * Its aspect tags let us dim exactly the *already calculated* natal
   * connections without rerunning astrology or rebuilding the scene.
   */
  private tintNatalGeometry(root: THREE.Object3D, color: THREE.Color): void {
    root.traverse(object => {
      const geometry = (object as THREE.Mesh).geometry as THREE.BufferGeometry | undefined;
      if (!geometry) return;
      for (const name of ['instanceColorStart', 'instanceColorEnd']) {
        const attribute: any = geometry.getAttribute(name);
        if (!attribute || typeof attribute.setXYZ !== 'function') continue;
        if (!this.natalLineColors.has(attribute)) {
          const original: number[] = [];
          for (let index = 0; index < attribute.count; index++) {
            original.push(attribute.getX(index), attribute.getY(index), attribute.getZ(index));
          }
          this.natalLineColors.set(attribute, original);
        }
        for (let index = 0; index < attribute.count; index++) {
          attribute.setXYZ(index, color.r, color.g, color.b);
        }
        if (attribute.data) attribute.data.needsUpdate = true;
        else attribute.needsUpdate = true;
      }
    });
  }

  private paintNatalAspectPalette(focus: ChartPlanetRef | null): void {
    if (this.natalAspectPresentation === 'all') return;
    for (const aspect of this.natalAspectTags) {
      const connectsFocus = this.natalAspectPresentation === 'focused' &&
        focus?.layer === 'natal' && (aspect.from === focus.name || aspect.to === focus.name);
      const color = connectsFocus
        ? ((Colori.aspetti as Record<string, string>)[aspect.type] ?? '#888888')
        : '#898989';
      this.tintNatalGeometry(aspect.root, new THREE.Color(color));
    }
  }

  /** Dashed radius from the exact central-circle direction to the
   * original outer transit radius, not the collision-shifted glyph X/Y.
   */
  private addTransitConnector(transit: THREE.Mesh, color: string): void {
    if (!this.aspectRing) return;
    const angle: unknown = transit.userData['chartAspectAngle'];
    if (typeof angle !== 'number') return;
    const projected = chartAspectCirclePoint(angle, this.aspectRing.radius);
    if (!projected) return;
    const center = this.aspectRing.root.getWorldPosition(new THREE.Vector3());
    const inner = this.aspectRing.root.localToWorld(
      new THREE.Vector3(projected.x, projected.y, 0));
    const actual = transit.getWorldPosition(new THREE.Vector3());
    const radial = inner.clone().sub(center);
    const outerRadius = actual.distanceTo(center);
    if (!(outerRadius > radial.length() + 0.02)) return;
    const outer = center.clone().add(radial.normalize().multiplyScalar(outerRadius));
    const z = Math.max(inner.z, outer.z) + 0.075;
    inner.z = outer.z = z;
    const geometry = new THREE.BufferGeometry().setFromPoints([inner, outer]);
    const material = new THREE.LineDashedMaterial({
      color, dashSize: 0.035, gapSize: 0.022, transparent: true,
      opacity: 0.9, depthTest: false
    });
    const line = new THREE.Line(geometry, material);
    line.computeLineDistances();
    line.name = 'chart-interaction-transit-connector';
    line.renderOrder = 1001;
    this.scene?.add(line);
    this.lines.push(line);
  }

  /** Prefer unshifted longitude directions at the canonical aspect-circle radius.
   * The existing glyph renderer visually separates close planets; using glyph
   * centers would skew their true angular relationships. The chart group's
   * world matrix also preserves the southern-hemisphere mirroring.
   * Missing metadata (e.g. latitude charts) safely falls back to glyph links.
   */
  private aspectEndpoint(from: THREE.Mesh, to: THREE.Mesh, first: boolean): THREE.Vector3 {
    const selected = first ? from : to;
    const a: unknown = from.userData['chartAspectAngle'];
    const b: unknown = to.userData['chartAspectAngle'];
    if (this.aspectRing && typeof a === 'number' && typeof b === 'number') {
      const point = chartAspectCirclePoint(first ? a : b, this.aspectRing.radius);
      if (point) return this.aspectRing.root.localToWorld(new THREE.Vector3(point.x, point.y, 0));
    }
    return selected.getWorldPosition(new THREE.Vector3());
  }

  private updateVisuals(): void {
    this.clearVisuals();
    if (!this.scene) return;
    const focus = this.hovered ?? this.pinned;
    this.paintNatalAspectPalette(focus);
    if (!focus) return;
    const aspects = relatedChartAspects(focus, this.relations);
    const related = new Set([chartPlanetKey(focus)]);
    for (const link of aspects) {
      related.add(chartPlanetKey(link.from));
      related.add(chartPlanetKey(link.to));
    }
    // Natal-only aspect focus uses the already drawn native aspect tags:
    // partners do not require a duplicated upstream aspect calculation.
    if (this.natalAspectPresentation === 'focused' && focus.layer === 'natal') {
      for (const tag of this.natalAspectTags) {
        if (tag.from === focus.name) related.add(chartPlanetKey({layer:'natal',name:tag.to}));
        if (tag.to === focus.name) related.add(chartPlanetKey({layer:'natal',name:tag.from}));
      }
    }
    for (const key of related) for (const mesh of this.glyphs.get(key) ?? []) {
      // Focus is visual tint + aspect highlighting only. Never change the
      // glyph scale: hit targets and planet positions remain stable.
      const ref = mesh.userData['chartPlanet'] as ChartPlanetRef;
      const tint = (Colori.elementiCelesti as Record<string, string>)[ref.name];
      if (tint) this.tintGlyph(mesh, tint);
    }
    this.scene.updateMatrixWorld(true);
    const drawn = new Set<string>();
    const connectedTransits = new Set<string>();
    for (const link of aspects) {
      const id = [chartPlanetKey(link.from), chartPlanetKey(link.to), link.type].join('|');
      if (drawn.has(id)) continue;
      drawn.add(id);
      const from = this.glyphs.get(chartPlanetKey(link.from))?.[0];
      const to = this.glyphs.get(chartPlanetKey(link.to))?.[0];
      if (!from || !to) continue;
      const a = this.aspectEndpoint(from, to, true);
      const b = this.aspectEndpoint(from, to, false);
      // Lift both endpoints above the chart background for legibility.
      a.z = b.z = Math.max(a.z, b.z) + 0.06;
      const geometry = new THREE.BufferGeometry().setFromPoints([a, b]);
      const color = (Colori.aspetti as Record<string, string>)[link.type] ?? '#b08a35';
      const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.95, depthTest: false });
      const line = new THREE.Line(geometry, material);
      line.name = 'chart-interaction-aspect';
      line.renderOrder = 1000;
      this.scene.add(line);
      this.lines.push(line);
      // Link the central aspect to each involved outer transit body.
      // The original natal aspects remain gray below these overlays.
      for (const [ref, mesh] of [[link.from, from], [link.to, to]] as const) {
        if (ref.layer !== 'transit') continue;
        const key = chartPlanetKey(ref);
        if (connectedTransits.has(key)) continue;
        connectedTransits.add(key);
        // Exactly one spoke per involved outer transit planet; parallel
        // overlapping dashed lines of different aspect colors are confusing.
        this.addTransitConnector(mesh, color);
      }
    }
  }
}
