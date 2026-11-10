/* Astrological Charts — Copyright (c) 2026 Cesare-ml (VirgoStars).
 * CPAL-1.0; see ../LICENSE and Exhibits A/B.
 *
 * Local browser-export diagnostics. Report only URLs under the
 * local asset endpoint; no natal input, private file paths, or
 * remote resource URLs are included in failures.
 */
const MAX_REPORTED = 8;

/** Check actual image requests made by the browser during an export.
 * A valid manifest cannot guarantee that every resource requested by
 * a specific chart mode/skin exists in the pack.
 */
export function createChartAssetRequestAudit(assetBase = 'http://127.0.0.1:4177/') {
  const base = new URL(assetBase);
  if (base.protocol !== 'http:' || base.hostname !== '127.0.0.1' ||
      base.port !== '4177' || base.username || base.password) {
    throw new TypeError('Asset request audit must use the local 127.0.0.1:4177 server.');
  }
  const failures = new Map();
  let count = 0;
  let successfulAssetResponses = 0;

  function localPath(url) {
    try {
      const resource = new URL(url);
      if (resource.origin !== base.origin ||
          !resource.pathname.startsWith('/assets/')) return null;
      return resource.pathname;
    } catch {
      return null;
    }
  }

  function add(url, problem) {
    const path = localPath(url);
    if (!path) return;
    count++;
    if (!failures.has(path) && failures.size < MAX_REPORTED) {
      failures.set(path, problem);
    }
  }

  return {
    recordResponse(url, status) {
      if (!Number.isInteger(status)) return;
      if (status >= 400) add(url, 'HTTP ' + status);
      else if (status >= 200 && status < 400 && localPath(url)) {
        successfulAssetResponses++;
      }
    },
    recordFailure(url) {
      add(url, 'request failed');
    },
    assertHasLoadedAssets() {
      if (successfulAssetResponses === 0) {
        throw new Error(
          'The chart requested no successfully served local assets from 127.0.0.1:4177. ' +
          'Check the Angular asset base and chart symbols before exporting private artwork.'
        );
      }
    },
    assertClean() {
      if (count === 0) return;
      const summary = [...failures].map(([path, status]) =>
        `${status} ${path}`).join('; ');
      throw new Error(
        `${count} local chart asset request(s) failed: ${summary}. ` +
        'Verify the approved binary manifest and the requested skin/mode. ' +
        'No synthetic fallback is allowed in an approved-asset export.'
      );
    },
  };
}
