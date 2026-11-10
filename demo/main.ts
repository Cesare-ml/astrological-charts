/* Copyright (c) 2026 Cesare-ml (VirgoStars project). CPAL-1.0; see ../LICENSE. */
import { CommonModule } from '@angular/common';
import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, OnDestroy, ViewChild, inject, provideZonelessChangeDetection } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { defaultOpzioniGrafico, GestoreImmagini, GraficoRenderService, SkinManager } from '../src/public-api';
import { demoBodies, makeDemoTheme } from './fixtures';
import { parseChartPayload } from './chart-input';

type Mode = 'natal' | 'transits' | 'synastry' | 'latitude';

@Component({
  selector: 'chart-demo', standalone: true, imports: [CommonModule],
  template: `
  <main>
    <header><div><p class="eyebrow">ASTROLOGICAL CHARTS · DEVELOPMENT</p><h1>Renderer laboratory</h1>
      <p>Deterministic synthetic chart data · no account or backend</p>
      <p class="muted">Powered by <a href="https://www.virgostars.it/" target="_blank" rel="noopener noreferrer">VirgoStars</a></p></div><span class="version">Library 0.0.1</span></header>
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
        <label for="chart-file">Import your computed chart (JSON)</label>
        <input id="chart-file" type="file" accept=".json,application/json" [disabled]="busy" (change)="importChart($event)">
        <p class="muted" data-testid="chart-source">{{sourceLabel}}. No astrology is calculated here; your JSON supplies the positions.</p>
        <h2>Asset diagnostics</h2>
        <p class="muted">The included local server validates its manifest before serving assets. Placeholders are not the original artwork.</p>
        <label for="base">Asset base URL</label>
        <input id="base" [value]="assetBase" (change)="changeBase($event)" [disabled]="busy">
        <p class="muted">Manifest: {{manifestLabel}}</p>
        <p class="status" [class.error]="error" role="status" data-testid="status"
           [attr.data-render-revision]="renderRevision"
           [attr.data-render-mode]="renderedMode"
           [attr.data-render-skin]="renderedSkin">{{error || status}}</p>
      </aside>
      <section class="stage" aria-label="Chart canvas"><canvas #canvas data-testid="chart"></canvas></section>
    </section>
    <footer>The default fixture is illustrative; imported data is rendered as provided. Synthetic assets do not establish visual fidelity. Powered by VirgoStars · www.virgostars.it</footer>
  </main>`
})
class DemoComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvas', { static: true }) canvas!: ElementRef<HTMLCanvasElement>;
  private readonly renderer = new GraficoRenderService();
  private readonly changes = inject(ChangeDetectorRef);
  readonly skins = Object.keys(SkinManager.skins);
  mode: Mode = 'natal';
  skin = 'light';
  busy = false;
  status = 'Preparing renderer…';
  error = '';
  assetBase = new URLSearchParams(location.search).get('assets') || 'http://127.0.0.1:4177/assets/';
  manifestLabel = new URLSearchParams(location.search).get('manifest') || 'local server manifest (see server console)';
  sourceLabel = 'Illustrative synthetic fixture';
  // Completed draw marker for automated consumers: mode changes are async.
  // A revision advances on both draw completion and invalid JSON import.
  renderRevision = 0;
  renderedMode: Mode | '' = '';
  renderedSkin = '';
  private radix = makeDemoTheme(0);
  private transit: ReturnType<typeof makeDemoTheme> | null = makeDemoTheme(24);
  private synastry: ReturnType<typeof makeDemoTheme> | null = makeDemoTheme(71);

  ngAfterViewInit(): void {
    try {
      GestoreImmagini.configurePublicAssetsBase(this.assetBase);
      this.renderer.inizializzaGraficoRender(this.canvas, {x: 800, y: 800});
      void this.draw();
    } catch (error) { this.showError(error); }
  }
  ngOnDestroy(): void { this.renderer.ngOnDestroy(); }
  changeMode(event: Event): void { this.mode = (event.target as HTMLSelectElement).value as Mode; void this.draw(); }
  async importChart(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    try {
      if (file.size > 1_000_000) throw new Error('JSON file is too large (maximum 1 MB).');
      const parsed = parseChartPayload(JSON.parse(await file.text()));
      if (parsed.skin && !this.skins.includes(parsed.skin)) {
        throw new Error(`Unknown skin: ${parsed.skin}. Choose one available in the Skin menu.`);
      }
      this.radix = parsed.natal;
      this.transit = parsed.transits;
      this.synastry = parsed.synastry;
      this.mode = parsed.mode;
      if (parsed.skin) this.skin = parsed.skin;
      this.sourceLabel = `Imported: ${file.name}`;
      await this.draw();
    } catch (error) { this.showError(error); }
    finally { input.value = ''; }
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
    // Never enable planets absent from the user's computed dataset.
    const supplied = new Set([
      ...Object.keys(this.radix.planets ?? {}),
      ...(this.mode === 'transits' ? Object.keys(this.transit?.planets ?? {}) : []),
      ...(this.mode === 'synastry' ? Object.keys(this.synastry?.planets ?? {}) : []),
    ]);
    for (const body of demoBodies) {
      const option = opts.settaggi.elementi_celesti[body];
      if (option) {
        option.att = supplied.has(body);
        option.aspVerso = supplied.has(body);
      }
    }
    for (const body of supplied) {
      const option = opts.settaggi.elementi_celesti[body];
      if (option) { option.att = true; option.aspVerso = true; }
    }
    return opts;
  }
  async draw(): Promise<void> {
    const drawingMode = this.mode;
    const drawingSkin = this.skin;
    this.busy = true; this.error = ''; this.status = 'Rendering…'; this.changes.markForCheck();
    try {
      if (this.mode === 'transits' && !this.transit) throw new Error('This JSON contains no transits data.');
      if (this.mode === 'synastry' && !this.synastry) throw new Error('This JSON contains no synastry data.');
      await this.renderer.disegnaScena(this.radix, this.mode === 'transits' ? this.transit : null,
        this.mode === 'synastry' ? this.synastry : null, this.mode === 'latitude' ? 'latitudini' : 'carta-astrale', this.options());
      this.renderedMode = drawingMode;
      this.renderedSkin = drawingSkin;
      this.status = 'Rendered with the configured asset server.';
    } catch (error) { this.showError(error); }
    finally { this.busy = false; this.renderRevision++; this.changes.markForCheck(); }
  }
  async exportPng(): Promise<void> {
    this.busy = true; this.error = ''; this.status = 'Exporting…'; this.changes.markForCheck();
    try {
      if (this.mode === 'transits' && !this.transit) throw new Error('This JSON contains no transits data.');
      if (this.mode === 'synastry' && !this.synastry) throw new Error('This JSON contains no synastry data.');
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
    // Import errors do not start draw(), so still signal completion to callers.
    this.renderRevision++;
    this.changes.markForCheck();
  }
}

bootstrapApplication(DemoComponent, { providers: [provideZonelessChangeDetection()] }).catch(console.error);
