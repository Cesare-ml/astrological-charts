import { TemaRender } from '../src/public-api';

// Illustrative longitudes, not calculated ephemerides and not real birth data.
export const demoBodies = ['Sun','Moon','Mercury','Venus','Mars','Jupiter','Saturn','Uranus','Neptune','Pluto'];
const longitudes = [15, 75, 42, 103, 135, 195, 255, 278, 308, 338];
// JavaScript remainder is negative for negative operands: keep every angle
// within the renderer's canonical [0, 360) range for any finite offset.
const longitude360 = (value: number): number => ((value % 360) + 360) % 360;

export function makeDemoTheme(offset: number): TemaRender {
  if (!Number.isFinite(offset)) {
    throw new TypeError('Demo chart offset must be a finite number');
  }
  const ascendant = longitude360(20 + offset);
  const mc = longitude360(290 + offset);
  const planets = Object.fromEntries(demoBodies.map((name, i) => [name, {
    longitude: longitude360(longitudes[i] + offset),
    latitude: (i % 2 ? -1 : 1) * (0.5 + i * 0.28),
    longitudeSpeed: i === 7 ? -0.04 : 0.2,
    latitudeSpeed: i % 2 ? -0.02 : 0.03,
    equatoriale: { declination: -12 + i * 2.4 },
  }]));
  return {
    dataora: '2000-01-01T12:00:00Z', as: ascendant, ds: longitude360(ascendant + 180),
    mc, ic: longitude360(mc + 180), planets,
    houses: { egizia: { ascendant, mc, vertex: longitude360(ascendant + 140),
      house: Array.from({ length: 12 }, (_, i) => longitude360(ascendant + i * 30)) } },
    australInversion: false, fasiSinodiche: {}, fasiSinodicheLatitudinali: {},
    lunazioniErmetiche: {}, astrologiaOraria: {}, orePlanetarie: {}, partiArabe: {},
  };
}
