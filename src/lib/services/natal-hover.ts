import * as THREE from 'three';
import {mousePositionToNdc} from '../renderers/@gestore-eventi-mouse';

/** Hover data refers to the supplied natal chart, never the displaced glyph longitude. */
export interface NatalPlanetHover { name: string; longitude: number; projection?: 'dodecatemoria'; }

export class NatalHoverController {
  private readonly raycaster = new THREE.Raycaster();
  private readonly point = new THREE.Vector2();
  private last: {x: number; y: number} | null = null;
  private current: NatalPlanetHover | null = null;

  constructor(private readonly canvas: HTMLCanvasElement,
    private readonly getScene: () => THREE.Scene | null,
    private readonly getCamera: () => THREE.Camera | null,
    private readonly notify: (value: NatalPlanetHover | null) => void) {
    this.raycaster.params.Line.threshold = 0.035;
    canvas.addEventListener('mousemove', this.move);
    canvas.addEventListener('mouseleave', this.leave);
    window.addEventListener('resize', this.refresh);
  }

  private move = (event: MouseEvent): void => {
    this.last = {x: event.clientX, y: event.clientY};
    this.refresh();
  };
  private leave = (): void => { this.last = null; this.set(null); };
  private set(value: NatalPlanetHover | null): void {
    if (this.current?.name === value?.name && this.current?.longitude === value?.longitude &&
        this.current?.projection === value?.projection) return;
    this.current = value;
    this.notify(value);
  }
  public refresh = (): void => {
    const scene = this.getScene(), camera = this.getCamera();
    const ndc = this.last && mousePositionToNdc(this.last.x, this.last.y, this.canvas.getBoundingClientRect());
    const natal: THREE.Object3D[] = [];
    scene?.traverse(object => {
      if (object.userData.chartInteractionRole === 'natal-planets' || object.userData.chartInteractionRole === 'natal-axes') natal.push(object);
    });
    if (!ndc || !camera || !natal.length) { this.set(null); return; }
    scene!.updateMatrixWorld(true);
    camera.updateMatrixWorld(true);
    this.point.set(ndc.x, ndc.y);
    this.raycaster.setFromCamera(this.point, camera);
    const hit = this.raycaster.intersectObjects(natal, true).find(item =>
      (typeof item.object.userData.planet === 'string' || typeof item.object.userData.dodecatemoria === 'string') &&
      Number.isFinite(item.object.userData.trueLongitude));
    if (!hit) { this.set(null); return; }
    const data = hit.object.userData;
    this.set(typeof data.dodecatemoria === 'string'
      ? {name:data.dodecatemoria, longitude:data.trueLongitude, projection:'dodecatemoria'}
      : {name:data.planet, longitude:data.trueLongitude});
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
