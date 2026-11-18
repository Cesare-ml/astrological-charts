# Browser demo asset coverage audit: canonical request paths

The local demo coverage audit (`scripts/audit-demo-asset-coverage.mjs`) observes requests made by the Angular chart demo across four chart modes and seven skins. It compares the **observed URL paths** against a separate host-owned artwork tree, respecting the exact filesystem spelling and letter case. It does not copy or publish art, compute astrological positions or establish image redistribution rights.

## Why validate observed URLs?

The browser percent-encodes legitimate filenames containing spaces or non-ASCII characters. The audit decodes these paths once and validates the resulting `img/...` or `fonts/...` filename using the same literal-path policy as `scripts/asset-manifest.mjs`.

An observed request with malformed encoding, an encoded dot or path separator, unsupported file type, URL delimiter, traversal, or control byte **must not** be counted as a valid asset. Instead of throwing an uncaught exception from a Playwright event handler, the audit records the error and fails its current mode/skin check. Out-of-scope hostnames, ports and non-asset requests are ignored.

Validation is intentionally strict about `%2e`, `%2f` and `%5c`, but permits normal `%20` encoding of a filename space. URLs are not rewritten in the renderer, demo or production.

## Run (read-only)

From a checkout with Node/Angular dependencies and the separate approved assets repository:

```bash
npm ci
npm run test:demo-asset-coverage
npm run demo:pack
# Terminal A: npm run demo:assets
# Terminal B: npm run demo
# Terminal C:
npm run audit:demo-asset-coverage -- --root ../astrological-assets/public/assets
```

The report is written to the ignored `.local/demo-asset-coverage.json` path. Review the missing files and request contexts; the report is only a **coverage estimate** of the particular synthetic demo, not proof of full image parity. If a failed or noncanonical request is observed, investigate before using the report for downstream packaging decisions.

## Compatibility and limitations

- Only the configured local `127.0.0.1:4177` asset server is measured.
- Paths are checked without following symlinks and with exact letter case (including on Windows).
- Source-generated URLs may already have been normalized by the browser before the audit can inspect them. This guard cannot recover earlier URL spellings.
- The current audit covers default fixtures for natal/transits/synastry/latitudes and seven skins, not every advanced option, font, offline-device asset or all renderer entry points.
- No assets are copied, no GitHub Actions, npm publication, production deployment or Astrolabio updates are required.

Keep the change in Draft until the local Node test, demo browser checks and audit have been reviewed.
