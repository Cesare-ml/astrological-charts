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
