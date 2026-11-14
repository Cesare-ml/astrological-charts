# Validation roadmap and release gates (2026-11-14)

This document is a planning checklist, **not** evidence of completed validation. See [AGENTS.md](../AGENTS.md), [extraction status](EXTRACTION_STATUS.md), and [audit issue #20](https://github.com/Cesare-ml/astrological-charts/issues/20).

## Gate 1 — reproducible local build

- [ ] Record checkout commit SHA, Node/npm versions and operating system.
- [ ] Run `npm ci` on a clean checkout.
- [ ] Run `npm run verify:angular` and record exit codes and full failure diagnostics.
- [ ] Do not infer browser rendering correctness from a successful TypeScript or Angular build.

## Gate 2 — independent Three.js demo

- [ ] Run the localhost demo with synthetic fixtures for natal, transits, synastry and latitudes across seven skins.
- [ ] Run the documented Chromium and Firefox browser suites; record browser versions, screenshots and any WebGL limitations.
- [ ] Test keyboard-only focus, accessible labels and PNG export without unexpected zoom.
- [ ] Independently verify natal AS/DS/MC/IC canvas effects (issue #25); sidebar label changes alone are insufficient.
- [ ] Compare two concurrent canvases and repeated redraw/export memory usage (issue #5).

## Gate 3 — approved assets

- [ ] Obtain the separate, owner-authorized `Cesare-ml/astrological-assets` checkout.
- [ ] Validate `manifests/approved-assets.json` against the real asset bytes with SHA-256 and record the pinned revision.
- [ ] Reject absent, unapproved or mismatched assets; do not fall back to production hotlinks.
- [ ] Keep all artwork and fonts outside this renderer repository and its package output.
- [ ] Treat original font rights and public redistribution rights as unresolved until documented.

## Gate 4 — integration and release decision

- [ ] Verify that precomputed astronomical inputs remain owned by the upstream ephemeris/functions layer, not duplicated in Three.js.
- [ ] Check compatibility with the existing `grafici-astrologici` public imports and VirgoStars/Astrolabio consumers.
- [ ] Complete source/third-party rights audit before claiming open-source release readiness; a public GitHub repository without a LICENSE does not grant redistribution permission.
- [ ] Preserve visible VirgoStars credits and a project link in the demo.
- [ ] Obtain explicit owner approval before merge, deployment, npm publication or production/device integration.


## Reproducible local execution (no CI)

Run from the repository root with Node 22.12+ and the pinned lockfile. The following are **commands to execute**, not previously completed checks:

```sh
node --version
npm --version
git rev-parse HEAD
npm ci
npm run verify:angular
npm run demo:generate-synthetic
npm run test:demo
npm run test:offline
```

The two browser test commands require their documented local browser and server prerequisites; consult [Angular demo](ANGULAR_DEMO.md) before interpreting failures. The synthetic asset generator writes to ignored `.local/`, not the source tree. Use the separate approved asset pack only after its manifest and bytes have been verified; never copy it into this repository.

For every command capture the **actual exit code** and the tested commit. A GitHub commit/readback, a static assertion or a synthetic-only screenshot must not be reported as a successful Angular build, original-artwork comparison, or Astrolabio acceptance.

## Evidence log template

For each gate record: commit SHA, command, environment, PASS/FAIL/NOT RUN, exit code, screenshot or artifact reference, blocker and next action. Do not mark a gate complete on static code inspection alone.

No GitHub Actions or automatic deployment are required or authorized by this roadmap.
