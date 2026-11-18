import * as THREE from 'three';

export interface MouseEventCallbacks {
  onClick?: (oggetto: THREE.Object3D, event: MouseEvent) => void;
  onHoverEnter?: (oggetto: THREE.Object3D) => void;
  onHoverLeave?: (oggetto: THREE.Object3D) => void;
}

/**
 * Convert viewport client coordinates into Three.js normalized device
 * coordinates. Invalid or out-of-canvas positions must not raycast.
 * This helper never changes the camera, scale or geometry.
 */
export function mousePositionToNdc(
  clientX: number,
  clientY: number,
  rect: Pick<DOMRectReadOnly, 'left' | 'top' | 'width' | 'height'>
): { x: number; y: number } | null {
  if (![clientX, clientY, rect.left, rect.top, rect.width, rect.height].every(Number.isFinite)
    || rect.width <= 0 || rect.height <= 0) return null;
  const relativeX = (clientX - rect.left) / rect.width;
  const relativeY = (clientY - rect.top) / rect.height;
  if (relativeX < 0 || relativeX > 1 || relativeY < 0 || relativeY > 1) return null;
  return { x: relativeX * 2 - 1, y: 1 - relativeY * 2 };
}

export class GestoreEventiMouse {
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();
  private canvas: HTMLCanvasElement;
  private camera: THREE.Camera;
  private scene: THREE.Scene;
  private callbacks: MouseEventCallbacks;
  private oggettoHoverCorrente: THREE.Object3D | null = null;
  private lastClientPoint: { x: number; y: number } | null = null;

  constructor(
    canvas: HTMLCanvasElement,
    camera: THREE.Camera,
    scene: THREE.Scene,
    callbacks: MouseEventCallbacks = {}
  ) {
    this.canvas = canvas;
    this.camera = camera;
    this.scene = scene;
    this.callbacks = callbacks;

    this.initEventListeners();
  }

  private initEventListeners(): void {
    this.canvas.addEventListener('mousemove', this.onMouseMove);
    this.canvas.addEventListener('mouseleave', this.onMouseLeave);
    this.canvas.addEventListener('click', this.onClick);
    window.addEventListener('resize', this.onResize);
  }

  private onMouseMove = (event: MouseEvent): void => {
    this.lastClientPoint = { x: event.clientX, y: event.clientY };
    if (this.aggiornaCoordinateMouse()) this.controllaHover();
  };

  private onMouseLeave = (): void => {
    this.lastClientPoint = null;
    this.clearHover();
  };

  private onClick = (event: MouseEvent): void => {
    this.lastClientPoint = { x: event.clientX, y: event.clientY };
    if (!this.aggiornaCoordinateMouse()) return;
    const oggetti = this.intersecaOggetti();
    if (oggetti.length > 0) this.callbacks.onClick?.(oggetti[0].object, event);
  };

  private onResize = (): void => {
    // Mouse NDC is already normalized: never transform it a second time.
    // Recalculate from the LAST real client coordinates using the new rect.
    if (this.lastClientPoint && this.aggiornaCoordinateMouse()) this.controllaHover();
  };

  private aggiornaCoordinateMouse(): boolean {
    if (!this.lastClientPoint) return false;
    const point = mousePositionToNdc(
      this.lastClientPoint.x, this.lastClientPoint.y,
      this.canvas.getBoundingClientRect()
    );
    if (!point) {
      this.clearHover();
      return false;
    }
    this.mouse.set(point.x, point.y);
    return true;
  }

  private intersecaOggetti(): THREE.Intersection[] {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    return this.raycaster.intersectObjects(this.scene.children, true);
  }

  private clearHover(): void {
    const previous = this.oggettoHoverCorrente;
    this.oggettoHoverCorrente = null;
    if (previous) this.callbacks.onHoverLeave?.(previous);
  }

  private controllaHover(): void {
    const intersezioni = this.intersecaOggetti();
    const oggettoAttuale = intersezioni.length > 0 ? intersezioni[0].object : null;
    if (oggettoAttuale !== this.oggettoHoverCorrente) {
      this.clearHover();
      if (oggettoAttuale) this.callbacks.onHoverEnter?.(oggettoAttuale);
      this.oggettoHoverCorrente = oggettoAttuale;
    }
  }

  public distruggi(): void {
    this.canvas.removeEventListener('mousemove', this.onMouseMove);
    this.canvas.removeEventListener('mouseleave', this.onMouseLeave);
    this.canvas.removeEventListener('click', this.onClick);
    window.removeEventListener('resize', this.onResize);
    this.lastClientPoint = null;
    this.clearHover();
  }
}
