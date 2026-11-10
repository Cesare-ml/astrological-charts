/* Copyright (c) 2026 Cesare-ml (VirgoStars project).
 * CPAL-1.0; see ../LICENSE and Exhibits A/B.
 *
 * A pre-existing local server is NOT evidence it serves our chart demo
 * or a manifest-matching synthetic asset pack.
 */
import { createHash } from 'node:crypto';

function loopbackUrl(value) {
  const url = new URL(value);
  if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' ||
      !url.port || !Number.isInteger(Number(url.port))) {
    throw new TypeError('Only explicit http://127.0.0.1:<port> endpoints are allowed.');
  }
  return url;
}

/** Check the actual Angular demo document, not a generic 200/404 response. */
export async function matchesLocalChartDemo(baseUrl, request = fetch) {
  const base = loopbackUrl(baseUrl);
  try {
    const response = await request(new URL('/', base), { signal: AbortSignal.timeout(1500) });
    if (response.status !== 200) return false;
    const html = await response.text();
    return html.includes('<title>Astrological Charts demo</title>') &&
      html.includes('<chart-demo>');
  } catch { return false; }
}

/** Verify a few actual HTTP bytes against the already approved local manifest.
 * This is a service identity/transport check, NOT sufficient verification
 * of all rights or files. The local owner server independently verifies
 * every manifest asset with verifyApprovedAssetPack() on startup.
 */
async function matchManifestSamples(baseUrl, manifest, request) {
  const base = loopbackUrl(baseUrl);
  if (manifest?.schemaVersion !== 1 ||
      !Array.isArray(manifest.assets) || manifest.assets.length === 0) {
    throw new TypeError('Expected a nonempty asset manifest (schemaVersion 1).');
  }
  const valid = manifest.assets.every(item =>
    typeof item.path === 'string' &&
    (item.path.startsWith('img/') || item.path.startsWith('fonts/')) &&
    !item.path.split('/').some(part => !part || part === '.' || part === '..' ||
      part.includes('%') || part.includes('\\')) &&
    Number.isSafeInteger(item.bytes) && item.bytes >= 0 &&
    /^[0-9a-f]{64}$/.test(item.sha256));
  if (!valid) throw new TypeError('Manifest contains an unverified/invalid asset entry.');
  const images = manifest.assets.filter(item => item.path.startsWith('img/'));
  if (!images.length) throw new TypeError('Manifest must include image assets.');
  const sampled = [...new Map([
    images[0], images[Math.floor(images.length / 2)], images[images.length - 1],
  ].map(item => [item.path, item])).values()];
  try {
    for (const item of sampled) {
      const pathname = '/assets/' + item.path.split('/').map(encodeURIComponent).join('/');
      const response = await request(new URL(pathname, base), {
        signal: AbortSignal.timeout(1500),
      });
      if (response.status !== 200) return false;
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length !== item.bytes ||
          createHash('sha256').update(bytes).digest('hex') !== item.sha256) {
        return false;
      }
    }
    return true;
  } catch { return false; }
}

/** Only accept the generated checkerboard pack in synthetic mode. */
export async function matchesSyntheticAssetServer(baseUrl, manifest, request = fetch) {
  if (manifest?.source?.repository !== 'synthetic-local-fixtures') {
    throw new TypeError('Expected the local generated synthetic asset manifest.');
  }
  if (manifest.assets?.some(item => !item.path?.startsWith('img/'))) {
    throw new TypeError('Expected image-only synthetic manifest.');
  }
  return matchManifestSamples(baseUrl, manifest, request);
}

/** Sample an explicit, separately authorized external pack.
 * The caller MUST run full verifyApprovedAssetPack(root, manifest) and
 * own the asset-server process. Never use this to trust an arbitrary
 * pre-existing server on port 4177.
 */
export async function matchesManifestAssetServer(baseUrl, manifest, request = fetch) {
  if (manifest?.source?.repository === 'synthetic-local-fixtures') {
    throw new TypeError('External asset mode requires a separately approved pack.');
  }
  return matchManifestSamples(baseUrl, manifest, request);
}

/** Verify the mounted Angular controls, not merely the HTML shell.
 * An old Angular server on port 4200 can pass the index.html probe even
 * if its application was built before the JSON import UI existed.
 * Never print imported chart data or full page HTML in diagnostics.
 */
export async function waitForChartControls(page, browserErrors = []) {
  try {
    await page.waitForFunction(() => {
      const file = document.querySelector('#chart-file');
      return file instanceof HTMLInputElement && file.type === 'file' &&
        document.querySelector('#mode') instanceof HTMLSelectElement &&
        document.querySelector('#skin') instanceof HTMLSelectElement &&
        document.querySelector('[data-testid="status"]') !== null &&
        document.querySelector('[data-testid="chart"]') !== null;
    }, null, { timeout: 12000 });
  } catch {
    const probe = await page.evaluate(() => ({
      title: document.title.slice(0, 120),
      hasChartFile: !!document.querySelector('#chart-file'),
      hasMode: !!document.querySelector('#mode'),
      hasSkin: !!document.querySelector('#skin'),
      hasStatus: !!document.querySelector('[data-testid="status"]'),
      hasCanvas: !!document.querySelector('[data-testid="chart"]'),
    })).catch(() => ({ unavailable: true }));
    const details = browserErrors.slice(-3).map(value => value.slice(0, 200));
    throw new Error(
      'Angular chart import controls not found on http://127.0.0.1:4200/. ' +
      'Port 4200 may host a stale or incompatible Angular demo. ' +
      'Open that URL in Chrome and confirm the "Import your computed chart (JSON)" field. ' +
      'If an old server is running, stop only that server and rerun the export. ' +
      'DOM: ' + JSON.stringify(probe) +
      (details.length ? '; browser errors: ' + details.join(' | ') : '')
    );
  }
}

