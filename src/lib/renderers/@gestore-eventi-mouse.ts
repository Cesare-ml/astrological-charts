import * as THREE from 'three';

export interface MouseEventCallbacks {
  onClick?: (oggetto: THREE.Object3D, event: MouseEvent) => void;
  onHoverEnter?: (oggetto: THREE.Object3D) => void;
  onHoverLeave?: (oggetto: THREE.Object3D) => void;
}

export class GestoreEventiMouse {
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();
  private canvas: HTMLCanvasElement;
  private camera: THREE.Camera;
  private scene: THREE.Scene;
  private callbacks: MouseEventCallbacks;
  private oggettoHoverCorrente: THREE.Object3D | null = null;
  private hoverTransition = 0;

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
    this.canvas.addEventListener('click', this.onClick);
    this.canvas.addEventListener('mouseleave', this.onMouseLeave);
    window.addEventListener('resize', this.onResize);
    window.addEventListener('blur', this.onMouseLeave);
  }

  private onMouseMove = (event: MouseEvent): void => {
    this.aggiornaCoordinateMouse(event);
    this.controllaHover();
  };

  private onMouseLeave = (): void => {
    this.clearHover();
  };

  private onClick = (event: MouseEvent): void => {
    this.aggiornaCoordinateMouse(event);
    const oggetti = this.intersecaOggetti();
    if (oggetti.length > 0 && this.callbacks.onClick) {
      this.callbacks.onClick(oggetti[0].object, event);
    }
  };

  private onResize = (): void => {
    // Mantiene coordinate corrette anche dopo resize
    const rect = this.canvas.getBoundingClientRect();
    this.mouse.x = ((this.mouse.x - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((this.mouse.y - rect.top) / rect.height) * 2 + 1;
  };

  private aggiornaCoordinateMouse(event: MouseEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  private intersecaOggetti(): THREE.Intersection[] {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    return this.raycaster.intersectObjects(this.scene.children, true);
  }

  private controllaHover(): void {
    const intersezioni = this.intersecaOggetti();
    const oggettoAttuale = intersezioni.length > 0 ? intersezioni[0].object : null;

    if (oggettoAttuale === this.oggettoHoverCorrente) return;

    const previous = this.oggettoHoverCorrente;
    const transition = ++this.hoverTransition;
    // Detach the old hover before notifying consumers. Callbacks may synchronously
    // dispatch mouseleave, change the highlighted glyph, or destroy the canvas.
    this.oggettoHoverCorrente = null;
    if (previous) this.callbacks.onHoverLeave?.(previous);
    if (transition !== this.hoverTransition) return;

    this.oggettoHoverCorrente = oggettoAttuale;
    if (oggettoAttuale) this.callbacks.onHoverEnter?.(oggettoAttuale);
  }

  private clearHover(): void {
    // Invalidate an in-flight transition even when nothing is currently hovered.
    ++this.hoverTransition;
    const previous = this.oggettoHoverCorrente;
    // Clear before calling external code so reentrant leave/blur events cannot double-fire.
    this.oggettoHoverCorrente = null;
    if (previous) this.callbacks.onHoverLeave?.(previous);
  }

  public distruggi(): void {
    this.canvas.removeEventListener('mousemove', this.onMouseMove);
    this.canvas.removeEventListener('click', this.onClick);
    this.canvas.removeEventListener('mouseleave', this.onMouseLeave);
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('blur', this.onMouseLeave);
    this.clearHover();
  }
}
