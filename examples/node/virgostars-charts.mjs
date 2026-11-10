/**
 * Copyright (c) 2026 Cesare-ml (VirgoStars project).
 * CPAL-1.0; see ../../LICENSE and Exhibits A/B.
 *
 * Node.js interface for charts precomputed by another program.
 * This adapter invokes the SAME browser/Three.js renderer as the
 * Angular demo. It does not implement astronomy or a native Node WebGL engine.
 * Currently intended for standalone/local use, not a production server.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, extname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const defaultRunner = join(projectRoot, 'scripts', 'render-chart.mjs');

export function buildRenderArgs(input, output, { mode, skin } = {}) {
  if (typeof input !== 'string' || !input) throw new TypeError('A JSON input path is required.');
  if (typeof output !== 'string' || !output) throw new TypeError('A PNG/JPEG output path is required.');
  if (!['.png', '.jpg', '.jpeg'].includes(extname(output).toLowerCase())) {
    throw new TypeError('Output must end with .png, .jpg or .jpeg.');
  }
  if (mode !== undefined && !['natal', 'transits', 'synastry', 'latitude'].includes(mode)) {
    throw new TypeError('Invalid mode: choose natal, transits, synastry or latitude.');
  }
  if (skin !== undefined && (typeof skin !== 'string' || !skin.trim())) {
    throw new TypeError('skin must be a non-empty string.');
  }
  return ['--input', resolve(input), '--output', resolve(output),
    ...(mode === undefined ? [] : ['--mode', mode]),
    ...(skin === undefined ? [] : ['--skin', skin])];
}

/**
 * Render an existing JSON file using the local Angular/Three.js demo.
 *
 * Requires `npm ci`, Chrome/Chromium and WebGL. The renderer will start
 * temporary loopback services if not already running. This is not the
 * Astrolabio Firefox/file:// adapter; see docs/NODE_INTEGRATION.md.
 *
 * The internal `rendererScript` override is for isolated offline tests.
 * Do not pass arbitrary scripts or untrusted option objects.
 */
export async function renderChartFile(input, output, options = {}) {
  const args = buildRenderArgs(String(input), String(output), options);
  const script = options.rendererScript ?? defaultRunner;
  const { stdout, stderr } = await execFileAsync(process.execPath, [script, ...args], {
    cwd: projectRoot,
    windowsHide: true,
    maxBuffer: 8 * 1024 * 1024,
  });
  if (stdout) process.stdout.write(stdout);
  if (stderr) process.stderr.write(stderr);
  return resolve(String(output));
}

/**
 * Render a versioned JSON-v1 payload directly from a Node.js object.
 *
 * Astronomical positions and 12 house cusps must already be computed.
 * This function does not calculate or invent them.
 *
 * @example
 *   await renderChart({ schemaVersion: 1, natal: computedChart }, 'chart.png');
 */
export async function renderChart(payload, output, options = {}) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload) || payload.schemaVersion !== 1) {
    throw new TypeError('Expected a chart object with schemaVersion: 1.');
  }
  if (typeof output !== 'string' || !output) throw new TypeError('Output filename is required.');
  // Validate options before creating a temporary file.
  buildRenderArgs('chart.json', output, options);
  const serialised = JSON.stringify(payload, (_key, value) => {
    if (typeof value === 'number' && !Number.isFinite(value)) {
      throw new TypeError('Chart contains NaN or Infinity. All coordinates must be finite.');
    }
    if (typeof value === 'bigint') {
      throw new TypeError('Chart coordinates must be ordinary JSON numbers, not BigInt.');
    }
    return value;
  });
  if (serialised.length > 1_000_000) throw new TypeError('Chart JSON exceeds the 1 MB demo limit.');
  const dir = await mkdtemp(join(tmpdir(), 'virgostars-node-chart-'));
  try {
    const inputFile = join(dir, 'chart.json');
    await writeFile(inputFile, serialised, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
    return await renderChartFile(inputFile, output, options);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
