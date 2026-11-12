import * as THREE from 'three';
import { Colori } from './_colori.config';
import { chartAspectCirclePoint, chartTransitConnectorRadii } from './planet-interaction.geometry';
import {
  ChartAspectRelation, ChartPlanetRef, ChartPlanetInteractionEvent,
  chartPlanetKey, chartAspectRelationKey, isChartPlanetRef, relatedChartAspects, sameChartPlanet, snapshotChartAspects,
  sameChartAspects, sameChartAspectVisuals, sameChartAspectStructure,
  preferredTransitConnectorAspect
} from './planet-interaction.types';

/** Material clones retain their untinted origin across controllers.
 * Weak keys prevent retaining transient focus material copies after disposal;
 * material arrays and texture references are never deep-cloned.
 */
const focusMaterialOrigins = new WeakMap<THREE.Material, THREE.Material>();

/** Interactive canvas only. Export canvases remain independent of pointer state. */
export class PlanetInteractionController {
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly projectedGlyphCenter = new THREE.Vector3();
  // Rebuild hit-test targets only when setScene reindexes a chart, never on
  // every pointermove (which may arrive hundreds of times per second).
  private pickTargets: THREE.Mesh[] = [];
  private scene: THREE.Scene | null = null;
  private sceneRevision = 0;
  /** Prevent nested pointer callbacks from reviving a stale hit. */
  private pointerRevision = 0;
  /** A synchronous leave callback can receive another pointer event before
   * the first move has installed its next hover. Preserve the retired visual
   * focus until the winning event restores/paints it. */
  private pendingHoverExit: ChartPlanetRef | null = null;
  /** Teardown is terminal; no stale host call may resurrect this canvas. */
  private disposed = false;
  /** Tracks painting work performed by synchronous host callbacks. */
  private visualRevision = 0;
  private glyphs = new Map<string, THREE.Mesh[]>();
  /** Screen-only color copies. A mesh's original material may also be used
   * by another canvas; never recolor or dispose it.
   */
  private glyphMaterialOverrides = new Map<THREE.Mesh, {
    original: THREE.Material | THREE.Material[];
    focused: THREE.Material | THREE.Material[];
  }>();
  private natalLineColors = new Map<any, number[]>();
  /** Screen-only copies of the native focused natal strokes.
   * Every copy owns its own geometry/material; original natal lines
   * remain visible in gray underneath.
   */
  private natalFocusOverlays: THREE.Object3D[] = [];
  private natalAspectTags: { root: THREE.Object3D; from: string; to: string; type: string }[] = [];
  private natalAspectPresentation: 'all' | 'focused' | 'muted' = 'all';
  private lines: THREE.Line[] = [];
  /** Existing dashed guides by layer-qualified transit body. Cleared with
   * their scene so an orb-only update can recolor without reallocating GPU
   * geometry or touching native natal strokes.
   */
  private transitGuides = new Map<string,THREE.Line>();
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
    if (this.disposed) return;
    const revision = ++this.sceneRevision;
    this.clearVisuals();
    // Geometry/material 'dispose' listeners are synchronous. A host may
    // replace or destroy this controller before old visuals finish clearing.
    // Never detach or overwrite the scene installed by that nested call.
    if (this.disposed || revision !== this.sceneRevision) return;
    // Detach old scene and glyph references before notifying the host.
    // The synchronous leave callback may call highlight() / setRelations():
    // those must not re-create visuals on a scene that is being disposed.
    const leaving = this.hovered;
    this.hovered = null;
    this.pendingHoverExit = null;
    this.canvas.style.cursor = this.cursor;
    this.scene = null;
    this.glyphs.clear();
    this.pickTargets = [];
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
          // Some native dashed/punctuated strokes may tag both a parent
          // group and its renderable children. Only the outermost SAME
          // relation owns a foreground; cloning both would overdraw and
          // allocate duplicate WebGL geometry on every focused redraw.
          let duplicateInAncestor = false;
          for (let parent = obj.parent; parent && parent !== scene; parent = parent.parent) {
            const parentTag: unknown = parent.userData['chartNatalAspect'];
            if (!parentTag || typeof parentTag !== 'object') continue;
            const ancestor = parentTag as {from?:unknown;to?:unknown;type?:unknown};
            if (ancestor.from === tag.from && ancestor.to === tag.to &&
                ancestor.type === tag.type) {
              duplicateInAncestor = true;
              break;
            }
          }
          if (!duplicateInAncestor) {
            this.natalAspectTags.push({root:obj, from:tag.from,to:tag.to,type:tag.type});
          }
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
      this.pickTargets.push(obj);
    });
    this.updateVisuals();
  }

  setRelations(relations: readonly ChartAspectRelation[]): void {
    if (this.disposed) return;
    const next = snapshotChartAspects(relations);
    // Real-time hosts may resend identical precomputed links at high frequency.
    // Avoid tearing down/reallocating WebGL overlay geometry and rendering when
    // the semantic payload, including orb and optional fields, is unchanged.
    if (sameChartAspects(this.relations, next)) return;
    // Store every upstream change; repaint only if the active hover/pin
    // displays a changed relation. Other planets' new data remains available
    // when the frontend selects them later.
    const focus = this.hovered ?? this.pinned;
    const previousVisible = focus ? relatedChartAspects(focus, this.relations) : [];
    const nextVisible = focus ? relatedChartAspects(focus, next) : [];
    const visibleChanged = !sameChartAspects(previousVisible, nextVisible);
    // A changing orb updates the host's displayed details, but the actual
    // strokes change only if the tightest-orb transit guide color changes.
    const visualsChanged = !sameChartAspectVisuals(previousVisible, nextVisible);
    const activeScene = this.scene;
    const revision = this.sceneRevision;
    this.relations = next;
    if (!visibleChanged) return;
    if (visualsChanged) {
      // Geometry/endpoints are unchanged if only orb values moved. The
      // shared transit spoke may still change its winner *color*; update
      // its existing LineDashedMaterial in place when safe.
      const recolored = sameChartAspectStructure(previousVisible,nextVisible)
        && this.recolorTransitGuides(nextVisible);
      if (!recolored) this.updateVisuals();
    }
    // Disposing the former aspect strokes can synchronously call the host,
    // which may install newer relations, focus or a different chart. This
    // older update must not send stale focus details or render that scene.
    const isCurrent = () => !this.disposed &&
      this.relations === next && this.scene === activeScene &&
      this.sceneRevision === revision &&
      sameChartPlanet(focus,this.hovered ?? this.pinned);
    if (!isCurrent()) return;
    if (activeScene) {
      // Metadata-only changes still notify the host when the selection is
      // current; the callback itself can start another relation update.
      if (focus) this.send('update', focus);
      if (visualsChanged && isCurrent()) this.requestRender();
    }
  }

  highlight(planet: ChartPlanetRef | null): void {
    if (this.disposed) return;
    // Invalid untyped host references are not requests to clear focus.
    // A deliberate clear is expressed only by highlight(null).
    if (planet !== null && !isChartPlanetRef(planet)) return;
    const next = planet ? { ...planet } : null;
    // Repeated frontend focus values must preserve existing overlay geometry.
    // A new scene is always refreshed separately by setScene().
    if (sameChartPlanet(this.pinned, next)) return;
    this.pinned = next;
    // The hovered planet has visual priority. If the host pins a planet
    // while a pointer is active, the displayed focus has NOT changed.
    // Defer painting until the pointer moves/leaves: move() repaints
    // after its enter callback; leave() restores the newly pinned body.
    if (this.hovered) return;
    const activeScene = this.scene;
    const sceneRevision = this.sceneRevision;
    const previousVisualRevision = this.visualRevision;
    this.updateVisuals();
    // Releasing old focus lines may synchronously trigger a NEW pin,
    // scene or paint. Only the surviving update owns a render request.
    if (!this.disposed && this.scene && this.scene === activeScene &&
        this.sceneRevision === sceneRevision &&
        this.visualRevision === previousVisualRevision + 1 &&
        !this.hovered && sameChartPlanet(this.pinned, next))
      this.requestRender();
  }

  setNatalAspectPresentation(presentation: 'all' | 'focused' | 'muted'): void {
    if (this.disposed) return;
    // Runtime callers may bypass TypeScript. Never gray all natal aspects
    // because a JavaScript/JSON host passed an unrecognized mode.
    if (presentation !== 'all' && presentation !== 'focused' && presentation !== 'muted') return;
    // Focus-mode buttons may resend the same state during live correction.
    if (this.natalAspectPresentation === presentation) return;
    this.natalAspectPresentation = presentation;
    const activeScene = this.scene;
    const sceneRevision = this.sceneRevision;
    const previousVisualRevision = this.visualRevision;
    this.updateVisuals();
    // A disposal callback can replace the mode, chart or focus. An older
    // mode paint must never request a second frame for the newer state.
    if (!this.disposed && this.scene && this.scene === activeScene &&
        this.sceneRevision === sceneRevision &&
        this.visualRevision === previousVisualRevision + 1 &&
        this.natalAspectPresentation === presentation)
      this.requestRender();
  }

  destroy(): void {
    if (this.disposed) return;
    this.disposed = true;
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
    this.pendingHoverExit = null;
    // Destruction is terminal (unlike setScene(null) during a redraw).
    // Do not retain host-supplied aspect snapshots or a pinned selection
    // if a stale Angular closure still references the retired controller.
    this.pinned = null;
    this.relations = [];
    this.glyphs.clear();
    this.pickTargets = [];
    this.natalAspectTags = [];
    this.aspectRing = null;
  }

  private send(type: ChartPlanetInteractionEvent['type'], planet: ChartPlanetRef): void {
    // A mutable tooltip handler must not alter the controller's active links.
    this.emit({ type, planet: { ...planet }, aspects: snapshotChartAspects(relatedChartAspects(planet, this.relations)) });
  }

  /** Raycaster intersections include non-rendered meshes in some Three.js
   * paths. Respect current scene/group/mesh and material visibility without
   * rebuilding the cached pickTargets array whenever the host hides a layer.
   * A removed or reparented mesh can remain in that cache: it must never
   * receive clicks or steal hover after leaving this particular scene.
   */
  private visiblePlanetHit(hit: THREE.Intersection<THREE.Object3D>): boolean {
    let belongsToActiveScene = false;
    for (let node: THREE.Object3D | null = hit.object; node; node = node.parent) {
      if (!node.visible) return false;
      if (node === this.scene) belongsToActiveScene = true;
    }
    if (!belongsToActiveScene) return false;
    const material = (hit.object as THREE.Mesh).material;
    if (Array.isArray(material)) {
      // Multi-material meshes can hide individual triangle groups. A face
      // with an unknown/non-integer material index has no trustworthy
      // visibility: never fall back to an unrelated visible group.
      const index = hit.face?.materialIndex;
      return Number.isSafeInteger(index) && index >= 0 && index < material.length
        && material[index]?.visible === true;
    }
    return !!material && material.visible === true;
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
    // Three.js Raycaster defaults to layer 0 even when the camera renders
    // other layers. Keep picking on the camera's CURRENT mask; hosts can
    // toggle layer visibility without reindexing or rebuilding the scene.
    this.raycaster.layers.mask = this.camera.layers.mask;
    // Only tagged planet glyphs: decorative meshes never intercept a hit.
    const hits = this.raycaster.intersectObjects(this.pickTargets, false);
    if (!hits.length) return null;
    // Hidden foreground glyphs must not block an actually visible planet.
    // Find the first *visible* hit to establish the nearest depth, then
    // favor the projected glyph center inside the original 0.025 tolerance.
    const center = this.projectedGlyphCenter;
    let nearestDepth: number | null = null;
    let best: THREE.Intersection<THREE.Object3D> | null = null;
    let bestDistanceSquared = Infinity;
    for (const hit of hits) {
      if (nearestDepth !== null && hit.distance - nearestDepth > 0.025) break;
      if (!this.visiblePlanetHit(hit)) continue;
      if (nearestDepth === null) nearestDepth = hit.distance;
      hit.object.getWorldPosition(center).project(this.camera);
      const dx = center.x - this.pointer.x;
      const dy = center.y - this.pointer.y;
      const distanceSquared = dx * dx + dy * dy;
      if (distanceSquared < bestDistanceSquared) {
        best = hit;
        bestDistanceSquared = distanceSquared;
      }
    }
    if (!best) return null;
    const ref: unknown = best.object.userData['chartPlanet'];
    return isChartPlanetRef(ref) ? ref : null;
  }

  private move = (event: PointerEvent): void => {
    if (this.disposed) return;
    const pointerRevision = ++this.pointerRevision;
    // Pointer hits are computed against one particular scene. A synchronous
    // leave listener may redraw or destroy that scene before we emit enter.
    const hitScene = this.scene;
    const hitRevision = this.sceneRevision;
    const next = this.pick(event);
    // A nested pointermove can arrive while an older move has already
    // dispatched leave but not painted its replacement. Remember that
    // retired *visual* focus so it is not mistaken for an idle canvas.
    const interruptedExit = this.pendingHoverExit;
    this.pendingHoverExit = null;
    if (sameChartPlanet(next, this.hovered) && !interruptedExit) return;
    const previous = this.hovered;
    const visibleBeforeMove = previous ?? interruptedExit ?? this.pinned;
    this.hovered = null;
    this.pendingHoverExit = previous;
    if (previous) this.send('leave', previous);
    // A newer event from the host may have chosen another planet within
    // this same scene. A scene-only revision check is not sufficient.
    if (this.disposed || this.pointerRevision !== pointerRevision ||
        this.scene !== hitScene || this.sceneRevision !== hitRevision) return;
    this.pendingHoverExit = null;
    this.hovered = next ? { ...next } : null;
    const beforeEnterVisuals = this.visualRevision;
    if (this.hovered) this.send('enter', this.hovered);
    // A host may redraw in the enter callback (e.g. pin this planet).
    // Also ignore a nested pointermove or pointerleave during enter.
    if (this.disposed || this.pointerRevision !== pointerRevision ||
        this.scene !== hitScene || this.sceneRevision !== hitRevision) return;
    this.canvas.style.cursor = this.hovered ? 'pointer' : this.cursor;
    // Preserve the existing geometry whenever the *visible* focus is
    // unchanged. Covers entering an already-pinned body AND moving
    // from that body to empty canvas space (no pointerleave event).
    // The first enter, changed hover and different pinned focus still
    // repaint. Callback-triggered changes retain the revision guard.
    const visibleAfterMove = this.hovered ?? this.pinned;
    if (this.visualRevision === beforeEnterVisuals &&
        !sameChartPlanet(visibleBeforeMove, visibleAfterMove)) {
      this.updateVisuals();
      // Repainting may dispose a line and synchronously dispatch a newer
      // pointer event. Do not enqueue the older frame in that case.
      if (!this.disposed && this.pointerRevision === pointerRevision &&
          this.scene === hitScene && this.sceneRevision === hitRevision)
        this.requestRender();
    }
  };
  private leave = (): void => {
    if (this.disposed) return;
    // Even with hovered=null, an in-flight pointermove may be in its
    // synchronous 'leave' callback. Invalidate that older event before
    // it can resurrect a hit after the pointer has left the canvas.
    const pointerRevision = ++this.pointerRevision;
    const leaving = this.hovered;
    const interruptedExit = this.pendingHoverExit;
    this.pendingHoverExit = null;
    this.canvas.style.cursor = this.cursor;
    if (!leaving && !interruptedExit) return;
    const previousVisible = leaving ?? interruptedExit;
    this.hovered = null;
    const activeScene = this.scene;
    const revision = this.sceneRevision;
    const beforeLeaveVisuals = this.visualRevision;
    // The interrupted move has already emitted leave for its old glyph.
    // Never emit a duplicate when exiting during that callback.
    if (leaving) this.send('leave', leaving);
    if (this.disposed || this.pointerRevision !== pointerRevision ||
        this.scene !== activeScene || this.sceneRevision !== revision) return;
    // Leaving the same pinned planet restores the *identical* focused
    // scene, so there is no need to dispose and rebuild aspect lines.
    // Keep emitting leave to the host; a callback changing selection or
    // relationships has its own visualRevision and is handled above.
    if (this.visualRevision === beforeLeaveVisuals &&
        !sameChartPlanet(previousVisible, this.pinned)) {
      this.updateVisuals();
      if (!this.disposed && this.pointerRevision === pointerRevision &&
          this.scene === activeScene && this.sceneRevision === revision)
        this.requestRender();
    }
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
    // Detach ALL resources owned by this paint before emitting any
    // synchronous Three.js remove/dispose events. A disposal listener can
    // re-enter setScene(), highlight() or destroy(); that nested operation
    // must never dispose these objects a second time, and this older
    // cleanup must not delete resources created by the newer repaint.
    const materials = this.glyphMaterialOverrides;
    const natalColors = this.natalLineColors;
    const natalOverlays = this.natalFocusOverlays;
    const interactionLines = this.lines;
    this.glyphMaterialOverrides = new Map();
    this.natalLineColors = new Map();
    this.natalFocusOverlays = [];
    this.lines = [];
    this.transitGuides = new Map();
    // Restore the native natal colors before any synchronous Material.dispose
    // callback can repaint the same chart. Reapplying the former palette
    // afterward would overwrite the newer focus and corrupt its baseline.
    for (const [attribute, values] of natalColors) {
      for (let i = 0; i < values.length; i += 3) {
        attribute.setXYZ(i / 3, values[i], values[i + 1], values[i + 2]);
      }
      if (attribute.data) attribute.data.needsUpdate = true;
      else attribute.needsUpdate = true;
    }
    for (const [mesh, {original, focused}] of materials) {
      // A host or another controller may have replaced the material of a
      // transferred mesh since this controller assigned its focus clone.
      // Never overwrite another controller's currently active material.
      const copies = Array.isArray(focused) ? focused : [focused];
      const originals = Array.isArray(original) ? original : [original];
      // Match by owned clone identity, not by an old material-array index.
      // The host may collapse, expand or reorder the material layout while
      // focused; replacing only our clones preserves its other changes.
      const owned = new Map<THREE.Material, THREE.Material>();
      copies.forEach((copy, index) => {
        if (copy !== originals[index]) owned.set(copy, originals[index]);
      });
      const current = mesh.material;
      if (Array.isArray(current)) {
        const restored = current.map(material => owned.get(material) ?? material);
        if (restored.some((material, index) => material !== current[index])) {
          mesh.material = restored;
        }
      } else {
        const baseline = owned.get(current);
        if (baseline) mesh.material = baseline;
      }
      // The ownership maps were detached before disposal; reentrant host
      // callbacks cannot accidentally dispose these same clones twice.
      for (const copy of owned.keys()) copy.dispose();
    }
    // Cloned natal geometry and materials are never shared with the source.
    // Dispose the foreground on every focus change, redraw and destroy.
    for (const overlay of natalOverlays) {
      overlay.parent?.remove(overlay);
      overlay.traverse(object => {
        const mesh = object as THREE.Mesh;
        mesh.geometry?.dispose();
        const materials = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
        for (const material of materials) material.dispose();
      });
    }
    for (const line of interactionLines) {
      line.parent?.remove(line);
      line.geometry.dispose();
      (line.material as THREE.Material).dispose();
    }
  }

  /** Cached glyphs can be reparented after setScene(). Never recolor a
   * symbol now owned by another chart, nor create aspect geometry with it.
   * Traverse only the short parent chain, not the full scene on every hover.
   */
  private ownsGlyph(mesh: THREE.Mesh): boolean {
    for (let node: THREE.Object3D | null = mesh; node; node = node.parent) {
      if (node === this.scene) return true;
    }
    return false;
  }

  private activeGlyph(ref: ChartPlanetRef): THREE.Mesh | undefined {
    return this.glyphs.get(chartPlanetKey(ref))?.find(mesh => this.ownsGlyph(mesh));
  }

  /** A highlighted mesh owns its temporary material, not the underlying
   * base texture/material. Multiple scenes can share an immutable material
   * without inheriting another canvas's focus tint.
   */
  private tintGlyph(mesh: THREE.Mesh, color: string): void {
    if (this.glyphMaterialOverrides.has(mesh)) return;
    const originals = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const baselines = originals.map(material => focusMaterialOrigins.get(material) ?? material);
    let changed = false;
    const focused = baselines.map(material => {
      const paint = material as THREE.MeshBasicMaterial;
      if (!paint.color) return material;
      const copy = material.clone();
      focusMaterialOrigins.set(copy, material);
      (copy as THREE.MeshBasicMaterial).color.set(color);
      changed = true;
      return copy;
    });
    if (!changed) return;
    const original = Array.isArray(mesh.material) ? baselines : baselines[0];
    const replacement = Array.isArray(mesh.material) ? focused : focused[0];
    this.glyphMaterialOverrides.set(mesh, {original, focused: replacement});
    mesh.material = replacement;
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

  /** Duplicate the *existing* native stroke geometry before muting it.
   * A full Three.js deep clone initially shares BufferGeometry and materials:
   * clone each renderable's resources so a gray background cannot recolor
   * the highlighted line. The source's parent/transform retains exact
   * angular positions, original dash patterns and line widths.
   */
  private addNatalFocusOverlay(root: THREE.Object3D): void {
    if (!root.parent) return;
    const overlay = root.clone(true);
    const originals: THREE.Object3D[] = [];
    const copies: THREE.Object3D[] = [];
    root.traverse(obj => originals.push(obj));
    overlay.traverse(obj => copies.push(obj));
    for (let i = 0; i < originals.length; i++) {
      const original = originals[i] as THREE.Mesh;
      const copy = copies[i] as THREE.Mesh;
      if (original.geometry) copy.geometry = original.geometry.clone();
      if (original.material) {
        const sources = Array.isArray(original.material) ? original.material : [original.material];
        const materials = sources.map(material => {
          const foreground = material.clone();
          foreground.depthTest = false;
          foreground.depthWrite = false;
          foreground.transparent = true;
          foreground.opacity = 1;
          return foreground;
        });
        copy.material = Array.isArray(original.material) ? materials : materials[0];
      }
      // Overlay is a rendering-only copy, never an interactive planet
      // or a second natal aspect in the scene's metadata registry.
      copy.userData = {};
      copy.renderOrder = 999;
    }
    overlay.name = 'chart-interaction-natal-focus';
    // Object3D.add emits synchronous events. Publish ownership *before*
    // add(), so a reentrant setScene/destroy disposes this new clone.
    this.natalFocusOverlays.push(overlay);
    root.parent.add(overlay);
  }

  private paintNatalAspectPalette(
    focus: ChartPlanetRef | null, isCurrent: () => boolean
  ): void {
    if (this.natalAspectPresentation === 'all') return;
    const gray = new THREE.Color('#898989');
    for (const aspect of this.natalAspectTags) {
      if (!isCurrent()) return;
      const connectsFocus = this.natalAspectPresentation === 'focused' &&
        focus?.layer === 'natal' && (aspect.from === focus.name || aspect.to === focus.name);
      // Preserve the original colored pattern above the gray original.
      if (connectsFocus) this.addNatalFocusOverlay(aspect.root);
      // A native overlay's 'added' listener may replace the entire chart.
      // Never gray an obsolete chart after its overlay was disposed.
      if (!isCurrent()) return;
      this.tintNatalGeometry(aspect.root, gray);
    }
  }

  /** Dashed radius from the exact central-circle direction to the
   * original outer transit radius, not the collision-shifted glyph X/Y.
   */
  private addTransitConnector(transit: THREE.Mesh, color: string): THREE.Line | null {
    if (!this.aspectRing) return null;
    const angle: unknown = transit.userData['chartAspectAngle'];
    if (typeof angle !== 'number') return null;
    const projected = chartAspectCirclePoint(angle, this.aspectRing.radius);
    if (!projected) return null;
    const center = this.aspectRing.root.getWorldPosition(new THREE.Vector3());
    const inner = this.aspectRing.root.localToWorld(
      new THREE.Vector3(projected.x, projected.y, 0));
    const radial = inner.clone().sub(center);
    const innerRadius = radial.length();
    // Collision avoidance shifts the texture's CENTER. Prefer the
    // real ring radius stored on the transit glyph before that shift.
    // Both the ring and aspect-circle can be mirrored/rotated; measure
    // the original ring in world space, then project on the actual
    // longitude vector rather than toward the displaced texture.
    let outerRadius = transit.getWorldPosition(new THREE.Vector3()).distanceTo(center);
    const ringRadius: unknown = transit.userData['chartTransitRingRadius'];
    if (transit.parent && typeof ringRadius === 'number' &&
        Number.isFinite(ringRadius) && ringRadius > 0) {
      const origin = transit.parent.getWorldPosition(new THREE.Vector3());
      if (origin.distanceTo(center) < 0.02) {
        const ringPoint = transit.parent.localToWorld(
          new THREE.Vector3(0, ringRadius, 0)
        );
        outerRadius = ringPoint.distanceTo(origin);
      }
    }
    const span = chartTransitConnectorRadii(innerRadius, outerRadius);
    if (!span) return null;
    const outer = center.clone().add(radial.normalize().multiplyScalar(span.endRadius));
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
    // Track before add(): a callback may synchronously clear the scene.
    this.lines.push(line);
    this.scene?.add(line);
    return line;
  }

  /**
   * Update only the existing dashed spoke materials after an orb-only
   * winner change. Never touch line geometry, glyph transforms, original
   * natal aspect strokes or their foreground clones. Validate *all*
   * targets before painting anything; unknown/missing geometry falls back
   * to the ordinary full-overlay refresh.
   */
  private recolorTransitGuides(aspects: readonly ChartAspectRelation[]): boolean {
    if (!this.scene) return false;
    const winners = new Map<string,ChartAspectRelation>();
    const centralIds = new Set<string>();
    for (const link of aspects) {
      const id = chartAspectRelationKey(link);
      if (centralIds.has(id)) return false;
      centralIds.add(id);
      const from = this.activeGlyph(link.from);
      const to = this.activeGlyph(link.to);
      if (!from || !to) return false;
      for (const ref of [link.from,link.to]) {
        if (ref.layer !== 'transit') continue;
        const key = chartPlanetKey(ref);
        const previous = winners.get(key);
        winners.set(key, previous ? preferredTransitConnectorAspect(previous,link) : link);
      }
    }
    if (!winners.size || winners.size !== this.transitGuides.size) return false;
    const changes: Array<{material:THREE.LineDashedMaterial;color:string}> = [];
    for (const [key,relation] of winners) {
      const line = this.transitGuides.get(key);
      if (!line || line.parent !== this.scene ||
          !(line.material instanceof THREE.LineDashedMaterial)) return false;
      changes.push({
        material: line.material,
        color: (Colori.aspetti as Record<string,string>)[relation.type] ?? '#b08a35'
      });
    }
    for (const {material,color} of changes) material.color.set(color);
    return true;
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
    const paintRevision = ++this.visualRevision;
    const currentScene = this.scene;
    const currentSceneRevision = this.sceneRevision;
    const isCurrent = () => !this.disposed && !!currentScene &&
      this.scene === currentScene &&
      this.sceneRevision === currentSceneRevision &&
      this.visualRevision === paintRevision;
    this.clearVisuals();
    // A disposal callback may trigger a newer paint or scene replacement.
    // The older paint must not recreate overlays over that newer state.
    if (!isCurrent()) return;
    const focus = this.hovered ?? this.pinned;
    this.paintNatalAspectPalette(focus,isCurrent);
    if (!isCurrent() || !focus) return;
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
      if (!isCurrent()) return;
      if (!this.ownsGlyph(mesh)) continue;
      // Focus is visual tint + aspect highlighting only. Never change the
      // glyph scale: hit targets and planet positions remain stable.
      const ref = mesh.userData['chartPlanet'] as ChartPlanetRef;
      const tint = (Colori.elementiCelesti as Record<string, string>)[ref.name];
      if (tint) this.tintGlyph(mesh, tint);
    }
    if (!isCurrent()) return;
    currentScene!.updateMatrixWorld(true);
    const drawn = new Set<string>();
    const connectedTransits = new Map<string, {
      mesh: THREE.Mesh; relation: ChartAspectRelation;
    }>();
    for (const link of aspects) {
      if (!isCurrent()) return;
      const id = chartAspectRelationKey(link);
      if (drawn.has(id)) continue;
      drawn.add(id);
      const from = this.activeGlyph(link.from);
      const to = this.activeGlyph(link.to);
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
      // Track new resources before Three.js dispatches the 'added' event.
      this.lines.push(line);
      currentScene!.add(line);
      if (!isCurrent()) return;
      // Retain all colored central aspect lines, but only ONE dashed
      // spoke per transit planet. When a transit has several aspects,
      // its spoke color must not depend on upstream relation order.
      for (const [ref, mesh] of [[link.from, from], [link.to, to]] as const) {
        if (ref.layer !== 'transit') continue;
        const key = chartPlanetKey(ref);
        const previous = connectedTransits.get(key);
        connectedTransits.set(key, {
          mesh,
          relation: previous
            ? preferredTransitConnectorAspect(previous.relation, link) : link
        });
      }
    }
    // Draw only after every visible link has been considered: a more
    // exact aspect wins the guide color; ties use a stable type/key rule.
    for (const [key,{mesh, relation}] of connectedTransits) {
      if (!isCurrent()) return;
      const color = (Colori.aspetti as Record<string, string>)[relation.type] ?? '#b08a35';
      const guide = this.addTransitConnector(mesh, color);
      // An 'added' callback can replace the chart during guide creation.
      // Never reattach a disposed guide to the newly mounted scene's map.
      if (!isCurrent()) return;
      if (guide) this.transitGuides.set(key,guide);
    }
  }
}
