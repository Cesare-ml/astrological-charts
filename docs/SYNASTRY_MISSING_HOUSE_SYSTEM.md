# Synastry with a missing selected house system

## Problem

\`SinastriaRender.getAnelloSinastria\` previously treated any nonempty \`temaRender.houses\` object as proof that the **selected** domification existed. If the chart contained \`placido\` but its settings selected \`egizia\`, the renderer read \`houses.egizia.ascendant\` and threw before producing the synastry chart.

Simply skipping the house ring is insufficient: the inner planet renderer checks for *any* house data when emitting AS/DS/MC/IC and vertex glyphs, so leaving the unrelated house system present could generate phantom axes at 0° or an invalid vertex.

## Behavior

Resolve \`houses[settaggi.domificazione_selezionata]\` once. When found, preserve the existing house ring, angles, and exact chart reference passed downstream. When absent, use the existing no-houses synastry fallback and pass a shallow rendering-only theme with \`houses: {}\` to the planet renderer. Original planetary data and the input theme are left untouched. No guessed house system or 0° axes are used.

Synthetic example: \`houses = { placido: {...} }\` and selected \`egizia\` now yields the signs/planet ring and optional empty-house texture, without case divisions or synthetic AS/DS/MC/IC. A valid \`placido\` selection remains unchanged.

## Verification

Run \`npm run test:synastry-missing-houses\` for six deterministic scenarios against the actual TypeScript module (transpiled using the pinned TypeScript dependency, with visual modules mocked). Run \`npm run verify:angular\` and browser screenshot checks with all seven synthetic skins before merging, including house-system changes while viewing synastry. Actual artwork, Firefox headless/e-ink and Astrolabio device parity require separate verification.

This change affects only missing-selected-system fallbacks. It introduces no public API, new assets, licenses, production integrations, publishing or GitHub Actions. PR #22 also modifies the synastry renderer: rebase or reconcile its interaction work before integration into main.
