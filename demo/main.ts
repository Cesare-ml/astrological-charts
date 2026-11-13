import { CommonModule } from '@angular/common';
import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, OnDestroy, ViewChild, inject, provideZonelessChangeDetection } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { defaultOpzioniGrafico, GestoreImmagini, GraficoRenderService, SkinManager } from '../src/public-api';
import { demoBodies, makeDemoTheme } from './fixtures';

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
        <label class="astro-preview" for="astro-preview">
          <input id="astro-preview" type="checkbox" [checked]="astroPreviewEnabled"
            (change)="toggleAstroPreview($event)" [disabled]="busy">
          Preview VirgoStars Astro glyph images
        </label>
        <p class="muted">Requires the 22 owner-approved private white-alpha masks
          staged by the asset host. Disabled by default; older glyphs remain the fallback.</p>
        <p class="status" [class.error]="error || previewNotice" role="status" data-testid="status" [attr.data-render-revision]="renderRevision">{{error || previewNotice || status}}</p>
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
  mode: Mode = 'natal';
  skin = 'light';
  busy = false;
  status = 'Preparing renderer…';
  /** Increases only after a successful draw; browser QA must await each revision. */
  renderRevision = 0;
  /** Prevent an obsolete asynchronous draw from claiming the latest frame. */
  private drawRequest = 0;
  error = '';
  /** Explicit notice after restoring legacy glyphs from a failed private preview. */
  previewNotice = '';
  assetBase = new URLSearchParams(location.search).get('assets') || 'http://127.0.0.1:4177/assets/';
  manifestLabel = new URLSearchParams(location.search).get('manifest') || 'local server manifest (see server console)';
  astroPreviewEnabled = new URLSearchParams(location.search).get('astroGlyphs') === '1';
  private readonly radix = makeDemoTheme(0);
  private readonly transit = makeDemoTheme(24);
  private readonly synastry = makeDemoTheme(71);

  ngAfterViewInit(): void {
    try {
      GestoreImmagini.configurePublicAssetsBase(this.assetBase);
      GestoreImmagini.configureVirgoStarsAstroPreview(this.astroPreviewEnabled);
      this.renderer.inizializzaGraficoRender(this.canvas, {x: 800, y: 800});
      void this.drawWithPreviewRecovery();
    } catch (error) { this.showError(error); }
  }
  ngOnDestroy(): void { this.renderer.ngOnDestroy(); }
  changeMode(event: Event): void { this.mode = (event.target as HTMLSelectElement).value as Mode; void this.drawWithPreviewRecovery(); }
  changeSkin(event: Event): void { this.skin = (event.target as HTMLSelectElement).value; void this.drawWithPreviewRecovery(); }
  changeBase(event: Event): void {
    try { this.assetBase = (event.target as HTMLInputElement).value; GestoreImmagini.configurePublicAssetsBase(this.assetBase); void this.drawWithPreviewRecovery(); }
    catch (error) { this.showError(error); }
  }
  toggleAstroPreview(event: Event): void {
    this.astroPreviewEnabled = (event.target as HTMLInputElement).checked;
    GestoreImmagini.configureVirgoStarsAstroPreview(this.astroPreviewEnabled);
    void this.drawWithPreviewRecovery();
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
    const request = ++this.drawRequest;
    this.busy = true; this.error = ''; this.previewNotice = '';
    this.status = 'Rendering…'; this.changes.markForCheck();
    try {
      await this.renderer.disegnaScena(this.radix, this.mode === 'transits' ? this.transit : null,
        this.mode === 'synastry' ? this.synastry : null, this.mode === 'latitude' ? 'latitudini' : 'carta-astrale', this.options());
      // The renderer can cancel older queued draws without throwing. Never
      // count those as completed; otherwise Playwright sees a false revision.
      if (request !== this.drawRequest) return;
      this.renderRevision += 1;
      this.status = 'Rendered with the configured asset server.';
    } catch (error) {
      if (request === this.drawRequest) this.showError(error);
    } finally {
      // An old request must not unlock controls while the latest one is busy.
      if (request === this.drawRequest) {
        this.busy = false;
        this.changes.markForCheck();
      }
    }
  }
  /**
   * A missing or invalid private mask should never strand the preview toggle
   * in its ON state. Recover only when the error names an Astro mask, not when
   * unrelated approved assets or the renderer fail.
   */
  private async drawWithPreviewRecovery(): Promise<void> {
    const request = this.drawRequest + 1;
    await this.draw();
    if (request !== this.drawRequest || !this.astroPreviewEnabled ||
        !this.error.includes('virgostars-astro/masks/')) return;

    this.astroPreviewEnabled = false;
    GestoreImmagini.configureVirgoStarsAstroPreview(false);
    const fallbackRequest = this.drawRequest + 1;
    const previousRenderRevision = this.renderRevision;
    await this.draw();
    // A newer request can supersede/cancel this fallback without throwing.
    // Claim restoration only if THIS fallback rendered successfully.
    if (fallbackRequest !== this.drawRequest || this.astroPreviewEnabled ||
        this.error || this.renderRevision <= previousRenderRevision) return;
    this.previewNotice = 'VirgoStars Astro masks were unavailable; the original symbols have been restored.';
    this.changes.markForCheck();
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
