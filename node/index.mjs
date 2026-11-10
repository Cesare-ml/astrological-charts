/**
 * Copyright (c) 2026 Cesare-ml (VirgoStars project).
 * CPAL-1.0; see ../LICENSE and Exhibits A/B.
 *
 * Node.js interface for charts precomputed by another program.
 * This programmatic Node.js adapter invokes the SAME browser/Three.js renderer as the
 * Angular demo. It does not implement astronomy or a native Node WebGL engine.
 * Currently intended for standalone/local use, not a production server.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, mkdir, open, rename, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, extname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateChartPayloadV1, MAX_CHART_JSON_BYTES } from '../scripts/validate-chart-input.mjs';

const execFileAsync = promisify(execFile);
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const defaultRunner = join(projectRoot, 'scripts', 'render-chart.mjs');

/**
 * Single-process developer queue: every render uses the same local
 * Angular/asset server ports and a Chromium session. Never start
 * overlapping export subprocesses from this imported Node module.
 *
 * A failed job must NOT poison the queue. This only serializes calls
 * inside one Node.js process, not different processes or direct CLI
 * invocations; it is NOT a production browser pool or distributed lock.
 */
let pendingRender = Promise.resolve();
function runSerially(task) {
  const job = pendingRender.then(task);
  pendingRender = job.then(() => undefined, () => undefined);
  return job;
}

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
async function verifyImage(path, extension) {
  let details;
  try { details = await stat(path); }
  catch { throw new Error('The chart renderer finished without creating an image file.'); }
  if (!details.isFile() || details.size < 32) {
    throw new Error('The chart renderer created an empty or incomplete image.');
  }
  const handle = await open(path, 'r');
  const signature = Buffer.alloc(8);
  try {
    const { bytesRead } = await handle.read(signature, 0, signature.length, 0);
    if (bytesRead !== signature.length) throw new Error('The chart image is truncated.');
    const png = signature.equals(Buffer.from('89504e470d0a1a0a', 'hex'));
    const jpeg = signature[0] === 0xff && signature[1] === 0xd8 && signature[2] === 0xff;
    if (extension === '.png' ? !png : !jpeg) {
      throw new Error('The chart renderer did not produce the requested PNG/JPEG format.');
    }
  } finally {
    await handle.close();
  }
}

export async function renderChartFile(input, output, options = {}) {
  buildRenderArgs(input, output, options);
  if (resolve(input) === resolve(output)) {
    throw new TypeError('Input JSON and output image must use different file paths.');
  }
  const target = resolve(output);
  const ext = extname(target).toLowerCase();
  const timeoutMs = options.timeoutMs ?? 180_000;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 600_000) {
    throw new TypeError('timeoutMs must be an integer from 100 to 600000 milliseconds.');
  }
  return runSerially(async () => {
    // Stage next to the final image; a failed process cannot overwrite
    // the user's existing chart or claim success without creating a file.
    await mkdir(dirname(target), { recursive: true });
    const stageDir = await mkdtemp(join(dirname(target), '.virgostars-chart-'));
    const stageFile = join(stageDir, 'rendered' + ext);
    const script = options.rendererScript ?? defaultRunner;
    try {
      const args = buildRenderArgs(input, stageFile, options);
      const { stdout, stderr } = await execFileAsync(process.execPath, [script, ...args], {
        cwd: projectRoot,
        windowsHide: true,
        timeout: timeoutMs,
        maxBuffer: 8 * 1024 * 1024,
      });
      if (stdout) process.stdout.write(stdout);
      if (stderr) process.stderr.write(stderr);
      // Validate basic file format; the actual Chromium CLI validates image
      // metadata with sharp before returning.
      await verifyImage(stageFile, ext);
      await rename(stageFile, target);
      return target;
    } finally {
      await rm(stageDir, { recursive: true, force: true });
    }
  });
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
  // Validate all chart inputs before creating an input file or launching Chrome.
  validateChartPayloadV1(payload, options);
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
  if (Buffer.byteLength(serialised, 'utf8') > MAX_CHART_JSON_BYTES) throw new TypeError('Chart JSON exceeds the 1 MB demo limit.');
  const dir = await mkdtemp(join(tmpdir(), 'virgostars-node-chart-'));
  try {
    const inputFile = join(dir, 'chart.json');
    await writeFile(inputFile, serialised, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
    return await renderChartFile(inputFile, output, options);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
