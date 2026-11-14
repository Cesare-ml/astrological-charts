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

## Unlisted asset HEAD regression (2026-11-14)

The synthetic HTTP suite now verifies that an approved loopback `Origin` cannot use `HEAD` to access an asset path absent from the validated manifest. The expected response is HTTP 404, `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`, and an empty body, matching the existing GET denial. This checks method parity without reading or committing any real artwork.

**Validation:** GitHub commit/readback only; executable Node test **NOT RUN** in this connector-only change. Run `node --test tests/local-asset-cors-preflight.test.mjs` in a complete Node 22 checkout before merge. Angular, browser WebGL, real approved-asset SHA-256 byte comparison and license clearance remain **NOT RUN**. The `astrological-assets` approved manifest metadata was inspected, not its image bytes. No production, CI, or rendering changes.

## Synthetic HTTP payload parity (2026-11-14)

The regression now reads the generated fixture PNG directly and compares **all GET response bytes** against that fixture with a strict buffer assertion. It also verifies that GET and HEAD advertise the exact fixture byte length, while HEAD returns no body. This strengthens the end-to-end HTTP contract beyond status/header-only checks and runs entirely on synthetic images. The existing post-startup tampering checks still require HTTP 409.

**Validation:** source and documentation committed through the GitHub connector; Node 22 runtime test, Angular build, browser WebGL and actual approved-artwork SHA-256 checks remain **NOT RUN**. Run `node --test tests/local-asset-cors-preflight.test.mjs` in a full checkout. No changes to renderer calculations, approved asset images, deployment or production.

## Local preview referrer privacy (2026-11-14)

The loopback-only asset server now sets `Referrer-Policy: no-referrer` on every response, including `/__preview`, unlisted assets (404), and tampered assets (409). This reduces accidental disclosure of local preview paths when navigating to the visible VirgoStars credit link. The synthetic HTTP regression asserts the header for these response classes. The credit link remains `https://www.virgostars.it/`; no artwork or ephemeris logic is changed.

**Validation:** GitHub commit and source readback only; `node --test tests/local-asset-cors-preflight.test.mjs` is **NOT RUN** until a full Node 22 checkout is available. Full Angular builds, Chromium/Firefox WebGL and approved real-file SHA-256 verification remain **NOT RUN**. This header is defense-in-depth, not proof of browser behavior or license clearance.

## Denied HEAD privacy regression (2026-11-14)

The synthetic HTTP test additionally asserts that a cross-origin denied `HEAD` response carries `Referrer-Policy: no-referrer` and returns an empty body. This closes a small method-specific gap in the response-header regression without changing the renderer, asset server or approved assets. This is a source assertion only: `node --test tests/local-asset-cors-preflight.test.mjs` has **NOT RUN** in this connector-only session. Angular builds, browser WebGL, and actual approved asset byte-hash checks are also **NOT RUN**. No production changes, Actions or merge.

## Preview HEAD origin isolation (2026-11-14)

The HTTP regression also checks that an untrusted `HEAD /__preview` request returns 403, does not grant `Access-Control-Allow-Origin`, retains `Referrer-Policy: no-referrer` and `Cache-Control: no-store`, and sends no response body. This complements the existing rejected preview GET and approved GET/HEAD parity checks. It uses generated synthetic files only; no original artwork or astronomical computation is involved.

Validation: GitHub source update and readback only; executable Node 22 test, Angular builds, Chromium/Firefox WebGL and real approved-asset byte SHA-256 checks remain **NOT RUN**. Run `node --test tests/local-asset-cors-preflight.test.mjs` before considering integration. VirgoStars: https://www.virgostars.it/.

## Recovery after transient synthetic-file tampering (2026-11-14)

After verifying that changed fixture bytes cause HTTP 409 for both GET and HEAD, the test restores the **exact original synthetic PNG bytes** and checks that GET returns HTTP 200 with byte-for-byte equality and HEAD returns HTTP 200 with the original Content-Length and no body. This catches accidental permanent rejection or stale invalid-state caching after a transient file change. The fixture is disposable; no approved image is edited or copied.

**Validation:** GitHub source readback is a static check only. Run `node --test tests/local-asset-cors-preflight.test.mjs` with Node 22 on a complete checkout; full Angular builds, Chromium/Firefox WebGL and real approved-asset SHA-256 byte verification are still **NOT RUN** in this connector-only change. The separate `astrological-assets/manifests/approved-assets.json` manifest metadata was inspected; artwork licensing and production parity remain separate gates. No GitHub Actions, deployment, merge or production changes.
