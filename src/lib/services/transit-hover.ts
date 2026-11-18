import * as THREE from 'three';
import {mousePositionToNdc} from '../renderers/@gestore-eventi-mouse';

export interface TransitPointHover { ring: 'natal' | 'transit'; name: string; longitude: number; }

/** Opt-in picking for the two chart rings. The role distinguishes equal body names. */
export class TransitHoverController {
  private readonly raycaster = new THREE.Raycaster();
  private readonly point = new THREE.Vector2();
  private last: {x: number; y: number} | null = null;
  private current: TransitPointHover | null = null;

  constructor(private readonly canvas: HTMLCanvasElement,
    private readonly getScene: () => THREE.Scene | null,
    private readonly getCamera: () => THREE.Camera | null,
    private readonly notify: (value: TransitPointHover | null) => void) {
    this.raycaster.params.Line.threshold = 0.035;
    canvas.addEventListener('mousemove', this.move);
    canvas.addEventListener('mouseleave', this.leave);
    window.addEventListener('resize', this.refresh);
  }
  private move = (event: MouseEvent): void => { this.last = {x:event.clientX, y:event.clientY}; this.refresh(); };
  private leave = (): void => { this.last = null; this.set(null); };
  private set(value: TransitPointHover | null): void {
    if (this.current?.ring === value?.ring && this.current?.name === value?.name && this.current?.longitude === value?.longitude) return;
    this.current = value;
    this.notify(value);
  }
  public refresh = (): void => {
    const scene = this.getScene(), camera = this.getCamera();
    const ndc = this.last && mousePositionToNdc(this.last.x, this.last.y, this.canvas.getBoundingClientRect());
    const groups: THREE.Object3D[] = [];
    scene?.traverse(object => {
      if (['natal-planets','natal-axes','transit-planets'].includes(object.userData.chartInteractionRole)) groups.push(object);
    });
    if (!ndc || !camera || !groups.length) { this.set(null); return; }
    scene!.updateMatrixWorld(true);
    camera.updateMatrixWorld(true);
    this.point.set(ndc.x, ndc.y);
    this.raycaster.setFromCamera(this.point, camera);
    const hit = this.raycaster.intersectObjects(groups, true).find(item =>
      typeof item.object.userData.planet === 'string' && Number.isFinite(item.object.userData.trueLongitude));
    if (!hit) { this.set(null); return; }
    let parent: THREE.Object3D | null = hit.object;
    while (parent && !groups.includes(parent)) parent = parent.parent;
    this.set({ring: parent?.userData.chartInteractionRole === 'transit-planets' ? 'transit' : 'natal',
      name:hit.object.userData.planet, longitude:hit.object.userData.trueLongitude});
  };
  public sceneChanged(): void { this.set(null); this.refresh(); }
  public dispose(): void {
    this.canvas.removeEventListener('mousemove', this.move);
    this.canvas.removeEventListener('mouseleave', this.leave);
    window.removeEventListener('resize', this.refresh);
    this.last = null;
    this.set(null);
  }
}
