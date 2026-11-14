# Synastry interaction layer × house-system compatibility

## Integration contract

This draft PR updates its synastry renderer to preserve the **PR #22** interactive planet layer `'synastry'` while adopting the **PR #90** selected-house validation and fallback. The former creates interaction metadata for synastry glyphs; the latter avoids crashing or inventing AS/DS/MC/IC when the selected house system does not exist or contains invalid cusp geometry.

The `getAnelloElementiCelesti` call must receive both the rendering-only fallback theme (`houses: {}` when the selected system is missing/invalid) **and** the trailing `'synastry'` interaction layer. Otherwise a future integration could reintroduce 0° ghost axes or register synastry planets as natal planets. After the async planet layer resolves, its group is still adopted immediately by the parent for animation cleanup.

For now this branch includes the same `house-cusps.ts` validator as PR #83 so it can typecheck independently. During subsequent integration of the stacked #83 → #88 → #90 chain, **deduplicate the identical helper** rather than introducing parallel algorithms. On 2026-11-14, current `main` was merged **into the #22 feature branch only** (commit `9018190`); its nine upstream changed files were retained, and `package.json` preflight was reconciled so that the `verify-local` and `pr-overlap` gates run alongside every existing #22 interaction gate. GitHub then reported `mergeable_state: clean` for #22 against `main`. This does **not** integrate #83/#88/#90 into main or approve this large feature PR.

## Test gate

Run `npm run test:synastry-interaction-compat`: six synthetic-source tests verify

- Missing selected domification: the synastry layer remains labeled correctly and the actual celestial selector receives no false axes
- Present valid domification: genuine AS/DS/MC/IC positions are preserved
- Finite but invalid cusp sectors: fallback without fake house rings
- Legitimate 0° cusp/axis values remain valid
- Unexpected validator failures reject with cleanup, rather than being silently hidden
- House-render failures still clean up without leaving stale interaction glyphs

The tests transpile the actual source files with the pinned TypeScript dependency; no private natal data or host-owned artwork is bundled. `preflight` now includes them alongside all existing PR #22 interaction tests.

## Status, visual checks and risks

No claim of full build, Node test completion or visual parity is made until the commands have run on a checkout. Before merge, run `npm ci`, `npm run verify:angular`, browser pointer/keyboard tests (AS/DS/MC/IC, natal/transit/synastry), PNG exports, mobile sizes and Astrolabio headless/e-ink tests. Focus must never change zoom or camera scale. Test real assets only in a separately authorized workspace, following `AGENTS.md`. Although #22 is now mechanically mergeable against current `main`, keep it **draft** and do not merge before complete Node/Angular/browser QA, review of its extensive code changes, and reconciliation with the still-open #83/#88/#90 chain.

No runtime change is intended for valid charts beyond preserving the already implemented interactive layer. No code was merged into `main`, no deployment, no new dependencies or public API.
