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
  const hadOverride = Object.hasOwn(skin, 'sinastria');
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
    if (hadOverride) skin.sinastria = original;
    else delete skin.sinastria;
    renderer.ngOnDestroy();
  }
};


// Exercise a real rejected export, then assert the shared skin and loader are
// restored before rendering a fresh image. No external assets or server calls
// are intentionally failed: the loader rejects the first synthetic image.
(globalThis as any).probeSynastryFailureCleanup = async () => {
  GestoreImmagini.configurePublicAssetsBase('http://127.0.0.1:4177/assets/');
  const opts = structuredClone(defaultOpzioniGrafico) as any;
  opts.settaggi.skin_id = 'light';
  opts.temaGrafico = 'light';
  opts.mostraSinastria = true;
  for (const body of demoBodies) opts.settaggi.elementi_celesti[body].att = true;
  const skin = (SkinManager.skins as any).light.anelloCase;
  const hadOverride = Object.hasOwn(skin, 'sinastria');
  const originalOverride = skin.sinastria;
  const originalLoad = GestoreImmagini.loadAsync;
  const natal = makeDemoTheme(0);
  const partner = makeDemoTheme(71);
  const failedRenderer = new GraficoRenderService();
  let failure = '';
  try {
    skin.sinastria = { coloreLinea: '#d00076' };
    GestoreImmagini.loadAsync = async () => {
      throw new Error('Injected failure: synthetic synastry asset load');
    };
    try {
      await failedRenderer.generaImmagine(
        natal, null, partner, 'carta-astrale', opts, {x: 400, y: 400}, 1,
      );
    } catch (error) {
      failure = error instanceof Error ? error.message : String(error);
    }
  } finally {
    GestoreImmagini.loadAsync = originalLoad;
    if (hadOverride) skin.sinastria = originalOverride;
    else delete skin.sinastria;
    failedRenderer.ngOnDestroy();
  }

  const skinRestored = Object.hasOwn(skin, 'sinastria') === hadOverride
    && skin.sinastria === originalOverride;
  const loaderRestored = GestoreImmagini.loadAsync === originalLoad;
  const recoveredRenderer = new GraficoRenderService();
  try {
    const png = await recoveredRenderer.generaImmagine(
      natal, null, partner, 'carta-astrale', opts, {x: 400, y: 400}, 1,
    );
    return { failure, skinRestored, loaderRestored, recoveryIsPng: png.startsWith('data:image/png;base64,') };
  } finally {
    recoveredRenderer.ngOnDestroy();
  }
};
