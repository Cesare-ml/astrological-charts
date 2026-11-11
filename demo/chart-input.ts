/* Astrological Charts — original code Copyright (c) 2026 Cesare-ml (VirgoStars project).
 * CPAL-1.0; see ../LICENSE, including Exhibits A/B. */
import type { TemaRender } from '../src/lib/models/tema-render.model';

export type ChartMode = 'natal' | 'transits' | 'synastry' | 'latitude';

/**
 * Versioned interchange format for precomputed chart data.
 * Python and any other language can produce this JSON without Angular.
 * No planetary/house computations are performed here.
 */
export interface ChartInput {
  datetime: string;
  ascendant: number;
  midheaven: number;
  houseCusps: number[];
  vertex?: number;
  australInversion?: boolean;
  planets: Record<string, {
    longitude: number;
    latitude?: number;
    longitudeSpeed?: number;
    latitudeSpeed?: number;
    declination?: number;
  }>;
}

export interface ChartPayload {
  schemaVersion: 1;
  natal: ChartInput;
  transits?: ChartInput;
  synastry?: ChartInput;
  mode?: ChartMode;
  skin?: string;
}

export interface ParsedChart {
  natal: TemaRender;
  transits: TemaRender | null;
  synastry: TemaRender | null;
  mode: ChartMode;
  skin?: string;
}

function object(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be a JSON object.`);
  }
  return value as Record<string, unknown>;
}

function finite(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${label} must be a finite JSON number.`);
  }
  return value;
}

function optionalFinite(value: unknown, label: string, fallback: number): number {
  return value === undefined ? fallback : finite(value, label);
}

function degrees(value: unknown, label: string): number {
  const n = finite(value, label);
  return ((n % 360) + 360) % 360;
}

function latitude(value: unknown, label: string, fallback: number): number {
  const n = optionalFinite(value, label, fallback);
  if (n < -90 || n > 90) throw new Error(`${label} must be between -90 and 90 degrees.`);
  return n;
}

function parseTheme(raw: unknown, label: string): TemaRender {
  const input = object(raw, label);
  if (typeof input.datetime !== 'string' || !input.datetime.trim()) {
    throw new Error(`${label}.datetime must be a non-empty ISO-style string.`);
  }
  const ascendant = degrees(input.ascendant, `${label}.ascendant`);
  const mc = degrees(input.midheaven, `${label}.midheaven`);
  if (!Array.isArray(input.houseCusps) || input.houseCusps.length !== 12) {
    throw new Error(`${label}.houseCusps must contain exactly 12 degree values.`);
  }
  const house = input.houseCusps.map((v, index) => degrees(v, `${label}.houseCusps[${index}]`));
  const suppliedPlanets = object(input.planets, `${label}.planets`);
  if (Object.keys(suppliedPlanets).length === 0) {
    throw new Error(`${label}.planets must contain at least one computed celestial body.`);
  }
  const planets = Object.fromEntries(Object.entries(suppliedPlanets).map(([name, rawPlanet]) => {
    const planet = object(rawPlanet, `${label}.planets.${name}`);
    if (!name.trim() || name.length > 80) throw new Error('Planet names must be 1–80 characters and not blank.');
    return [name, {
      longitude: degrees(planet.longitude, `${label}.planets.${name}.longitude`),
      latitude: latitude(planet.latitude, `${label}.planets.${name}.latitude`, 0),
      longitudeSpeed: optionalFinite(planet.longitudeSpeed, `${label}.planets.${name}.longitudeSpeed`, 0),
      latitudeSpeed: optionalFinite(planet.latitudeSpeed, `${label}.planets.${name}.latitudeSpeed`, 0),
      equatoriale: { declination: latitude(planet.declination, `${label}.planets.${name}.declination`, 0) },
    }];
  }));
  if (input.australInversion !== undefined && typeof input.australInversion !== 'boolean') {
    throw new Error(`${label}.australInversion must be true or false.`);
  }
  return {
    dataora: input.datetime, as: ascendant, ds: (ascendant + 180) % 360,
    mc, ic: (mc + 180) % 360, planets,
    houses: { egizia: {
      ascendant, mc, vertex: degrees(input.vertex ?? ascendant + 140, `${label}.vertex`), house,
    }},
    australInversion: input.australInversion ?? false,
    fasiSinodiche: {}, fasiSinodicheLatitudinali: {}, lunazioniErmetiche: {},
    astrologiaOraria: {}, orePlanetarie: {}, partiArabe: {},
  } as TemaRender;
}

export function parseChartPayload(value: unknown): ParsedChart {
  const payload = object(value, 'Chart payload');
  if (payload.schemaVersion !== 1) {
    throw new Error('Unsupported schemaVersion. Use schemaVersion: 1.');
  }
  const mode = payload.mode ?? 'natal';
  if (!['natal', 'transits', 'synastry', 'latitude'].includes(mode as string)) {
    throw new Error('mode must be natal, transits, synastry or latitude.');
  }
  if (payload.skin !== undefined && (typeof payload.skin !== 'string' || !payload.skin.trim())) {
    throw new Error('skin must be a non-empty string.');
  }
  const result: ParsedChart = {
    natal: parseTheme(payload.natal, 'natal'),
    transits: payload.transits === undefined ? null : parseTheme(payload.transits, 'transits'),
    synastry: payload.synastry === undefined ? null : parseTheme(payload.synastry, 'synastry'),
    mode: mode as ChartMode,
    skin: payload.skin as string | undefined,
  };
  if (result.mode === 'transits' && result.transits === null) {
    throw new Error('transits data is required for mode: transits.');
  }
  if (result.mode === 'synastry' && result.synastry === null) {
    throw new Error('synastry data is required for mode: synastry.');
  }
  return result;
}
