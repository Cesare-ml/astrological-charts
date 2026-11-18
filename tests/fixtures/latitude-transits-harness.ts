import '@angular/compiler';
import { defaultOpzioniGrafico, GestoreImmagini, GraficoRenderService } from '../../src/public-api';
import { demoBodies, makeDemoTheme } from '../../demo/fixtures';

(globalThis as any).renderLatitudeTransits = async (skin: string, missingSelectedHouses = false) => {
  GestoreImmagini.configurePublicAssetsBase('http://127.0.0.1:4177/assets/');
  const opts = structuredClone(defaultOpzioniGrafico) as any;
  opts.settaggi.skin_id = skin;
  opts.temaGrafico = skin;
  opts.mostraTransiti = true;
  for (const body of [...demoBodies, 'true Node']) opts.settaggi.elementi_celesti[body].att = true;
  const natal = makeDemoTheme(0) as any, transits = makeDemoTheme(24) as any;
  if (missingSelectedHouses) {
    // Deliberately supply real-looking house data for a different system.
    // The requested 'egizia' system is absent, so the latitude renderer
    // must keep planets/signs and omit only the house ring.
    opts.settaggi.domificazione_selezionata = 'egizia';
    natal.houses = {placido: natal.houses.egizia};
    transits.houses = {placido: transits.houses.egizia};
  }
  // Synthetic node values exercise the on-disk "true node.png" spelling.
  natal.planets['true Node'] = {...natal.planets.Sun, latitude: 1.3};
  transits.planets['true Node'] = {...transits.planets.Sun, latitude: -1.3};
  const renderer = new GraficoRenderService();
  try { return await renderer.generaImmagine(natal, transits, null, 'latitudini', opts, {x:400,y:400}, 1); }
  finally { renderer.ngOnDestroy(); }
};
