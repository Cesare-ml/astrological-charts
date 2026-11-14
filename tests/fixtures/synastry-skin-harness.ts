import '@angular/compiler';
import { defaultOpzioniGrafico, GestoreImmagini, GraficoRenderService, SkinManager } from '../../src/public-api';
import { demoBodies, makeDemoTheme } from '../../demo/fixtures';

// Browser-only synthetic fixture: vary just one house-ring style field while
// keeping themes, positions and all other chart options unchanged. Run on
// untextured light and textured astrolabio skins with the synthetic asset pack.
(globalThis as any).probePartialSynastrySkin = async (scenario: 'line' | 'texture' = 'line') => {
  if (scenario !== 'line' && scenario !== 'texture') {
    throw new Error('Unsupported synastry skin scenario: ' + scenario);
  }
  GestoreImmagini.configurePublicAssetsBase('http://127.0.0.1:4177/assets/');
  const options = structuredClone(defaultOpzioniGrafico) as any;
  const skinId = scenario === 'texture' ? 'astrolabio' : 'light';
  const property = scenario === 'texture' ? 'coloreTexture' : 'coloreLinea';
  const overrideColor = scenario === 'texture' ? '#2468e8' : '#d00076';
  options.settaggi.skin_id = skinId;
  options.temaGrafico = skinId;
  options.mostraSinastria = true;
  for (const body of demoBodies) options.settaggi.elementi_celesti[body].att = true;

  const natal = makeDemoTheme(0);
  const partner = makeDemoTheme(71);
  const skin = (SkinManager.skins as any)[skinId].anelloCase;
  const original = skin.sinastria;
  const renderer = new GraficoRenderService();
  const render = () => renderer.generaImmagine(
    natal, null, partner, 'carta-astrale', options, { x: 500, y: 500 }, 1,
  );

  try {
    delete skin.sinastria;
    const baseline = await render();

    // The light case changes line color; astrolabio changes the tint of its
    // existing synthetic texture. Every other value inherits base-ring style.
    skin.sinastria = { [property]: overrideColor };
    const partial = await render();

    // The renderer's ?? fallback must match an explicit equivalent for both
    // untextured and textured rings. This also checks asset URL resolution.
    skin.sinastria = {
      coloreLinea: skin.coloreLinea,
      coloreSimboli: skin.coloreSimboli,
      texture: skin.texture,
      coloreTexture: skin.coloreTexture ?? 'white',
      [property]: overrideColor,
    };
    const explicit = await render();

    return { baseline, partial, explicit };
  } finally {
    if (original === undefined) delete skin.sinastria;
    else skin.sinastria = original;
    renderer.ngOnDestroy();
  }
};
