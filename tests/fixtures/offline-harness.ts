import '@angular/compiler';
import { defaultOpzioniGrafico, GestoreImmagini, GraficoRenderService } from '../../src/public-api';
import { demoBodies, makeDemoTheme } from '../../demo/fixtures';

(globalThis as any).runOfflineCharts = async (assetBase: string) => {
  GestoreImmagini.configurePublicAssetsBase(assetBase);
  const radix = makeDemoTheme(0), transits = makeDemoTheme(24), synastry = makeDemoTheme(71);
  const renderer = new GraficoRenderService();
  const output: string[] = [];
  try {
    for (const mode of ['natal', 'transits', 'synastry', 'latitude']) {
      const opts = structuredClone(defaultOpzioniGrafico) as any;
      opts.settaggi.skin_id = 'astrolabio'; opts.temaGrafico = 'astrolabio';
      opts.mostraTransiti = mode === 'transits'; opts.mostraSinastria = mode === 'synastry';
      for (const body of demoBodies) opts.settaggi.elementi_celesti[body].att = true;
      output.push(await renderer.generaImmagine(radix, mode === 'transits' ? transits : null,
        mode === 'synastry' ? synastry : null, mode === 'latitude' ? 'latitudini' : 'carta-astrale', opts, {x:400,y:400}, 1));
    }
    return output;
  } finally { renderer.ngOnDestroy(); }
};
