# Astrological Charts — instructions for AI coding agents

## Mission and scope

Develop only the Angular/Three.js astrological chart rendering library. Preserve its visual geometry, compatibility with VirgoStars and Astrolabio, and contributor freedom to propose improvements. A framework-agnostic rewrite is not requested.

Original production source: `Cesare-ml/virgo-stars/shared/grafici-astrologici/src/`. This extracted repository is PRIVATE and not used by production until specifically integrated.

## AI assistance for non-programmers

The primary contributors may have **no software engineering experience**.
Speak plainly, ask for a screenshot and an expected outcome, and tell
them exactly which button to click or command to paste. Do not assume
they understand Angular, Git or Python. Start with
`docs/START_HERE.md` and `START_HERE.cmd` on Windows. Never promise
a working browser image without running the real renderer.

A Node.js or Python user can feed **precomputed** planet positions and house
cusps to the versioned `schemaVersion: 1` JSON adapter
(`demo/chart-input.ts`) and call
`node/index.mjs` directly from a JavaScript program, or
`examples/python/virgostars_charts.py` from Python, for local PNG/JPEG.
The Node helper and CLI `scripts/render-chart.mjs` start synthetic local
servers and render through the real Angular/Three.js demo. The CLI must
clean up **only** the local servers it started (including descendants),
without terminating pre-existing services. Keep the Windows process-tree
cleanup and POSIX process-group tests in `tests/local-process-lifecycle.test.mjs`. Keep the
schema validated and versioned, preserve negative/positive zero
latitude, and NEVER inject illustrative fixture data if a supplied
transit/synastry chart is missing. Do not invent available
VirgoStars-Ephemeris Rust/Python/Node integrations: cross-language
bindings remain planned, not released.

**Node.js concurrency contract:** `node/index.mjs` keeps a
single in-process Promise queue for `renderChart()` and
`renderChartFile()`; both must share it. A rejected render must
not poison the queue or overwrite a valid existing file. Keep
`tests/node-concurrency.test.mjs` in the manual preflight.
This is **not** a multi-process mutex or browser pool; never
claim it handles production backend concurrency safely.

**Three runtime contexts:** Angular frontend uses the existing Angular
service; general Node.js programs can use `node/index.mjs` with the
same versioned JSON format; the real Astrolabio Node backend uses a
**separate headless Firefox offline adapter** that directly invokes
the scene renderer and loads `file://` assets. The new Chromium helper
does not replace Astrolabio. See `docs/NODE_INTEGRATION.md` and
`docs/INTEGRATION_PLAN.md`. Distinguish a Node.js process orchestrating
a browser from a native Node rendering engine. Do not claim the same
adapter works on hardware without the real offline/e-ink tests.

## Licensing and public-release gate

The original covered source is CPAL-1.0. Read `LICENSE` Exhibits A/B,
`NOTICE`, `docs/LICENSING_AND_CREDITS.md` and
`docs/PUBLIC_RELEASE_CHECKLIST.md`. Preserve the
`Powered by VirgoStars` attribution and project link. For GUI
clients CPAL Section 14 has a launch/session prominence requirement;
a hidden About entry is not automatically sufficient. Section 15
addresses network source availability. Do not present the external
`astrological-assets` pack or unknown-license fonts as CPAL assets.

**The repository is still private and has not passed the public
release audit.** It is not enough to add LICENSE; check source
provenance, other copyright holders, external dependencies and Git
history before the owner changes visibility. Do not alter repository
visibility, `package.json` private status, or publish a package.

## Rules

1. Read `README.md`, `docs/EXTRACTION_STATUS.md`, `docs/ARCHITECTURE.md`, `CONTRIBUTING.md`, and the newcomer/Node/Python guides before editing.
2. Only modify this repository. Do not deploy or write to the original VirgoStars repository, AWS, databases, accounts or live Astrolabio devices.
3. Work on a feature branch and open a pull request. No self-approval or automatic merge.
4. Keep Angular integration intact. Preserve public `grafici-astrologici` import compatibility unless the PR explicitly proposes migration.
5. Avoid unrelated refactors. Describe visuals before/after, input fixtures, affected consumers, and any changed public contracts.
6. Do not introduce secrets, tokens, production payloads, personal natal-chart data, or private business records into code or test fixtures.
7. Use `scripts/derive-chart-asset-selection.mjs` to derive candidate chart-only paths from active TypeScript AST plus host folders; unresolved active skin resources must be investigated rather than silently renamed. The manifest generator is metadata-only; use `scripts/asset-manifest.mjs` with explicit selection and review `docs/ASSET_MANIFEST.md`. Do not commit inventory snapshots that include unrelated host content. All production visual assets are **host-owned** in `virgo-stars/public/assets/`. Never copy them into this renderer repository, package output or demo. Use `resolveChartAssetUrl` for rendering, share canonical `/assets/img/` URLs with host HTML/CSS, and check rights before adding any fixture images or fonts. Asset files already publicly visible do not imply redistribution rights.
8. A collaborator without VirgoStars repository access may use `scripts/serve-local-assets.mjs` with a **separate approved chart-assets checkout**. Do not silently hotlink the production website, copy artwork into the renderer package or use private cloud credentials. The private `Cesare-ml/astrological-assets` repository contains owner-authorized images and a manifest for private collaboration; the original font is not included and public redistribution is not authorized. Always require a validated `manifests/approved-assets.json` to run the real local asset server. Use `scripts/preview-synthetic.ps1` for generated placeholder preview only; never claim it reproduces the chart's real visuals.
9. Never add GitHub Actions, production deployments, publish-to-npm workflows, or scheduled jobs unless explicitly authorized by repository owner.
10. Real PNG/JPEG bridge regression tests live in
    `tests/render-bridge.browser.test.mjs`. The demo publishes its
    completed render revision and actual mode/skin on the status element;
    the exporter must await a **new completed revision** after importing
    JSON and selecting mode/skin. Do not replace this with a check of
    the old `Rendered` label. Run `npm run test:render-bridge` manually
    with Chrome and WebGL; never assert it passed without executing it.
11. Do not treat a successful build as proof of visual correctness. Test browser, mobile PNG and headless/e-ink paths when relevant.
12. Update docs for every meaningful feature or behavioral change. Report test commands executed and distinguish untested work.

## Known technical risks

- global singleton renderer and global dimension/line state;
- incomplete resource disposal on redraw/export;
- assets not packaged and path conventions inconsistent;
- dynamic, weakly typed `TemaRender` and graphics options;
- imports from own package root;
- undefined or mismatched option names;
- no adequate dedicated test and screenshot suite.

## Safe PR format

- Purpose and scope
- Files touched
- Screenshots / visual differences (if applicable)
- Tests actually run and results
- Known risks / rollback
- Compatibility with existing VirgoStars / Astrolabio versions
- AI use (tools and level of manual review)
