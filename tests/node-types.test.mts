/* Compile-only type contract for the Node.js/TypeScript public entry point.
 * Copyright (c) 2026 Cesare-ml (VirgoStars project); CPAL-1.0.
 */
import { renderChart, renderChartFile, buildRenderArgs, type ChartPayloadV1 }
  from '../node/index.mjs';

const natal = {
  datetime: '2000-01-01T12:00:00Z',
  ascendant: 20, midheaven: 290,
  houseCusps: Array.from({ length:12 }, (_,i)=>i * 30),
  planets: {Sun:{ longitude:15,latitude:0 }},
};
const payload: ChartPayloadV1 = { schemaVersion:1, natal };
const image: Promise<string> = renderChart(payload,'chart.png',
  { mode:'natal', skin:'light', timeoutMs:180000 });
const file: Promise<string> = renderChartFile('chart.json', 'chart.jpg',
  { mode:'transits' });
const cliArgs: string[] = buildRenderArgs('chart.json','out.jpeg',
  { mode:'latitude' });
const externalAssetArgs: string[] = buildRenderArgs('chart.json', 'private.png',
  {assetRoot:'../astrological-assets/public/assets',
    assetManifest:'../astrological-assets/manifests/approved-assets.json'});
// @ts-expect-error assetRoot must be a path string
renderChart(payload, 'out.png', {assetRoot: 42});
void externalAssetArgs;

// @ts-expect-error schemaVersion 2 is not supported
const invalidSchema: ChartPayloadV1 = { schemaVersion:2, natal };
// @ts-expect-error invalid mode must be rejected by TypeScript
renderChart(payload,'out.png', { mode:'imaginary-chart-mode' });
const invalidPlanet: ChartPayloadV1 = { schemaVersion:1,
  natal:{ ...natal, planets:{ Sun:{
    // @ts-expect-error planet longitude must be a number
    longitude:'not degrees',
  } } },
};
void image; void file; void cliArgs; void invalidSchema; void invalidPlanet;
