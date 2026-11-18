import { CommonModule } from '@angular/common';
import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, OnDestroy, ViewChild, inject, provideZonelessChangeDetection } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { defaultOpzioniGrafico, GestoreImmagini, GraficoRenderService, SkinManager } from '../src/public-api';
import { demoBodies, makeDemoTheme, makeDenseDemoTheme } from './fixtures';

type Mode = 'natal' | 'transits' | 'synastry' | 'latitude';

@Component({
  selector: 'chart-demo', standalone: true, imports: [CommonModule],
  template: `
  <main>
    <header><div><p class="eyebrow">ASTROLOGICAL CHARTS · DEVELOPMENT</p><h1>Renderer laboratory</h1>
      <p>Deterministic synthetic chart · 5 close celestial bodies · no account or backend</p></div><span class="version">Library 0.0.1</span></header>
    <section class="workspace">
      <aside>
        <label for="mode">Chart</label>
        <select id="mode" [value]="mode" [disabled]="busy" (change)="changeMode($event)">
          <option value="natal">Natal chart</option><option value="transits">Transits</option>
          <option value="synastry">Synastry</option><option value="latitude">Latitudes</option>
        </select>
        <label class="check-setting" for="show-degrees"><input id="show-degrees" type="checkbox" [checked]="showDegrees" [disabled]="busy" (change)="changeDegrees($event)"> Show celestial degrees</label>
        <h2>Axis annotations</h2>
        <label class="check-setting" *ngFor="let item of axisSettings" [for]="item.key">
          <input [id]="item.key" type="checkbox" [checked]="axisOptions[item.key]" [disabled]="busy" (change)="changeAxisOption(item.key,$event)"> {{item.label}}
        </label>
        <label for="house-size">House numeral size: {{houseSize.toFixed(2)}}×</label>
        <input id="house-size" type="range" min="0.8" max="1.7" step="0.05" [value]="houseSize" [disabled]="busy" (input)="changeHouseSize($event)">
        <label class="check-setting" for="dense"><input id="dense" type="checkbox" [checked]="dense" [disabled]="busy" (change)="changeDense($event)"> Conjunction stress-test (synthetic)</label>
        <h2>Reference natal chart</h2>
        <p class="muted">Import a calculated VirgoStars TemaRender JSON for your reference date/place. It becomes the default chart in this browser; no birth data is committed to the repository or sent by the demo.</p>
        <label for="reference-json">Import calculated chart JSON</label>
        <input id="reference-json" type="file" accept=".json,application/json" [disabled]="busy" (change)="importReference($event)">
        <p class="muted" data-testid="reference-status">{{referenceLabel}}</p>
        <button *ngIf="referenceTheme" (click)="clearReference()" [disabled]="busy">Use synthetic fixture instead</button>
        <div class="buttons"><button (click)="zoom(-1)" [disabled]="busy" aria-label="Zoom out">−</button>
          <button (click)="zoom(1)" [disabled]="busy" aria-label="Zoom in">+</button>
          <button class="primary" (click)="exportPng()" [disabled]="busy">Export PNG</button></div>
        <h2>Asset diagnostics</h2>
        <p class="muted">The included local server validates its manifest before serving assets. Placeholders are not the original artwork.</p>
        <label for="base">Asset base URL</label>
        <input id="base" [value]="assetBase" (change)="changeBase($event)" [disabled]="busy">
        <p class="muted">Manifest: {{manifestLabel}}</p>
        <p class="status" [class.error]="error" role="status" data-testid="status">{{error || status}}</p>
      </aside>
      <section class="stage" aria-label="Chart canvas">
        <div class="skin-picker" aria-label="Selettore skin del grafico">
          <div class="skin-picker-heading">
            <div><p class="skin-picker-kicker">CONFRONTO VISIVO</p><h2>Scegli la skin</h2></div>
            <div class="skin-select-field">
              <label for="skin">Stile attivo</label>
              <select id="skin" [value]="skin" [disabled]="busy" (change)="changeSkin($event)" aria-label="Skin del grafico">
                <option *ngFor="let item of skinChoices" [value]="item.id">{{item.label}}</option>
              </select>
            </div>
          </div>
          <div class="skin-choices" role="group" aria-label="Selezione rapida della skin">
            <button *ngFor="let item of skinChoices" type="button" class="skin-choice"
              [class.selected]="skin === item.id" [attr.aria-pressed]="skin === item.id"
              [disabled]="busy" [attr.data-skin]="item.id" data-testid="skin-option"
              (click)="chooseSkin(item.id)">
              <span class="skin-swatch" [style.background-color]="item.background" aria-hidden="true">
                <span [style.background-color]="item.accent"></span>
              </span>
              <span>{{item.label}}</span>
            </button>
          </div>
          <p class="skin-picker-hint">Stesse posizioni e aspetti, cambia solo l'aspetto grafico.</p>
        </div>
        <canvas #canvas data-testid="chart"></canvas>
      </section>
    </section>
    <footer>Fixture positions are illustrative; they are not astronomical calculations. Synthetic assets do not establish visual fidelity.</footer>
  </main>`
})
class DemoComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvas', { static: true }) canvas!: ElementRef<HTMLCanvasElement>;
  private readonly renderer = new GraficoRenderService();
  private readonly changes = inject(ChangeDetectorRef);
  readonly skinChoices = Object.entries(SkinManager.skins).map(([id, config]) => ({
    id,
    label: ({
      virgostars: 'VirgoStars', dark: 'Scura', 'dark-bn': 'Scura B/N',
      light: 'Chiara', 'light-bn': 'Chiara B/N', sun: 'Sole',
      astrolabio: 'Astrolabio', 'astrolabio-girasole': 'Girasole',
    } as Record<string, string>)[id] ?? id,
    background: config.bgColor,
    accent: config.elementi[3],
  }));
  mode: Mode = 'natal';
  skin = 'virgostars';
  showDegrees = true;
  readonly axisSettings = [
    {key: 'mostraFrecciaAscendente', label: 'ASC · orange arrow'},
    {key: 'mostraRetroFrecciaDiscendente', label: 'DS · green tail'},
    {key: 'mostraFrecciaMC', label: 'MC · violet arrow'},
    {key: 'mostraRetroFrecciaIC', label: 'IC · lavender tail'},
    {key: 'mostraGradiAssi', label: 'ASC & MC · degrees / minutes'},
    {key: 'mostraNomiAssi', label: 'ASC / DS / MC / IC names'},
    {key: 'mostraOraPlanetariaAscendente', label: 'Planetary hour by ASC'},
    {key: 'mostraDirezioneMotoMC', label: 'MC movement indicator'},
  ];
  axisOptions: Record<string, boolean> = Object.fromEntries(this.axisSettings.map(item => [item.key, true]));
  houseSize = 1.25;
  dense = false;
  busy = false;
  status = 'Preparing renderer…';
  error = '';
  assetBase = new URLSearchParams(location.search).get('assets') || 'http://127.0.0.1:4177/assets/';
  manifestLabel = new URLSearchParams(location.search).get('manifest') || 'local server manifest (see server console)';
  referenceLabel = 'Synthetic fixture active. A date alone cannot provide astronomical positions.';
  referenceTheme: any = null;
  private readonly referenceKey = 'astrological-charts-demo-reference-theme-v1';
  private readonly radix = makeDemoTheme(0);
  private readonly transit = makeDemoTheme(24);
  private readonly synastry = makeDemoTheme(71);

  ngAfterViewInit(): void {
    try {
      this.restoreReference();
      GestoreImmagini.configurePublicAssetsBase(this.assetBase);
      this.renderer.inizializzaGraficoRender(this.canvas, {x: 800, y: 800});
      void this.draw();
    } catch (error) { this.showError(error); }
  }
  ngOnDestroy(): void { this.renderer.ngOnDestroy(); }
  changeMode(event: Event): void { this.mode = (event.target as HTMLSelectElement).value as Mode; void this.draw(); }
  changeSkin(event: Event): void { this.chooseSkin((event.target as HTMLSelectElement).value); }
  chooseSkin(id: string): void {
    if (this.busy || !this.skinChoices.some(item => item.id === id) || this.skin === id) return;
    this.skin = id;
    void this.draw();
  }
  changeDegrees(event: Event): void { this.showDegrees = (event.target as HTMLInputElement).checked; void this.draw(); }
  changeAxisOption(key: string, event: Event): void { this.axisOptions[key] = (event.target as HTMLInputElement).checked; void this.draw(); }
  changeHouseSize(event: Event): void { this.houseSize = Number((event.target as HTMLInputElement).value); void this.draw(); }
  changeDense(event: Event): void { this.dense = (event.target as HTMLInputElement).checked; void this.draw(); }
  private restoreReference(): void {
    try {
      const saved = localStorage.getItem(this.referenceKey);
      if (!saved) return;
      const theme = JSON.parse(saved);
      this.validateReference(theme);
      this.referenceTheme = theme;
      this.referenceLabel = `Local reference active (${theme.dataora ?? 'calculated theme'}).`;
    } catch {
      this.referenceLabel = 'Unable to restore the local reference. Import the calculated JSON again.';
    }
  }
  private validateReference(theme: any): void {
    if (!theme || typeof theme !== 'object' || !theme.planets ||
      !Object.keys(theme.planets).length || !theme.houses || !Object.keys(theme.houses).length) {
      throw new Error('Expected a VirgoStars TemaRender containing planets and houses.');
    }
  }
  async importReference(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    try {
      if (file.size > 2_000_000) throw new Error('Reference chart JSON must be below 2 MB.');
      const parsed = JSON.parse(await file.text());
      const theme = parsed?.temaRender ?? parsed?.theme ?? parsed;
      this.validateReference(theme);
      localStorage.setItem(this.referenceKey, JSON.stringify(theme));
      this.referenceTheme = theme;
      this.dense = false;
      this.referenceLabel = `Local reference active (${theme.dataora ?? 'calculated theme'}). Reloading the page keeps it selected.`;
      void this.draw();
    } catch (error) {
      this.showError(error);
    } finally { input.value = ''; this.changes.markForCheck(); }
  }
  clearReference(): void {
    localStorage.removeItem(this.referenceKey);
    this.referenceTheme = null;
    this.referenceLabel = 'Synthetic fixture active. A date alone cannot provide astronomical positions.';
    void this.draw();
  }
  changeBase(event: Event): void {
    try { this.assetBase = (event.target as HTMLInputElement).value; GestoreImmagini.configurePublicAssetsBase(this.assetBase); void this.draw(); }
    catch (error) { this.showError(error); }
  }
  zoom(direction: number): void { direction > 0 ? this.renderer.zoomIn(0.15) : this.renderer.zoomOut(0.15); }
  private radixTheme(): any { return this.dense ? makeDenseDemoTheme(0) : this.referenceTheme ?? this.radix; }
  private options(): any {
    const opts = structuredClone(defaultOpzioniGrafico) as any;
    opts.settaggi.skin_id = this.skin;
    opts.temaGrafico = this.skin;
    opts.mostraTransiti = this.mode === 'transits';
    opts.mostraSinastria = this.mode === 'synastry';
    opts.mostraGradiElementiCelesti = this.showDegrees;
    Object.assign(opts, this.axisOptions);
    opts.dimensioneNumeriCase = this.houseSize;
    for (const body of demoBodies) { opts.settaggi.elementi_celesti[body].att = true; opts.settaggi.elementi_celesti[body].aspVerso = true; }
    return opts;
  }
  async draw(): Promise<void> {
    this.busy = true; this.error = ''; this.status = 'Rendering…'; this.changes.markForCheck();
    try {
      await this.renderer.disegnaScena(this.radixTheme(), this.mode === 'transits' ? this.transit : null,
        this.mode === 'synastry' ? this.synastry : null, this.mode === 'latitude' ? 'latitudini' : 'carta-astrale', this.options());
      this.status = 'Rendered with the configured asset server.';
    } catch (error) { this.showError(error); }
    finally { this.busy = false; this.changes.markForCheck(); }
  }
  async exportPng(): Promise<void> {
    this.busy = true; this.error = ''; this.status = 'Exporting…'; this.changes.markForCheck();
    try {
      const png = await this.renderer.generaImmagine(this.radixTheme(), this.mode === 'transits' ? this.transit : null,
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
