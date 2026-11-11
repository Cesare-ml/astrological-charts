import * as THREE from 'three';
import {ElementRef, Injectable, OnDestroy} from '@angular/core';

import {TemaRender} from '../models/tema-render.model';

import {CartaAstraleCreaScena} from '../renderers/@carta-astrale/carta-astrale.renderer';
import { OggettiSempliciRender } from '../renderers/oggetti-semplici.renderer';
import { GestoreImmagini } from '../renderers/gestore-immagini';
import { stopSceneAnimations } from '../renderers/scene-animations';
import { PlanetInteractionController } from '../renderers/planet-interaction.controller';
import type { ChartAspectRelation, ChartPlanetInteractionEvent, ChartPlanetRef } from '../renderers/planet-interaction.types';
import { snapshotChartAspects } from '../renderers/planet-interaction.types';
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
  root.traverse((object: any) => {
    stopSceneAnimations(object);
    if (object.geometry) geometries.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (!material) continue;
      materials.add(material);
      for (const value of Object.values(material)) {
        if (value instanceof THREE.Texture) textures.add(value);
      }
    }
  });
  textures.forEach(texture => texture.dispose());
  materials.forEach(material => material.dispose());
  geometries.forEach(geometry => geometry.dispose());
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
  private planetController: PlanetInteractionController | null = null;
  private planetListener: ((event: ChartPlanetInteractionEvent) => void) | null = null;
  private crossChartAspects: ChartAspectRelation[] = [];
  private pinnedPlanet: ChartPlanetRef | null = null;
  private natalAspectPresentation: 'all' | 'focused' | 'muted' = 'all';
  
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

  /** Bridge pointer events to any Angular/frontend state store. */
  public setPlanetInteractionListener(listener: ((event: ChartPlanetInteractionEvent) => void) | null): void {
    this.planetListener = listener;
  }

  /** Use aspect results calculated upstream; this renderer never computes transit orbs. */
  public setCrossChartAspects(aspects: readonly ChartAspectRelation[]): void {
    this.crossChartAspects = snapshotChartAspects(aspects);
    this.planetController?.setRelations(this.crossChartAspects);
  }

  /** On-screen natal aspect palette: all colored, focused colored, or gray. */
  public setNatalAspectPresentation(presentation: 'all' | 'focused' | 'muted'): void {
    this.natalAspectPresentation = presentation;
    this.planetController?.setNatalAspectPresentation(presentation);
  }

  /** Programmatic focus for buttons/keyboard controls. null clears it. */
  public highlightPlanet(planet: ChartPlanetRef | null): void {
    this.pinnedPlanet = planet ? { ...planet } : null;
    this.planetController?.highlight(this.pinnedPlanet);
  }

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
    this.planetController?.destroy();
    this.planetController = null;
    if (this.frameId != null) cancelAnimationFrame(this.frameId);
    
    if(this.resizeSub) {
      this.resizeSub.unsubscribe();
    }
    if (this.scene) {
      disposeSceneResources(this.scene);
      this.scene.clear();
    }
    // dispose() releases Three.js resources; forceContextLoss() additionally
    // frees the browser's WebGL context when the canvas is permanently retired.
    // Never force loss during ordinary scene redraws.
    if (this.renderer) {
      this.renderer.dispose();
      this.renderer.forceContextLoss();
    }
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.isInizializzato = false;
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
    this.planetController = new PlanetInteractionController(
      this.canvas, this.camera, event => this.planetListener?.(event), () => this.render()
    );
    this.planetController.setRelations(this.crossChartAspects);
    this.planetController.setNatalAspectPresentation(this.natalAspectPresentation);
    this.planetController.highlight(this.pinnedPlanet);
    this.planetController.setScene(this.scene);

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
      switch (grafico) {
        case 'latitudini':
          disegno = await LatitudiniRender.creaScena(temaRender,temaRenderTransiti,temaRenderSinastria,opzioni);
          break;
        case 'carta-astrale':
        default:
          disegno = await CartaAstraleCreaScena(opzioni,temaRender,temaRenderTransiti,temaRenderSinastria);
          break;
      }
      try {
        if (disegno) await waitForSceneTextures(disegno);
      } catch (error) {
        if (disegno) disposeSceneResources(disegno);
        throw error;
      }
      if (generation !== this.drawGeneration) {
        if (disegno) disposeSceneResources(disegno);
        return;
      }
      if (!this.scene) this.scene = new THREE.Scene();
      this.planetController?.setScene(null);
      disposeSceneResources(this.scene);
      this.scene.clear();
      const bgColor = SkinManager.skins[opzioni.settaggi.skin_id].bgColor;
      this.scene.background = new THREE.Color(bgColor);
      if (this.camera) this.scene.add(this.camera);
      if (disegno) this.scene.add(disegno);
      this.planetController?.setScene(this.scene);
      this.render();
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

    const scene = new THREE.Scene();
    try {
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
    } finally {
      disposeSceneResources(scene);
      scene.clear();
      offRenderer.dispose();
      // PNG export uses a new temporary canvas/context on every call.
      // Release it immediately instead of waiting for browser GC/context caps.
      offRenderer.forceContextLoss();
    }
  }

}
