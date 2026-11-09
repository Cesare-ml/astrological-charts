import * as THREE from 'three';
import {ElementRef, Injectable, OnDestroy} from '@angular/core';

import {TemaRender} from '../models/tema-render.model';

import {CartaAstraleCreaScena} from '../renderers/@carta-astrale/carta-astrale.renderer';
import { OggettiSempliciRender } from '../renderers/oggetti-semplici.renderer';
//import {ElementiRender} from '../renderers/elementi.renderer';
import {LatitudiniRender} from '../renderers/@carta-astrale/latitudini.renderer';
//import {OrePlanetarieRender} from '../renderers/ore-planetarie.renderer';
//import {CosmocentricaRender} from '../renderers/cosmocentrica.renderer';
///import {GestoreEventiMouse} from '../renderers/_gestore-eventi-mouse';

//import {OggettiSempliciRender} from '../renderers/oggetti-semplici.renderer';

import {SkinManager} from '../renderers/@skin-manager';
import { debounceTime, fromEvent, map, startWith } from 'rxjs';

@Injectable({providedIn: 'root'})
export class GraficoRenderService implements OnDestroy {
  private canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  public camera: THREE.PerspectiveCamera;
  private scene: THREE.Scene;
  
  public scale = 1;

  private frameId: number = null;
  private renderRequestedBeforeInit = false;
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
    if (this.frameId != null) cancelAnimationFrame(this.frameId);
    
    if(this.resizeSub) {
      this.resizeSub.unsubscribe();
    }
  }

  // -------------------- INIT --------------------
  public inizializzaGraficoRender(
    canvas: ElementRef<HTMLCanvasElement>, 
    dimensioni: {x:number, y:number}
  ): void {
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

    OggettiSempliciRender.setDimensioniCanvas(dimensioni);

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

    const pixelRatio = /*window.devicePixelRatio **/ this.scale;
    //this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setPixelRatio(1);
    //console.log (window.devicePixelRatio);
    this.renderer.setSize(rect.width, rect.height, false);

    this.camera.aspect = rect.width / rect.height;
    this.camera.updateProjectionMatrix();

    // Aggiorna i materiali Line2 (LineMaterial)
    this.aggiornaLineMaterialResolution();
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

    if(!this.scene) this.scene = new THREE.Scene();
    // Riusa la scena per mantenere il renderer stabile
    this.scene.clear();
    const bgColor = SkinManager.skins[opzioni.settaggi.skin_id].bgColor;
    this.scene.background = new THREE.Color( bgColor );
    this.scene.add(this.camera);

    var disegno = null;

    switch (grafico) {/*
      case 'elementi':
        disegno = await ElementiRender.creaScena(temaRender,opzioni);
        break;*/

      case 'latitudini':
        disegno =  await LatitudiniRender.creaScena(temaRender,temaRenderTransiti,temaRenderSinastria,opzioni);
        break;

      case 'carta-astrale':
      default:
        disegno = await CartaAstraleCreaScena(opzioni,temaRender,temaRenderTransiti,temaRenderSinastria);
        break;
    }
    if (disegno) this.scene.add(disegno);
    this.render();
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

    OggettiSempliciRender.setDimensioniCanvas(dimensioni);
    offRenderer.setSize(offCanvas.width, offCanvas.height, false);
    offRenderer.setPixelRatio(scala);
    //console.log (window.devicePixelRatio);

    // ✅ Crea una scena e camera dedicate (indipendenti da quella desktop)
    const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
    camera.position.z = 3;

    const scene = new THREE.Scene();
    const bgColor = SkinManager.skins[opzioni.settaggi.skin_id].bgColor;
    scene.background = new THREE.Color(bgColor);
    scene.add(camera);

    // ✅ Genera il contenuto grafico esattamente come fai nel metodo desktop
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

    // ✅ Renderizza la scena
    offRenderer.render(scene, camera);

    // ✅ Estrai il PNG come dataURL
    const dataURL = offRenderer.domElement.toDataURL('image/png');

    // ✅ Libera risorse GPU
    offRenderer.dispose();
    scene.clear();

    return dataURL; // Puoi anche convertirlo in Blob se preferisci
  }

}
