import * as THREE from 'three';
import {ElementRef, Injectable, OnDestroy} from '@angular/core';

import {TemaRender} from '../models/tema-render.model';

import {CartaAstraleCreaScena} from '../renderers/@carta-astrale/carta-astrale.renderer';
import { OggettiSempliciRender } from '../renderers/oggetti-semplici.renderer';
import { GestoreImmagini } from '../renderers/gestore-immagini';
import { stopSceneAnimations } from '../renderers/scene-animations';
//import {ElementiRender} from '../renderers/elementi.renderer';
import {LatitudiniRender} from '../renderers/@carta-astrale/latitudini.renderer';
//import {OrePlanetarieRender} from '../renderers/ore-planetarie.renderer';
//import {CosmocentricaRender} from '../renderers/cosmocentrica.renderer';
///import {GestoreEventiMouse} from '../renderers/_gestore-eventi-mouse';

//import {OggettiSempliciRender} from '../renderers/oggetti-semplici.renderer';

import {SkinManager} from '../renderers/@skin-manager';
import { debounceTime, fromEvent, map, startWith } from 'rxjs';

/** Dispose resources owned by a generated scene, once per object identity. */
function disposeSceneResources(root: THREE.Object3D): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  const errors: unknown[] = [];
  const objects: THREE.Object3D[] = [];
  // Snapshot scene ownership before kill() callbacks can detach children or
  // change material/geometry references during teardown.
  root.traverse((object: any) => {
    objects.push(object);
    if (object.geometry) geometries.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (!material) continue;
      materials.add(material);
      for (const value of Object.values(material)) {
        if (value instanceof THREE.Texture) textures.add(value);
      }
    }
  });
  for (const object of objects) {
    try { stopSceneAnimations(object); }
    catch (error) { errors.push(error); }
  }
  // Disposing one faulty resource must not strand the other GPU allocations.
  for (const texture of textures) {
    try { texture.dispose(); } catch (error) { errors.push(error); }
  }
  for (const material of materials) {
    try { material.dispose(); } catch (error) { errors.push(error); }
  }
  for (const geometry of geometries) {
    try { geometry.dispose(); } catch (error) { errors.push(error); }
  }
  if (errors.length === 1) throw errors[0];
  if (errors.length > 1) throw new AggregateError(errors, 'Failed to dispose scene resources.');
}


/** Release resources and detach children even if a cleanup hook throws. */
function disposeAndClearScene(scene: THREE.Scene): void {
  const errors: unknown[] = [];
  try { disposeSceneResources(scene); } catch (error) { errors.push(error); }
  try { scene.clear(); } catch (error) { errors.push(error); }
  if (errors.length === 1) throw errors[0];
  if (errors.length > 1) throw new AggregateError(errors, 'Failed to clear chart scene.');
}

async function waitForSceneTextures(root: THREE.Object3D): Promise<void> {
  const textures = new Set<THREE.Texture>();
  root.traverse((object: any) => {
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (!material) continue;
      for (const value of Object.values(material)) {
        if (value instanceof THREE.Texture) textures.add(value);
      }
    }
  });
  await Promise.all([...textures].map(texture => GestoreImmagini.waitForTexture(texture)));
}

@Injectable({providedIn: 'root'})
export class GraficoRenderService implements OnDestroy {
  // Scene construction uses legacy module-wide dimensions. Serialize it across
  // service instances until those renderer inputs can be made instance-local.
  private static renderQueue: Promise<void> = Promise.resolve();
  private static constructingScene = false;
  private static runExclusive<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.renderQueue.then(async () => {
      this.constructingScene = true;
      try { return await operation(); }
      finally { this.constructingScene = false; }
    });
    this.renderQueue = result.then(() => undefined, () => undefined);
    return result;
  }

  private canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  public camera: THREE.PerspectiveCamera;
  private scene: THREE.Scene;
  
  public scale = 1;

  private frameId: number = null;
  private renderRequestedBeforeInit = false;
  private drawGeneration = 0;
  public isInizializzato = false;

  private zoomValue: number = 1; // 1 valore attuale dello zoom
  private readonly minZoom: number = 0.05;//0.17;
  private readonly maxZoom: number = 5;

  private dimensioni: {x:number, y:number};

  resizeSub;

  public constructor() {}

  // ### ZOOM ###
  public setZoom(zoom: number): void {
    this.zoomValue = Math.max(this.minZoom, Math.min(this.maxZoom, zoom));
    if (this.camera) {
      this.camera.zoom = this.zoomValue;
      this.camera.updateProjectionMatrix();
      this.render();
    }
  }

  public zoomIn(step: number = 0.04): void {
    this.setZoom(this.zoomValue + step);
  }

  public zoomOut(step: number = 0.04): void {
    this.setZoom(this.zoomValue - step);
  }


  // -------------------- LIFECYCLE --------------------

  public ngOnDestroy(): void {
    ++this.drawGeneration;
    const errors: unknown[] = [];
    // Release handles first so repeated teardown cannot cancel/unsubscribe twice.
    const frameId = this.frameId;
    const resizeSub = this.resizeSub;
    this.frameId = null;
    this.resizeSub = null;
    if (frameId != null) {
      try { cancelAnimationFrame(frameId); } catch (error) { errors.push(error); }
    }
    if (resizeSub) {
      try { resizeSub.unsubscribe(); } catch (error) { errors.push(error); }
    }
    if (this.scene) {
      try { disposeSceneResources(this.scene); } catch (error) { errors.push(error); }
      try { this.scene.clear(); } catch (error) { errors.push(error); }
    }
    try { this.renderer?.dispose(); } catch (error) { errors.push(error); }
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.isInizializzato = false;
    if (errors.length === 1) throw errors[0];
    if (errors.length > 1) throw new AggregateError(errors, 'Failed to destroy chart renderer.');
  }

  // -------------------- INIT --------------------
  public inizializzaGraficoRender(
    canvas: ElementRef<HTMLCanvasElement>, 
    dimensioni: {x:number, y:number}
  ): void {
    if (this.renderer) this.ngOnDestroy();
    // The first step is to get the reference of the canvas element from our HTML document
    this.canvas = canvas.nativeElement;
    this.dimensioni = dimensioni;

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      alpha: true,    // transparent background
      antialias: true, // smooth edges
      //premultipliedAlpha:true
    });
    
    this.renderer.setSize(this.dimensioni.x, this.dimensioni.y, false);
    //this.renderer.setPixelRatio(/*window.devicePixelRatio **/ this.scale);
    this.renderer.setPixelRatio(window.devicePixelRatio );
    this.renderer.setClearColor(0x000000, 0);

    if (!GraficoRenderService.constructingScene) OggettiSempliciRender.setDimensioniCanvas(dimensioni);

    // create the scene
    this.scene = new THREE.Scene();
    //this.scene.background = new THREE.Color( 0x1f1a17 );
    this.camera = new THREE.PerspectiveCamera(75, 1/1, 0.1, 1000);
    this.camera.position.z = 2.98;//3.5
    this.camera.zoom = this.zoomValue;
    this.camera.updateProjectionMatrix();
    this.scene.add(this.camera);

    this.aggiornaRisoluzioneRenderer();

    this.resizeSub = fromEvent(window, 'resize')
      .pipe(
        debounceTime(150),
        map(() => this._onResize()),
        startWith(this._onResize())
      ).subscribe(() => {})
    ;

    this.isInizializzato = true;
    if (this.renderRequestedBeforeInit) {
      this.renderRequestedBeforeInit = false;
      this.render();
    }
    //this.animate();
  }

  // -------------------- RESIZE & RISOLUZIONE --------------------

  private _onResize = () => this.aggiornaRisoluzioneRenderer();

  private aggiornaRisoluzioneRenderer(): void {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const pixelRatio = /*window.devicePixelRatio **/ this.scale;
    //this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setPixelRatio(1);
    //console.log (window.devicePixelRatio);
    this.renderer.setSize(rect.width, rect.height, false);

    this.camera.aspect = rect.width / rect.height;
    this.camera.updateProjectionMatrix();

    // Aggiorna i materiali Line2 (LineMaterial)
    this.aggiornaLineMaterialResolution();
    if (this.isInizializzato) this.render();
  }

  private aggiornaLineMaterialResolution(): void {
    if (!this.scene) return;

    // Usa la risoluzione reale in pixel, non CSS
    const w = this.canvas.width;
    const h = this.canvas.height;

    this.scene.traverse((obj: any) => {
      const mat = obj.material;
      if (!mat) return;

      // singolo materiale
      if (mat.isLineMaterial && mat.resolution) {
        mat.resolution.set(w, h);
        if (mat.transparent === false) {
          mat.transparent = true;
          mat.opacity = 0.9; // ammorbidisce visivamente i bordi
        }
      }

      // array di materiali
      if (Array.isArray(mat)) {
        mat.forEach((m) => {
          if (m && m.isLineMaterial && m.resolution) {
            m.resolution.set(w, h);
            if (m.transparent === false) {
              m.transparent = true;
              m.opacity = 0.9;
            }
          }
        });
      }
    });
  }
  
  public async disegnaScena(
    temaRender:TemaRender,
    temaRenderTransiti:TemaRender,
    temaRenderSinastria:TemaRender,
    grafico:string,
    opzioni:any
  ) {
    if(temaRender == null)
      return;
    const generation = ++this.drawGeneration;
    return GraficoRenderService.runExclusive(async () => {
      if (generation !== this.drawGeneration) return;
      if (this.dimensioni) OggettiSempliciRender.setDimensioniCanvas(this.dimensioni);
      let disegno = null;
      let adopted = false;
      let operationFailed = false;
      let operationError: unknown;
      try {
        switch (grafico) {
          case 'latitudini':
            disegno = await LatitudiniRender.creaScena(temaRender,temaRenderTransiti,temaRenderSinastria,opzioni);
            break;
          case 'carta-astrale':
          default:
            disegno = await CartaAstraleCreaScena(opzioni,temaRender,temaRenderTransiti,temaRenderSinastria);
            break;
        }
        if (disegno) await waitForSceneTextures(disegno);
        if (generation !== this.drawGeneration) return;
        if (!this.scene) this.scene = new THREE.Scene();
        // A failed old-scene disposal must not strand the newly built scene.
        disposeAndClearScene(this.scene);
        const bgColor = SkinManager.skins[opzioni.settaggi.skin_id].bgColor;
        this.scene.background = new THREE.Color(bgColor);
        if (this.camera) this.scene.add(this.camera);
        if (disegno) this.scene.add(disegno);
        adopted = true;
        this.render();
      } catch (error) {
        operationFailed = true;
        operationError = error;
        throw error;
      } finally {
        if (disegno && !adopted) {
          try { disposeSceneResources(disegno); }
          catch (cleanupError) {
            if (operationFailed) {
              throw new AggregateError([operationError, cleanupError], 'Failed to draw and discard chart scene.');
            }
            throw cleanupError;
          }
        }
      }
    });
  }

  public render(): void {
    if (!this.isInizializzato) {
      this.renderRequestedBeforeInit = true;
      return;
    }
    
    this.renderer.render(this.scene, this.camera);
  }

  public async generaImmagine(
    temaRender: TemaRender,
    temaRenderTransiti: TemaRender,
    temaRenderSinastria: TemaRender,
    grafico: string,
    opzioni: any,
    dimensioni: { x: number, y: number } = { x: 1080, y: 1080 },
    scala: number = 2 // per migliorare nitidezza (Retina-style)
  ): Promise<string> {
    return GraficoRenderService.runExclusive(() => this.generaImmagineInterna(
      temaRender, temaRenderTransiti, temaRenderSinastria, grafico, opzioni, dimensioni, scala));
  }

  private async generaImmagineInterna(
    temaRender: TemaRender, temaRenderTransiti: TemaRender, temaRenderSinastria: TemaRender,
    grafico: string, opzioni: any, dimensioni: {x:number, y:number}, scala: number
  ): Promise<string> {
    // ✅ Crea un canvas off-screen (non quello principale del component)
    const offCanvas = document.createElement('canvas');
    offCanvas.width = dimensioni.x * scala;
    offCanvas.height = dimensioni.y * scala;

    const offRenderer = new THREE.WebGLRenderer({
      canvas: offCanvas,
      preserveDrawingBuffer: true, // serve per esportare l'immagine!
      antialias: true,
      alpha: true,
    });

    let scene: THREE.Scene | null = null;
    let exportFailed = false;
    let exportError: unknown;
    try {
      scene = new THREE.Scene();
      OggettiSempliciRender.setDimensioniCanvas(dimensioni);
      offRenderer.setPixelRatio(scala);
      offRenderer.setSize(dimensioni.x, dimensioni.y, false);
      const camera = new THREE.PerspectiveCamera(75, dimensioni.x / dimensioni.y, 0.1, 1000);
      camera.position.z = 3;
      const bgColor = SkinManager.skins[opzioni.settaggi.skin_id].bgColor;
      scene.background = new THREE.Color(bgColor);
      scene.add(camera);
      // Genera il contenuto grafico come nella scena interattiva.
      let disegno = null;
      switch (grafico) {
        case 'latitudini':
          disegno = await LatitudiniRender.creaScena(temaRender, temaRenderTransiti, temaRenderSinastria, opzioni);
          break;
        case 'carta-astrale':
        default:
          disegno = await CartaAstraleCreaScena(opzioni, temaRender, temaRenderTransiti, temaRenderSinastria);
          break;
      }

      if (disegno) scene.add(disegno);
      if (disegno) await waitForSceneTextures(disegno);
      offRenderer.render(scene, camera);
      return offRenderer.domElement.toDataURL('image/png');
    } catch (error) {
      exportFailed = true;
      exportError = error;
      throw error;
    } finally {
      const cleanupErrors: unknown[] = [];
      if (scene) {
        try { disposeAndClearScene(scene); } catch (error) { cleanupErrors.push(error); }
      }
      try { offRenderer.dispose(); } catch (error) { cleanupErrors.push(error); }
      if (cleanupErrors.length) {
        const errors = exportFailed ? [exportError, ...cleanupErrors] : cleanupErrors;
        if (errors.length === 1) throw errors[0];
        throw new AggregateError(errors, 'Failed to export PNG or release offscreen renderer.');
      }
    }
  }

}
