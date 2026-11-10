import * as THREE from 'three';
import { Colori } from './_colori.config';
import {
  ChartAspectRelation, ChartPlanetRef, ChartPlanetInteractionEvent,
  chartPlanetKey, isChartPlanetRef, relatedChartAspects, sameChartPlanet
} from './planet-interaction.types';

/** Interactive canvas only. Export canvases remain independent of pointer state. */
export class PlanetInteractionController {
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private scene: THREE.Scene | null = null;
  private glyphs = new Map<string, THREE.Mesh[]>();
  private scales = new Map<THREE.Mesh, THREE.Vector3>();
  private lines: THREE.Line[] = [];
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
    canvas.addEventListener('click', this.click);
  }

  setScene(scene: THREE.Scene | null): void {
    this.clearVisuals();
    if (this.hovered) this.send('leave', this.hovered);
    this.hovered = null;
    this.canvas.style.cursor = this.cursor;
    this.scene = scene;
    this.glyphs.clear();
    if (!scene) return;
    scene.traverse(obj => {
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
    if (this.scene) this.requestRender();
  }

  highlight(planet: ChartPlanetRef | null): void {
    this.pinned = planet && isChartPlanetRef(planet) ? { ...planet } : null;
    this.updateVisuals();
    if (this.scene) this.requestRender();
  }

  destroy(): void {
    this.canvas.removeEventListener('pointermove', this.move);
    this.canvas.removeEventListener('pointerleave', this.leave);
    this.canvas.removeEventListener('click', this.click);
    this.clearVisuals();
    this.canvas.style.cursor = this.cursor;
    this.scene = null;
    this.hovered = null;
    this.glyphs.clear();
  }

  private send(type: ChartPlanetInteractionEvent['type'], planet: ChartPlanetRef): void {
    this.emit({ type, planet: { ...planet }, aspects: relatedChartAspects(planet, this.relations) });
  }

  private pick(event: MouseEvent): ChartPlanetRef | null {
    if (!this.scene) return null;
    const rect = this.canvas.getBoundingClientRect();
    if (!(rect.width > 0 && rect.height > 0)) return null;
    this.pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );
    this.raycaster.setFromCamera(this.pointer, this.camera);
    // Only tagged planet glyphs: decorative meshes never intercept a hit.
    const targets = [...this.glyphs.values()].flat();
    const hit = this.raycaster.intersectObjects(targets, false)[0];
    const ref: unknown = hit?.object.userData['chartPlanet'];
    return isChartPlanetRef(ref) ? ref : null;
  }

  private move = (event: PointerEvent): void => {
    const next = this.pick(event);
    if (sameChartPlanet(next, this.hovered)) return;
    if (this.hovered) this.send('leave', this.hovered);
    this.hovered = next ? { ...next } : null;
    if (this.hovered) this.send('enter', this.hovered);
    this.canvas.style.cursor = this.hovered ? 'pointer' : this.cursor;
    this.updateVisuals();
    this.requestRender();
  };
  private leave = (): void => {
    if (!this.hovered) return;
    this.send('leave', this.hovered);
    this.hovered = null;
    this.canvas.style.cursor = this.cursor;
    this.updateVisuals();
    this.requestRender();
  };
  private click = (event: MouseEvent): void => {
    const planet = this.pick(event);
    if (planet) this.send('click', planet);
  };

  private clearVisuals(): void {
    for (const [mesh, scale] of this.scales) mesh.scale.copy(scale);
    this.scales.clear();
    for (const line of this.lines) {
      line.parent?.remove(line);
      line.geometry.dispose();
      (line.material as THREE.Material).dispose();
    }
    this.lines = [];
  }

  private updateVisuals(): void {
    this.clearVisuals();
    if (!this.scene) return;
    const focus = this.hovered ?? this.pinned;
    if (!focus || !this.glyphs.has(chartPlanetKey(focus))) return;
    const aspects = relatedChartAspects(focus, this.relations);
    const related = new Set([chartPlanetKey(focus)]);
    for (const link of aspects) {
      related.add(chartPlanetKey(link.from));
      related.add(chartPlanetKey(link.to));
    }
    for (const key of related) for (const mesh of this.glyphs.get(key) ?? []) {
      this.scales.set(mesh, mesh.scale.clone());
      mesh.scale.multiplyScalar(key === chartPlanetKey(focus) ? 1.35 : 1.18);
    }
    this.scene.updateMatrixWorld(true);
    const drawn = new Set<string>();
    for (const link of aspects) {
      const id = [chartPlanetKey(link.from), chartPlanetKey(link.to), link.type].join('|');
      if (drawn.has(id)) continue;
      drawn.add(id);
      const from = this.glyphs.get(chartPlanetKey(link.from))?.[0];
      const to = this.glyphs.get(chartPlanetKey(link.to))?.[0];
      if (!from || !to) continue;
      const a = from.getWorldPosition(new THREE.Vector3());
      const b = to.getWorldPosition(new THREE.Vector3());
      a.z = b.z = 0.06;
      const geometry = new THREE.BufferGeometry().setFromPoints([a, b]);
      const color = (Colori.aspetti as Record<string, string>)[link.type] ?? '#b08a35';
      const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.95, depthTest: false });
      const line = new THREE.Line(geometry, material);
      line.name = 'chart-interaction-aspect';
      line.renderOrder = 1000;
      this.scene.add(line);
      this.lines.push(line);
    }
  }
}
