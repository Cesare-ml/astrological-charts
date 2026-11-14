# Synastry with a missing selected house system

## Problem

`SinastriaRender.getAnelloSinastria` previously treated any nonempty `temaRender.houses` object as proof that the **selected** domification existed. If the chart contained `placido` but its settings selected `egizia`, the renderer read `houses.egizia.ascendant` and threw before producing the synastry chart.

Simply skipping the house ring is insufficient: the inner planet renderer checks for *any* house data when emitting AS/DS/MC/IC and vertex glyphs, so leaving the unrelated house system present could generate phantom axes at 0° or an invalid vertex.

## Behavior

Resolve `houses[settaggi.domificazione_selezionata]` once. Require finite `ascendant` and `mc`, then call the **same `unwrapHouseCusps` validator** used by the house renderer (from PR #83). The validator requires twelve *present* finite cusp angles and a nondecreasing unwrapped sequence within one 360° revolution; 0° and valid mixed angular frames remain supported. Sparse arrays and impossible whole-wheel sectors are rejected consistently. Expected `TypeError` or `RangeError` means the selected system is unavailable for this drawing, not that synastry should crash. Unexpected validator failures are **not** converted into fallbacks; they propagate after scene animation cleanup so that programming errors are not hidden. For a valid system, preserve its house ring, angles and exact chart reference. Otherwise, use the existing no-houses fallback and pass a shallow rendering-only theme with `houses: {}` to the celestial renderer. Planetary data and the original theme are left untouched; no guessed system or 0° axes are drawn.

Synthetic example: `houses = { placido: {...} }` and selected `egizia` now yields the signs/planet ring and optional empty-house texture, without case divisions or synthetic AS/DS/MC/IC. A valid `placido` selection remains unchanged.

The integration regression also calls the **actual** `ElementiCelestiRender.getElementiCelesti` method. On the original unfiltered theme it demonstrably emits phantom AS and MC at 0° when the requested system is missing; on the fallback theme passed by `SinastriaRender`, it emits only the actual Sun. Selecting a valid `placido` system retains the authentic AS=55°, DS=235°, MC=150° and IC=330° positions. This strengthens the earlier ring-only mock tests without copying calculation logic into the test.

## Verification

Run `npm run test:synastry-missing-houses` for thirteen deterministic scenarios, including real AS/DS/MC/IC selector checks and an injected unexpected helper failure to confirm cleanup and error propagation, against the actual TypeScript module (transpiled using the pinned TypeScript dependency, with visual modules mocked). Run `npm run verify:angular` and browser screenshot checks with all seven synthetic skins before merging, including house-system changes while viewing synastry. Actual artwork, Firefox headless/e-ink and Astrolabio device parity require separate verification.

This change affects missing, incomplete, nonfinite or geometrically inconsistent selected house systems. It now **depends on PR #83's shared cusp helper via stacked PR #88**; PR #90 must not be rebased directly onto main before that helper is integrated. Consumers supplying numeric strings rather than numbers for angles must normalize them before calling the renderer. It introduces no public API, new assets, licenses, production integrations, publishing or GitHub Actions. PR #22 also modifies the synastry renderer: rebase or reconcile its interaction work before integration into main.

## Reference Ascendant safety

The `ascendenteTemaDiRiferimento` argument determines both zodiac and planetary ring rotation, even when the selected house system is missing and the no-houses fallback is used. Formerly, `undefined`, NaN or an infinite value was accepted and silently propagated as a nonfinite rotation; a numeric string or `null` could be coerced to a misleading finite angle. The renderer now requires a finite JavaScript number. A missing/invalid value throws `TypeError` before any house/planet/sign geometry is created and the temporary group is traversed through the existing error-cleanup path.

Two regression tests cover invalid values for a valid selected system, verify cleanup and caller non-mutation, and check that a legitimate **0° reference** retains both the selected-system and no-houses fallback modes. Real Node/Angular/browser execution of the complete regression suite remains a maintainer gate; an isolated in-memory run of the actual renderer method confirmed the old nonfinite angles and the corrected early rejections.

## Targeted real Node.js source-backed validation (2026-11-14)

After adding the reference-Ascendant guard, a separate isolated test harness compiled the **exact GitHub TypeScript source** of `sinastria.renderer.ts` with TypeScript `transpileModule` (CommonJS, ES2022, interop) and ran it with the **actual Node.js 22.16.0 `node:test` runner**. The source file's locally computed Git blob SHA matches GitHub: `7237eb7dd81db2c9b028380b0fd769669f173c8d`. The imported cusp helper likewise matches its committed Git blob. The renderer's graphical dependencies were replaced with test doubles, so no browser or WebGL was involved.

All **4/4 isolated Node tests PASS, exit 0**: invalid-reference rejection before drawing; 0° reference behavior for valid and missing selected house systems; null theme early return; and a regression control proving the preceding renderer silently passed `NaN` to both planetary and zodiac ring renderers. The committed test suite has **15 cases**, including the two new reference-Ascendant cases; **that full committed Node suite was NOT RUN** because a full repository checkout and all real dependencies are unavailable in this environment.

The full `npm ci`, `npm run verify:angular`, Chromium/Firefox WebGL/PNG visual baselines and Astrolabio headless/e-ink consumers remain **NOT RUN**. A passing isolated unit test is not approval to merge or release.

## Precision of synastry reference-ring rotation

The selected-house Ascendant may arrive in a numeric frame that differs from the chart's 0–360° reference. The old expression `as + (ascendenteTemaDiRiferimento - as) - offsSinastriaDeflettiva` mathematically cancels `as`, but floating-point arithmetic can lose degrees when `as` is unusually large. A synthetic finite input `as = 1e16`, reference `13°` previously supplied `12°` to both planet and sign rings. Both now receive `ascendenteTemaDiRiferimento - offsSinastriaDeflettiva` directly, preserving the intended reference. A regression exercises the real TypeScript renderer source with fake visual modules, covering exact planet/sign rotations, unchanged ring selection and input immutability. This defensive numeric case does not assert that extremely large longitudes are astronomically meaningful.

The inner house-ring offset formula is unchanged. Full Node, Angular/WebGL and Astrolabio validation remains required.
