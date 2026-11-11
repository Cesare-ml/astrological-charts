/* Astrological Charts — Copyright (c) 2026 Cesare-ml (VirgoStars project).
 * CPAL-1.0, see ../LICENSE and Exhibits A/B.
 *
 * JSON v1 validation for precomputed charts in CLI/Node/Python bridges.
 * Mirrors the shape/range checks in demo/chart-input.ts. It does not
 * calculate ephemerides, house systems, positions or interpretations.
 * Keep rejection cases synchronized with tests/chart-input.test.mjs.
 */
export const MAX_CHART_JSON_BYTES = 1_000_000;
const MODES = ['natal', 'transits', 'synastry', 'latitude'];

function record(value, label) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be a JSON object.`);
  }
  return value;
}

function finite(value, label) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`${label} must be a finite JSON number.`);
  }
  return value;
}

function optionalFinite(value, label) {
  if (value !== undefined) finite(value, label);
}

function lat(value, label) {
  if (value === undefined) return;
  const n = finite(value, label);
  if (n < -90 || n > 90) throw new TypeError(`${label} must be between -90 and 90 degrees.`);
}

function chart(value, label) {
  const input = record(value, label);
  if (typeof input.datetime !== 'string' || !input.datetime.trim()) {
    throw new TypeError(`${label}.datetime must be a non-empty ISO-style string.`);
  }
  finite(input.ascendant, `${label}.ascendant`);
  finite(input.midheaven, `${label}.midheaven`);
  if (!Array.isArray(input.houseCusps) || input.houseCusps.length !== 12) {
    throw new TypeError(`${label}.houseCusps must contain exactly 12 degree values.`);
  }
  input.houseCusps.forEach((x, i) => finite(x, `${label}.houseCusps[${i}]`));
  const planets = record(input.planets, `${label}.planets`);
  if (Object.keys(planets).length === 0) {
    throw new TypeError(`${label}.planets must contain at least one computed celestial body.`);
  }
  for (const [name, value] of Object.entries(planets)) {
    if (!name.trim() || name.length > 80) throw new TypeError('Planet names must be 1–80 characters and not blank.');
    const p = record(value, `${label}.planets.${name}`);
    finite(p.longitude, `${label}.planets.${name}.longitude`);
    lat(p.latitude, `${label}.planets.${name}.latitude`);
    lat(p.declination, `${label}.planets.${name}.declination`);
    optionalFinite(p.longitudeSpeed, `${label}.planets.${name}.longitudeSpeed`);
    optionalFinite(p.latitudeSpeed, `${label}.planets.${name}.latitudeSpeed`);
  }
  // Match Angular parseTheme error precedence: validate planets before flags/vertex.
  if (input.australInversion !== undefined && typeof input.australInversion !== 'boolean') {
    throw new TypeError(`${label}.australInversion must be true or false.`);
  }
  optionalFinite(input.vertex, `${label}.vertex`);
}

/** Validate precomputed numeric inputs before launching an Angular browser.
 * Does not modify the object (e.g. longitude 360 remains 360 here).
 * The Angular parser performs the same validation and normalizes degrees.
 *
 * @param {unknown} payload - Raw JSON object supplied by Node/Python.
 * @param {{mode?:string,skin?:string}} [options] - Optional CLI override.
 * @returns {object} The original payload, unchanged.
 */
export function validateChartPayloadV1(payload, {mode, skin} = {}) {
  const input = record(payload, 'Chart payload');
  if (input.schemaVersion !== 1) throw new TypeError('Unsupported schemaVersion. Use schemaVersion: 1.');
  const nativeMode = input.mode ?? 'natal';
  if (!MODES.includes(nativeMode)) {
    throw new TypeError('mode must be natal, transits, synastry or latitude.');
  }
  for (const [name, value] of [['skin', input.skin], ['skin override', skin]]) {
    if (value !== undefined && (typeof value !== 'string' || !value.trim())) {
      throw new TypeError(`${name} must be a non-empty string.`);
    }
  }
  if (mode !== undefined && !MODES.includes(mode)) {
    throw new TypeError('Invalid mode: choose natal, transits, synastry or latitude.');
  }
  chart(input.natal, 'natal');
  if (input.transits !== undefined) chart(input.transits, 'transits');
  if (input.synastry !== undefined) chart(input.synastry, 'synastry');
  // First validate the embedded chart mode, just as Angular import does.
  // Then validate any requested CLI override before launching Chromium.
  for (const chosen of new Set([nativeMode, mode].filter(Boolean))) {
    if (chosen === 'transits' && input.transits === undefined) {
      throw new TypeError('transits data is required for mode: transits.');
    }
    if (chosen === 'synastry' && input.synastry === undefined) {
      throw new TypeError('synastry data is required for mode: synastry.');
    }
  }
  return input;
}
