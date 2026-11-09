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
8. Never add GitHub Actions, production deployments, publish-to-npm workflows, or scheduled jobs unless explicitly authorized by repository owner.
9. Do not treat a successful build as proof of visual correctness. Test browser, mobile PNG and headless/e-ink paths when relevant.
10. Update docs for every meaningful feature or behavioral change. Report test commands executed and distinguish untested work.

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
