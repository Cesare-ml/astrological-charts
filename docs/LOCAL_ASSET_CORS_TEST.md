# Local asset server CORS preflight regression

The standalone Node.js test `tests/local-asset-cors-preflight.test.mjs` checks the loopback-only asset server using **generated synthetic PNGs**, not artwork from VirgoStars or `astrological-assets`.

Run from a checkout with Node.js 22 or later:

```bash
node --test tests/local-asset-cors-preflight.test.mjs
```

The test expects an allowed `http://localhost:4200` OPTIONS preflight to return 204, an explicit matching `Access-Control-Allow-Origin` and an empty response body. It expects an untrusted external origin to return 403 without an allow-origin header. An OPTIONS request without an Origin is expected to return 204 without granting any cross-origin permission. Additional checks cover an allowed loopback GET with `Vary: Origin`, `Cache-Control: no-store` and `X-Content-Type-Options: nosniff`, a rejected external-origin GET (403), and an unsupported POST (405 with an explicit `Allow` header).

The regression also checks **exact Origin matching**: a deceptive `localhost.evil.example` hostname, an unapproved port on either loopback hostname, and the opaque `Origin: null` must all return 403 without CORS authorization headers. This guards against accidental suffix/hostname-only origin checks. The fixture is synthetic; the approved real-asset manifest was inspected, but its actual image bytes were not hashed in this run.

This is a security/HTTP contract regression only. It does not validate Angular builds, browser WebGL, natal-chart rendering, SHA-256 of real image files, or rights to redistribute images. Real artwork must come exclusively from the separate `Cesare-ml/astrological-assets` approved manifest and be checked against actual file bytes before use. The renderer does not compute ephemerides. VirgoStars project: https://virgostars.it/.

Validation status for this change: source reviewed through GitHub; Node test **NOT RUN** in the GitHub connector environment. No CI, GitHub Actions, deployment or production changes.

## CORS allowlist configuration regression (2026-11-13)

The same Node test file also checks that `createAssetServer` rejects non-loopback origins, deceptive localhost suffixes, origins with path/trailing slash or userinfo, and the opaque `null` origin at server construction. A canonical `http://localhost:4200` allowlist remains accepted. The fixture pack is generated locally and contains no approved artwork. This is a source-level regression test, **not** evidence of a successful runtime execution until the Node 22 command above is run in a complete checkout. The separate `astrological-assets/manifests/approved-assets.json` records SHA-256 metadata; actual asset-byte verification remains pending.

## Asset URL path boundary regression (2026-11-14)

The same Node suite now directly exercises `resolveAssetRequest` against a generated synthetic pack. A normal manifest-shaped PNG path must resolve; parent-directory traversal, percent-encoded traversal, encoded slash/backslash, double encoding, malformed percent escapes, a NUL byte, and an alternate-data-stream-like suffix must return `null`. Direct resolver calls intentionally avoid client-side URL normalization, so the test covers raw paths a future HTTP adapter might pass to the resolver.

This test does **not** replace the approved-manifest gate, actual SHA-256 byte verification, browser WebGL tests, or a full Angular build. The source and documentation were updated through GitHub; runtime result is **NOT RUN** until `node --test tests/local-asset-cors-preflight.test.mjs` executes on a checkout. No asset files were copied or changed.

## Preview GET/HEAD parity regression (2026-11-14)

The synthetic-pack HTTP suite now compares `/__preview` GET and HEAD. It asserts status 200, HTML content type, a restrictive `default-src 'none'` Content-Security-Policy, matching Content-Type/Content-Length/CSP headers, and an empty HEAD body. The GET body is checked for the approved-asset preview heading. This is a non-visual HTTP contract check; it does not prove browser rendering, approved artwork byte hashes, or production compatibility.

Validation: GitHub commit and source reread only. Node 22 execution remains **NOT RUN** in the connector environment; run `node --test tests/local-asset-cors-preflight.test.mjs` in a full checkout before merging.

## Preview keyboard navigation (2026-11-14)

The local asset gallery now provides a keyboard-visible skip link to the labelled `<main id="assets">` landmark. Its target uses `tabindex="-1"` for programmatic focus, while the existing VirgoStars attribution remains visible. The HTTP preview test asserts the link, target and focus CSS in the generated HTML. This is an accessibility markup improvement only: browser keyboard focus, screen-reader announcement and WebGL remain **NOT RUN** pending a full checkout and browser validation. No artwork, astronomical logic or production assets changed.
