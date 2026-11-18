import { TemaRender } from '../src/public-api';

// Illustrative longitudes, not calculated ephemerides and not real birth data.
export const demoBodies = ['Sun','Moon','Mercury','Venus','Mars','Jupiter','Saturn','Uranus','Neptune','Pluto'];
// Reference composition from the approved VirgoStars mockup: Sun 28° Pisces,
// Mercury 29° Pisces, Venus 1° Aries, Mars/Moon 2° Aries. The ten bodies,
// equal houses, ASC 20° Aries and MC 20° Capricorn are illustrative input,
// NOT calculated ephemerides or a person's natal data.
const longitudes = [358.4, 2.1, 359.2, 1.1, 2.4, 195, 255, 278, 308, 338];
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
  const dayHours = Array.from({length: 12}, (_, i) => ({
    dataora: `2000-01-01 ${String(i + 6).padStart(2, '0')}:00:00`,
    pianeta: ['Saturn', 'Jupiter', 'Mars', 'Sun', 'Venus', 'Mercury', 'Moon'][i % 7],
  }));
  const nightHours = Array.from({length: 12}, (_, i) => ({
    dataora: `2000-01-${i < 6 ? '01' : '02'} ${String((i + 18) % 24).padStart(2, '0')}:00:00`,
    pianeta: ['Venus', 'Mercury', 'Moon', 'Saturn', 'Jupiter', 'Mars', 'Sun'][i % 7],
  }));
  return {
    dataora: '2000-01-01T12:00:00Z', as: ascendant, ds: (ascendant + 180) % 360,
    mc, ic: (mc + 180) % 360, planets,
    houses: { egizia: { ascendant, mc, mcSpeed: 1, vertex: (ascendant + 140) % 360,
      house: Array.from({ length: 12 }, (_, i) => (ascendant + i * 30) % 360) } },
    australInversion: false, fasiSinodiche: {}, fasiSinodicheLatitudinali: {},
    lunazioniErmetiche: {}, astrologiaOraria: {}, orePlanetarie: {
      dataora: '2000-01-01 12:00:00', alba: '2000-01-01 06:00:00',
      tramonto: '2000-01-01 18:00:00', albaSucc: '2000-01-02 06:00:00',
      dh: {diurne: dayHours, notturne: nightHours},
    }, partiArabe: {},
  };
}

/** Synthetic conjunction including a 359°/0° seam; not a user's chart. */
export function makeDenseDemoTheme(offset: number): TemaRender {
  const theme = makeDemoTheme(offset);
  const cluster = [358.5, 359.2, 0.1, 1.4, 2.3, 3.1, 4.2];
  demoBodies.slice(0, cluster.length).forEach((name, i) => {
    theme.planets[name].longitude = (cluster[i] + offset) % 360;
  });
  return theme;
}
