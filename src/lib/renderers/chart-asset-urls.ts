/**
 * Resolve chart-renderer asset references into URLs served by the host application.
 * There are no bundled image files in this package.
 *
 * VirgoStars' frontend already owns /assets/. Both <img> elements and Three.js
 * textures should refer to the exact same canonical URLs.
 */
export function resolveChartAssetUrl(reference: string, publicAssetsBase: string = '/assets/'): string {
  if (typeof reference !== 'string' || reference.trim().length === 0) {
    throw new TypeError('Chart asset reference must be a non-empty string.');
  }

  const value = reference.trim().replace(/\\/g, '/');

  // Explicit absolute URLs (including file:// for offline rendering), data/blob URLs,
  // and protocol-relative URLs are controlled by the caller and kept unchanged.
  if (/^[a-z][a-z\d+.-]*:/i.test(value) || value.startsWith('//')) return value;

  // Leave unrelated host-absolute paths intact, e.g. /images/custom.png.
  if (value.startsWith('/') && !value.startsWith('/assets/')) return value;

  // Historical renderer code adds '../../../assets/img/' before a relative ref.
  // Strip parent directories only when they lead to the known public 'assets/' root.
  let path = value.replace(/^(?:\.\.\/|\.\/)+(?=assets\/)/, '');
  if (path.startsWith('../') || path.startsWith('./')) {
    throw new Error(`Invalid relative chart asset reference: ${reference}`);
  }
  path = path.replace(/^\/+/, '');

  // Explicit 'assets/img/...' and 'assets/fonts/...' are relative to the host's
  // configured public root. Bare renderer symbols default to the img/ directory.
  if (path.startsWith('assets/')) path = path.slice('assets/'.length);
  else if (!path.startsWith('img/') && !path.startsWith('fonts/')) path = `img/${path}`;

  const segments = path.split('/');
  // Asset references must be literal manifest paths. Percent-encoded dot segments
  // (such as %2e%2e) can become traversal when the browser parses the URL.
  // Reject encoded bytes and control characters before handing paths to a host.
  if (segments.some((part) => part === '' || part === '.' || part === '..'
    || /[%\u0000-\u001f\u007f]/.test(part))) {
    throw new Error(`Invalid chart asset path: ${reference}`);
  }

  if (typeof publicAssetsBase !== 'string' || !publicAssetsBase.trim()) {
    throw new TypeError('Public assets base must be a non-empty string.');
  }
  const root = publicAssetsBase.trim().replace(/\/+$/, '') + '/';
  return root + path;
}
