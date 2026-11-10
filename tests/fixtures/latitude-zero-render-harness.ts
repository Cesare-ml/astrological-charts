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
    return { withSun, withoutSun, negativeZeroSun, shiftedSun };
  } finally {
    renderer.ngOnDestroy();
  }
};
