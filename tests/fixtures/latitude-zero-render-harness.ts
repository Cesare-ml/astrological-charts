import '@angular/compiler';
import { defaultOpzioniGrafico, GestoreImmagini, GraficoRenderService } from '../../src/public-api';
import { demoBodies, makeDemoTheme } from '../../demo/fixtures';

// Run the actual Three.js latitude PNG pipeline, not a reimplementation of its filter.
// The asset server must already be serving the locally generated SHA-256-verified demo pack.
(globalThis as any).runZeroLatitudeRenderProbe = async () => {
  GestoreImmagini.configurePublicAssetsBase('http://127.0.0.1:4177/assets/');
  const theme = makeDemoTheme(0);
  theme.planets.Sun.latitude = 0;
  const opts = structuredClone(defaultOpzioniGrafico) as any;
  opts.settaggi.skin_id = 'light';
  opts.temaGrafico = 'light';
  for (const body of demoBodies) {
    opts.settaggi.elementi_celesti[body].att = body === 'Sun';
  }
  const renderer = new GraficoRenderService();
  const render = () => renderer.generaImmagine(
    theme, null, null, 'latitudini', opts, {x: 400, y: 400}, 1);
  try {
    const withSun = await render();
    opts.settaggi.elementi_celesti.Sun.att = false;
    const withoutSun = await render();
    // Control: the identical body at a different valid latitude must move
    // rather than being silently omitted by the renderer.
    opts.settaggi.elementi_celesti.Sun.att = true;
    theme.planets.Sun.latitude = -0;
    const negativeZeroSun = await render();
    theme.planets.Sun.latitude = 2;
    const shiftedSun = await render();

    // Keep the natal Sun fixed at +2° and vary only the transit Sun.
    // The same finite-latitude filter is used for natal and transit rings,
    // but their symbol paths and scene branches differ.
    const transitTheme = makeDemoTheme(90);
    transitTheme.planets.Sun.latitude = 0;
    const transitOptions = structuredClone(opts);
    transitOptions.mostraTransiti = true;
    const renderTransit = (transit) => renderer.generaImmagine(
      theme, transit, null, 'latitudini', transitOptions, {x: 400, y: 400}, 1);
    const transitZeroSun = await renderTransit(transitTheme);
    // Keep the transit ring/grid and all options identical: only filter
    // the Sun's invalid latitude. Using a null transit theme as the control
    // also removes its grid and can falsely pass when 0° is still omitted.
    transitTheme.planets.Sun.latitude = Number.NaN;
    const transitFilteredSun = await renderTransit(transitTheme);
    transitTheme.planets.Sun.latitude = 2;
    const transitShiftedSun = await renderTransit(transitTheme);
    return { withSun, withoutSun, negativeZeroSun, shiftedSun,
      transitZeroSun, transitFilteredSun, transitShiftedSun };
  } finally {
    renderer.ngOnDestroy();
  }
};
