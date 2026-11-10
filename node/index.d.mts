/* Astrological Charts Node.js API declarations.
 * Copyright (c) 2026 Cesare-ml (VirgoStars project).
 * CPAL-1.0 with Exhibits A/B; see ../LICENSE.
 *
 * These types describe precomputed inputs. No astronomical calculations
 * take place in this package. Developer preview: not yet a stable release.
 */
export type ChartMode = 'natal' | 'transits' | 'synastry' | 'latitude';

export interface PlanetCoordinates {
  /** Ecliptic longitude in decimal degrees. Required; finite. */
  longitude: number;
  /** Ecliptic latitude in degrees (-90 to +90); default is 0. */
  latitude?: number;
  /** Degrees per day, if computed by the caller; default is 0. */
  longitudeSpeed?: number;
  /** Degrees per day, if computed by the caller; default is 0. */
  latitudeSpeed?: number;
  /** Equatorial declination in degrees (-90 to +90); default is 0. */
  declination?: number;
}

export interface ChartCoordinates {
  /** Application-supplied ISO-style date/time label, not calculated here. */
  datetime: string;
  ascendant: number;
  midheaven: number;
  /** Exactly twelve finite longitudes (degrees). */
  houseCusps: number[];
  vertex?: number;
  australInversion?: boolean;
  planets: Record<string, PlanetCoordinates>;
}

export interface ChartPayloadV1 {
  schemaVersion: 1;
  natal: ChartCoordinates;
  transits?: ChartCoordinates;
  synastry?: ChartCoordinates;
  mode?: ChartMode;
  /** Must match a skin implemented by the renderer. */
  skin?: string;
}

export interface RenderOptions {
  mode?: ChartMode;
  skin?: string;
  /** Child Node.js render process timeout, 100–600000 ms. Default: 180000. */
  timeoutMs?: number;
}

/** Convert source input/output and CLI options to a validated argument list. */
export function buildRenderArgs(
  input: string, output: string, options?: RenderOptions,
): string[];

/** Render a JSON file through the local Angular/Three.js browser bridge.
 * Returned path is absolute. Does not replace a pre-existing output on failure.
 * Requires npm dependencies, local Chrome/Chromium and WebGL.
 * Not the Astrolabio offline Firefox adapter.
 */
export function renderChartFile(
  input: string, output: string, options?: RenderOptions,
): Promise<string>;

/** Render already-computed planet/house data from Node.js or TypeScript.
 * Returned path is absolute. A complete numeric chart is required.
 */
export function renderChart(
  payload: ChartPayloadV1, output: string, options?: RenderOptions,
): Promise<string>;
