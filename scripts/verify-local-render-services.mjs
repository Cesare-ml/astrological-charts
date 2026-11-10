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

/** Verify sampled bytes against the exact *generated* development manifest.
 * A running asset service with a different approved pack must not be used
 * by this synthetic-only CLI without explicit user action.
 */
export async function matchesSyntheticAssetServer(baseUrl, manifest, request = fetch) {
  const base = loopbackUrl(baseUrl);
  if (manifest?.schemaVersion !== 1 ||
      manifest?.source?.repository !== 'synthetic-local-fixtures' ||
      !Array.isArray(manifest.assets) || manifest.assets.length === 0) {
    throw new TypeError('Expected the local generated synthetic asset manifest.');
  }
  const images = manifest.assets.filter(item => item.path?.startsWith('img/') &&
    Number.isSafeInteger(item.bytes) &&
    /^[0-9a-f]{64}$/.test(item.sha256));
  if (images.length !== manifest.assets.length) {
    throw new TypeError('Synthetic manifest has unverified or invalid image entries.');
  }
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
