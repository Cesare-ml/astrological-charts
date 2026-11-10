import { CommonModule } from '@angular/common';
import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, OnDestroy, ViewChild, inject, provideZonelessChangeDetection } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { defaultOpzioniGrafico, GestoreImmagini, GraficoRenderService, SkinManager, relatedChartAspects, sameChartPlanet } from '../src/public-api';
import type { ChartAspectRelation, ChartPlanetInteractionEvent, ChartPlanetLayer, ChartPlanetRef } from '../src/public-api';
import { demoBodies, makeDemoTheme } from './fixtures';
import { demoCrossChartAspects } from './interaction-fixtures';

type Mode = 'natal' | 'transits' | 'synastry' | 'latitude';

@Component({
  selector: 'chart-demo', standalone: true, imports: [CommonModule],
  template: `
  <main>
    <header><div><p class="eyebrow">ASTROLOGICAL CHARTS · DEVELOPMENT</p><h1>Renderer laboratory</h1>
      <p>Deterministic synthetic chart data · no account or backend</p></div><span class="version">Library 0.0.1</span></header>
    <section class="workspace">
      <aside>
        <label for="mode">Chart</label>
        <select id="mode" [value]="mode" [disabled]="busy" (change)="changeMode($event)">
          <option value="natal">Natal chart</option><option value="transits">Transits</option>
          <option value="synastry">Synastry</option><option value="latitude">Latitudes</option>
        </select>
        <label for="skin">Skin</label>
        <select id="skin" [value]="skin" [disabled]="busy" (change)="changeSkin($event)">
          <option *ngFor="let item of skins" [value]="item" [selected]="item === skin">{{item}}</option>
        </select>
        <div class="buttons"><button (click)="zoom(-1)" [disabled]="busy" aria-label="Zoom out">−</button>
          <button (click)="zoom(1)" [disabled]="busy" aria-label="Zoom in">+</button>
          <button class="primary" (click)="exportPng()" [disabled]="busy">Export PNG</button></div>
        <h2>Asset diagnostics</h2>
        <p class="muted">The included local server validates its manifest before serving assets. Placeholders are not the original artwork.</p>
        <label for="base">Asset base URL</label>
        <input id="base" [value]="assetBase" (change)="changeBase($event)" [disabled]="busy">
        <p class="muted">Manifest: {{manifestLabel}}</p>
        <p class="status" [class.error]="error" role="status" data-testid="status">{{error || status}}</p>
        <section class="planet-panel" aria-labelledby="planet-panel-title">
          <h2 id="planet-panel-title">Interactive planet focus</h2>
          <p class="muted">Select a body with a button, or point to a symbol in the chart. Transit links are illustrative fixture data.</p>
          <label for="planet-layer">Chart layer</label>
          <select id="planet-layer" [value]="planetLayer" [disabled]="busy" (change)="changePlanetLayer($event)">
            <option value="natal">Natal chart</option>
            <option *ngIf="mode === 'transits'" value="transit">Transits</option>
            <option *ngIf="mode === 'synastry'" value="synastry">Synastry</option>
          </select>
          <div class="planet-list" role="group" aria-label="Choose a planet to highlight">
            <button *ngFor="let body of bodies" type="button" class="planet-button"
              [disabled]="busy" [attr.aria-label]="'Highlight ' + planetLayer + ' ' + body"
              [attr.aria-pressed]="selectedPlanet?.layer === planetLayer && selectedPlanet?.name === body"
              (click)="selectPlanet(body)">{{body}}</button>
          </div>
          <button type="button" class="clear-focus" id="clear-focus" [disabled]="busy || !selectedPlanet"
            (click)="clearPlanet()">Clear selection</button>
          <div class="planet-readout">
            <p>Selected: <strong data-testid="planet-selection">{{selectedPlanet ? selectedPlanet.layer + ':' + selectedPlanet.name : 'None'}}</strong></p>
            <p>Hovered: <strong data-testid="planet-hover">{{hoveredPlanet ? hoveredPlanet.layer + ':' + hoveredPlanet.name : 'None'}}</strong></p>
            <p>Last chart event: <span data-testid="planet-event">{{lastPlanetEvent ? lastPlanetEvent.type + ' ' + lastPlanetEvent.planet.layer + ':' + lastPlanetEvent.planet.name : 'None'}}</span></p>
          </div>
          <div class="aspect-readout" *ngIf="mode === 'transits'">
            <h2>Related transit aspects <span class="aspect-count" data-testid="aspect-count">{{focusedAspects.length}}</span></h2>
            <ul *ngIf="focusedAspects.length; else noAspects" class="aspect-list">
              <li *ngFor="let link of focusedAspects" data-testid="aspect-match">
                {{link.from.layer}} {{link.from.name}} — {{link.type}} — {{link.to.layer}} {{link.to.name}}
                <span *ngIf="link.orb !== undefined"> (orb {{link.orb}}°)</span>
              </li>
            </ul>
            <ng-template #noAspects><p class="muted">Select or hover a planet to see its example transit aspects.</p></ng-template>
          </div>
        </section>
      </aside>
      <section class="stage" aria-label="Chart canvas"><canvas #canvas data-testid="chart"></canvas></section>
    </section>
    <footer>Fixture positions are illustrative; they are not astronomical calculations. Synthetic assets do not establish visual fidelity.</footer>
  </main>`
})
class DemoComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvas', { static: true }) canvas!: ElementRef<HTMLCanvasElement>;
  private readonly renderer = new GraficoRenderService();
  private readonly changes = inject(ChangeDetectorRef);
  readonly skins = Object.keys(SkinManager.skins);
  readonly bodies = demoBodies;
  planetLayer: ChartPlanetLayer = 'natal';
  selectedPlanet: ChartPlanetRef | null = null;
  hoveredPlanet: ChartPlanetRef | null = null;
  lastPlanetEvent: ChartPlanetInteractionEvent | null = null;

  get focusedAspects(): ChartAspectRelation[] {
    const focus = this.hoveredPlanet ?? this.selectedPlanet;
    return focus && this.mode === 'transits'
      ? relatedChartAspects(focus, demoCrossChartAspects) : [];
  }

  private readonly onPlanetInteraction = (event: ChartPlanetInteractionEvent): void => {
    this.lastPlanetEvent = event;
    if (event.type === 'enter') this.hoveredPlanet = event.planet;
    if (event.type === 'leave' && sameChartPlanet(this.hoveredPlanet, event.planet)) this.hoveredPlanet = null;
    if (event.type === 'click') {
      this.selectedPlanet = event.planet;
      this.planetLayer = event.planet.layer;
      this.renderer.highlightPlanet(event.planet);
    }
    this.changes.markForCheck();
  };
  mode: Mode = 'natal';
  skin = 'light';
  busy = false;
  status = 'Preparing renderer…';
  error = '';
  assetBase = new URLSearchParams(location.search).get('assets') || 'http://127.0.0.1:4177/assets/';
  manifestLabel = new URLSearchParams(location.search).get('manifest') || 'local server manifest (see server console)';
  private readonly radix = makeDemoTheme(0);
  private readonly transit = makeDemoTheme(24);
  private readonly synastry = makeDemoTheme(71);

  ngAfterViewInit(): void {
    try {
      GestoreImmagini.configurePublicAssetsBase(this.assetBase);
      this.renderer.setPlanetInteractionListener(this.onPlanetInteraction);
      this.renderer.setCrossChartAspects([]);
      this.renderer.inizializzaGraficoRender(this.canvas, {x: 800, y: 800});
      void this.draw();
    } catch (error) { this.showError(error); }
  }
  ngOnDestroy(): void {
    this.renderer.setPlanetInteractionListener(null);
    this.renderer.ngOnDestroy();
  }
  changeMode(event: Event): void {
    this.mode = (event.target as HTMLSelectElement).value as Mode;
    this.planetLayer = 'natal';
    this.hoveredPlanet = null;
    this.selectedPlanet = null;
    this.lastPlanetEvent = null;
    this.renderer.highlightPlanet(null);
    this.renderer.setCrossChartAspects(this.mode === 'transits' ? demoCrossChartAspects : []);
    void this.draw();
  }

  changePlanetLayer(event: Event): void {
    this.planetLayer = (event.target as HTMLSelectElement).value as ChartPlanetLayer;
    this.changes.markForCheck();
  }

  selectPlanet(name: string): void {
    if (this.busy) return;
    this.selectedPlanet = {layer: this.planetLayer, name};
    this.renderer.highlightPlanet(this.selectedPlanet);
    this.changes.markForCheck();
  }

  clearPlanet(): void {
    this.selectedPlanet = null;
    this.renderer.highlightPlanet(null);
    this.changes.markForCheck();
  }
  changeSkin(event: Event): void { this.skin = (event.target as HTMLSelectElement).value; void this.draw(); }
  changeBase(event: Event): void {
    try { this.assetBase = (event.target as HTMLInputElement).value; GestoreImmagini.configurePublicAssetsBase(this.assetBase); void this.draw(); }
    catch (error) { this.showError(error); }
  }
  zoom(direction: number): void { direction > 0 ? this.renderer.zoomIn(0.15) : this.renderer.zoomOut(0.15); }
  private options(): any {
    const opts = structuredClone(defaultOpzioniGrafico) as any;
    opts.settaggi.skin_id = this.skin;
    opts.temaGrafico = this.skin;
    opts.mostraTransiti = this.mode === 'transits';
    opts.mostraSinastria = this.mode === 'synastry';
    for (const body of demoBodies) { opts.settaggi.elementi_celesti[body].att = true; opts.settaggi.elementi_celesti[body].aspVerso = true; }
    return opts;
  }
  async draw(): Promise<void> {
    this.busy = true; this.error = ''; this.status = 'Rendering…'; this.changes.markForCheck();
    try {
      await this.renderer.disegnaScena(this.radix, this.mode === 'transits' ? this.transit : null,
        this.mode === 'synastry' ? this.synastry : null, this.mode === 'latitude' ? 'latitudini' : 'carta-astrale', this.options());
      this.status = 'Rendered with the configured asset server.';
    } catch (error) { this.showError(error); }
    finally { this.busy = false; this.changes.markForCheck(); }
  }
  async exportPng(): Promise<void> {
    this.busy = true; this.error = ''; this.status = 'Exporting…'; this.changes.markForCheck();
    try {
      const png = await this.renderer.generaImmagine(this.radix, this.mode === 'transits' ? this.transit : null,
        this.mode === 'synastry' ? this.synastry : null, this.mode === 'latitude' ? 'latitudini' : 'carta-astrale', this.options(), {x: 800, y: 800}, 2);
      const link = document.createElement('a'); link.href = png; link.download = `chart-${this.mode}-${this.skin}.png`; link.click();
      this.status = 'PNG exported.';
    } catch (error) { this.showError(error); }
    finally { this.busy = false; this.changes.markForCheck(); }
  }
  private showError(error: unknown): void {
    const detail = error instanceof Error ? error.message : typeof error === 'string' ? error : 'A required asset could not be loaded.';
    this.error = `Rendering failed: ${detail} Check the asset server, manifest and requested paths.`;
    this.changes.markForCheck();
  }
}

bootstrapApplication(DemoComponent, { providers: [provideZonelessChangeDetection()] }).catch(console.error);
