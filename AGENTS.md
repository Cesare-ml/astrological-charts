# Astrological Charts — instructions for AI coding agents

## Mission and scope

Develop only the Angular/Three.js astrological chart rendering library. Preserve its visual geometry, compatibility with VirgoStars and Astrolabio, and contributor freedom to propose improvements. A framework-agnostic rewrite is not requested.

Original production source: `Cesare-ml/virgo-stars/shared/grafici-astrologici/src/`. This extracted repository is PRIVATE and not used by production until specifically integrated.

## Rules

1. Read `README.md`, `docs/EXTRACTION_STATUS.md`, `docs/ARCHITECTURE.md` and `CONTRIBUTING.md` before editing.
2. Only modify this repository. Do not deploy or write to the original VirgoStars repository, AWS, databases, accounts or live Astrolabio devices.
3. Work on a feature branch and open a pull request. No self-approval or automatic merge.
4. Keep Angular integration intact. Preserve public `grafici-astrologici` import compatibility unless the PR explicitly proposes migration.
5. Avoid unrelated refactors. Describe visuals before/after, input fixtures, affected consumers, and any changed public contracts.
6. Do not introduce secrets, tokens, production payloads, personal natal-chart data, or private business records into code or test fixtures.
7. Use `scripts/derive-chart-asset-selection.mjs` to derive candidate chart-only paths from active TypeScript AST plus host folders; unresolved active skin resources must be investigated rather than silently renamed. The manifest generator is metadata-only; use `scripts/asset-manifest.mjs` with explicit selection and review `docs/ASSET_MANIFEST.md`. Do not commit inventory snapshots that include unrelated host content. All production visual assets are **host-owned** in `virgo-stars/public/assets/`. Never copy them into this renderer repository, package output or demo. Use `resolveChartAssetUrl` for rendering, share canonical `/assets/img/` URLs with host HTML/CSS, and check rights before adding any fixture images or fonts. Asset files already publicly visible do not imply redistribution rights.
8. A collaborator without VirgoStars repository access may use `scripts/serve-local-assets.mjs` with a **separate approved chart-assets checkout**. Do not silently hotlink the production website, copy artwork into the renderer package or use private cloud credentials. The private `Cesare-ml/astrological-assets` repository contains owner-authorized images and a manifest for private collaboration; the original font is not included and public redistribution is not authorized. Always require a validated `manifests/approved-assets.json` to run the real local asset server. Use `scripts/preview-synthetic.ps1` for generated placeholder preview only; never claim it reproduces the chart's real visuals.
9. Never add GitHub Actions, production deployments, publish-to-npm workflows, or scheduled jobs unless explicitly authorized by repository owner.
10. Do not treat a successful build as proof of visual correctness. Test browser, mobile PNG and headless/e-ink paths when relevant.
11. Update docs for every meaningful feature or behavioral change. Report test commands executed and distinguish untested work.

## Owner-approved interaction direction (2026-11-11)

Use `docs/PLANET_INTERACTIONS.md#target-visual-behavior--owner-reference-2026-11-11`
as the interaction and palette design contract. In particular:

- Light/dark planet symbols are neutral/monochrome until selected.
  Pointer **enter latches selection**; leaving the canvas does not clear
  the selection. Button and touch selection must remain accessible.
- Color only the selected planet and partners of the supplied aspects.
  Keep natal aspects gray behind colored natal-to-transit highlights;
  use dashed radial links toward involved outer transiting planets.
- For a natal-only chart, keep all ordinary natal aspects colored.
  When the **Focus aspects** toggle is enabled, gray unrelated natal
  aspects and initially select **Sun** when no selection exists.
- Do not compute new astrology in the renderer. Use original natal
  aspect geometry/tags from `AspettiRender` and cross-chart
  relations from the host. Restore colors, line objects and scales on
  mode switches/redraw/destroy. Keep headless PNG/Firefox untouched.
- The owner's screenshot is a behavioral reference, **not** a
  redistributable asset; never commit it or copy the source software UI.
- The first implementation is in draft PR #22. Full screenshot fidelity
  and the exact gray-under-color layering remain human-review gates,
  not assumptions. Do not merge without local Chrome/Firefox checks.

## No-enlargement and four-axis interactive acceptance

The owner explicitly requested **no planet scaling on hover or
selection**. Do not reintroduce `mesh.scale.multiplyScalar` into
`PlanetInteractionController.updateVisuals`; focus uses tint,
aspect-line colors and accessible button state. Test that all
canvas symbols retain their original size through hover, click,
touch, scene refresh and teardown.

AS/DS/MC/IC are house-derived astronomical angles, **not
additional planets**. The demo must offer all four as accessible
selection targets, set `.aspVerso` in its options so the existing
aspect engine includes planet–axis relationships, and never invent
real orbs. Cross-theme illustrative links remain explicitly labeled
synthetic. Preserve the existing no-axis-to-axis logic.
Maintain the matching browser and Node regression tests.

## Native natal aspect focus foreground ownership

The current draft interaction controller implements the owner's
gray-under-colored natal focus using **screen-only clones of the
existing tagged native aspect strokes**. Preserve the exact original
line geometry, angle directions, widths and solid/dashed/dotted
patterns. Copies must clone both BufferGeometry and Material instead
of sharing mutable Three.js resources with the gray background,
and must be disposed on focus change/redraw/destroy. Do not duplicate
aspect calculations, alter native export PNG/JPEG visuals or commit
original assets. Keep `tests/fixtures/planet-focus-style-harness.ts`
covering independent foreground colors, disposal events and repeated
focus cycles. The 2026-11-11 owner confirmed the prior nonzoom/axis
version, **not yet** this double-layer revision.

## Native fat-line integration regression

Keep `tests/fixtures/native-natal-line-harness.ts` wired into
`npm run test:demo-interactions`. Its `Line2`/`LineGeometry`/
`LineMaterial` objects exercise the native three.js fat-line shape,
including grouped dash/dot-like segments, not only a simple
`THREE.Line`. Preserve original native colors, material linewidth,
chart-group transforms and independent ownership of foreground
clone geometry/material. When focus changes, dispose only the
temporary copies, never the native chart's resources. No new
astronomical calculations, image assets or production changes.
An unexecuted browser fixture is not proof of visual correctness.

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
