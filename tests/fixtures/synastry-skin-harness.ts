import '@angular/compiler';
import { defaultOpzioniGrafico, GestoreImmagini, GraficoRenderService, SkinManager } from '../../src/public-api';
import { demoBodies, makeDemoTheme } from '../../demo/fixtures';

// Browser-only synthetic fixture: vary just the inner house-ring style while
// keeping themes, positions, images and all other chart options unchanged.
(globalThis as any).probePartialSynastrySkin = async () => {
  GestoreImmagini.configurePublicAssetsBase('http://127.0.0.1:4177/assets/');
  const options = structuredClone(defaultOpzioniGrafico) as any;
  options.settaggi.skin_id = 'light';
  options.temaGrafico = 'light';
  options.mostraSinastria = true;
  for (const body of demoBodies) options.settaggi.elementi_celesti[body].att = true;

  const natal = makeDemoTheme(0);
  const partner = makeDemoTheme(71);
  const skin = (SkinManager.skins as any).light.anelloCase;
  const original = skin.sinastria;
  const renderer = new GraficoRenderService();
  const render = () => renderer.generaImmagine(
    natal, null, partner, 'carta-astrale', options, { x: 500, y: 500 }, 1,
  );

  try {
    delete skin.sinastria;
    const baseline = await render();

    // Only the inner house-line color is overridden; glyphs and textures
    // must inherit the normal light-skin defaults.
    skin.sinastria = { coloreLinea: '#d00076' };
    const partial = await render();

    // This explicit equivalent should draw the same pixels as the partial
    // override, proving that its missing fields fall back in real rendering.
    skin.sinastria = {
      coloreLinea: '#d00076',
      coloreSimboli: skin.coloreSimboli,
      texture: skin.texture,
      coloreTexture: skin.coloreTexture ?? 'white',
    };
    const explicit = await render();

    return { baseline, partial, explicit };
  } finally {
    if (original === undefined) delete skin.sinastria;
    else skin.sinastria = original;
    renderer.ngOnDestroy();
  }
};
