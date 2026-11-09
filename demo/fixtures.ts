import { TemaRender } from '../src/public-api';

// Illustrative longitudes, not calculated ephemerides and not real birth data.
export const demoBodies = ['Sun','Moon','Mercury','Venus','Mars','Jupiter','Saturn','Uranus','Neptune','Pluto'];
const longitudes = [15, 75, 42, 103, 135, 195, 255, 278, 308, 338];
export function makeDemoTheme(offset: number): TemaRender {
  const ascendant = (20 + offset) % 360;
  const mc = (290 + offset) % 360;
  const planets = Object.fromEntries(demoBodies.map((name, i) => [name, {
    longitude: (longitudes[i] + offset) % 360,
    latitude: (i % 2 ? -1 : 1) * (0.5 + i * 0.28),
    longitudeSpeed: i === 7 ? -0.04 : 0.2,
    latitudeSpeed: i % 2 ? -0.02 : 0.03,
    equatoriale: { declination: -12 + i * 2.4 },
  }]));
  return {
    dataora: '2000-01-01T12:00:00Z', as: ascendant, ds: (ascendant + 180) % 360,
    mc, ic: (mc + 180) % 360, planets,
    houses: { egizia: { ascendant, mc, vertex: (ascendant + 140) % 360,
      house: Array.from({ length: 12 }, (_, i) => (ascendant + i * 30) % 360) } },
    australInversion: false, fasiSinodiche: {}, fasiSinodicheLatitudinali: {},
    lunazioniErmetiche: {}, astrologiaOraria: {}, orePlanetarie: {}, partiArabe: {},
  };
}
