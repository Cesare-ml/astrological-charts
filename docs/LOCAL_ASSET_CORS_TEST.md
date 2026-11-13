# Local asset server CORS preflight regression

The standalone Node.js test `tests/local-asset-cors-preflight.test.mjs` checks the loopback-only asset server using **generated synthetic PNGs**, not artwork from VirgoStars or `astrological-assets`.

Run from a checkout with Node.js 22 or later:

```bash
node --test tests/local-asset-cors-preflight.test.mjs
```

The test expects an allowed `http://localhost:4200` OPTIONS preflight to return 204, an explicit matching `Access-Control-Allow-Origin` and an empty response body. It expects an untrusted external origin to return 403 without an allow-origin header. An OPTIONS request without an Origin is expected to return 204 without granting any cross-origin permission. Additional checks cover an allowed loopback GET with `Vary: Origin`, `Cache-Control: no-store` and `X-Content-Type-Options: nosniff`, a rejected external-origin GET (403), and an unsupported POST (405 with an explicit `Allow` header).

This is a security/HTTP contract regression only. It does not validate Angular builds, browser WebGL, natal-chart rendering, SHA-256 of real image files, or rights to redistribute images. Real artwork must come exclusively from the separate `Cesare-ml/astrological-assets` approved manifest and be checked against actual file bytes before use. The renderer does not compute ephemerides. VirgoStars project: https://virgostars.it/.

Validation status for this change: source reviewed through GitHub; Node test **NOT RUN** in the GitHub connector environment. No CI, GitHub Actions, deployment or production changes.
