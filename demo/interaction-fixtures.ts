import type { ChartAspectRelation } from '../src/public-api';

/**
 * Hand-authored, illustrative chart interactions matching the synthetic
 * longitudes in demo/fixtures.ts. These are NOT real ephemerides or an
 * aspect calculation algorithm. Production hosts provide their own links.
 */
export const demoCrossChartAspects: readonly ChartAspectRelation[] = [
  { from: { layer: 'transit', name: 'Saturn' }, to: { layer: 'natal', name: 'Uranus' }, type: 'congiunzione', orb: 1 },
  { from: { layer: 'transit', name: 'Saturn' }, to: { layer: 'natal', name: 'Venus' }, type: 'opposizione', orb: 4 },
  { from: { layer: 'transit', name: 'Sun' }, to: { layer: 'natal', name: 'Mercury' }, type: 'congiunzione', orb: 3 },
  { from: { layer: 'transit', name: 'Sun' }, to: { layer: 'natal', name: 'Uranus' }, type: 'trigono', orb: 1 },
  { from: { layer: 'transit', name: 'Neptune' }, to: { layer: 'natal', name: 'Pluto' }, type: 'congiunzione', orb: 6 },
  { from: { layer: 'transit', name: 'Mercury' }, to: { layer: 'natal', name: 'Pluto' }, type: 'quadrato', orb: 2 },
  { from: { layer: 'transit', name: 'Mars' }, to: { layer: 'natal', name: 'Neptune' }, type: 'quinconce', orb: 1 },
  { from: { layer: 'transit', name: 'Venus' }, to: { layer: 'natal', name: 'Mars' }, type: 'congiunzione', orb: 8 },
  { from: { layer: 'transit', name: 'Jupiter' }, to: { layer: 'natal', name: 'Mercury' }, type: 'opposizione', orb: 3 },
  { from: { layer: 'transit', name: 'Moon' }, to: { layer: 'natal', name: 'Venus' }, type: 'congiunzione', orb: 4 },
];
