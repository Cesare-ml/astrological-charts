# Celestial color key compatibility: vertex

The settings model and `ElementiCelestiRender.getElementiCelesti` use
`vertex` (lowercase) for the Vertex point. `Colori.elementiCelesti`
previously declared only `Vertex` (uppercase). A chart path that looks up
the selected body's color by its actual renderer key would therefore receive
`undefined` for Vertex.

The palette now exposes **both** names:

- `Colori.elementiCelesti.vertex` — canonical renderer/settings key.
- `Colori.elementiCelesti.Vertex` — retained for existing external consumers.

Both resolve to the previous `#FEFEFE` color. All other palette entries
retain their prior values. The change only affects color resolution when
the lowercase Vertex identifier is used; it does not change the position,
symbol asset, orientation, chart geometry, zoom or PNG export logic.

## Verification

After `npm ci`, run `node --test tests/celestial-vertex-color.test.mjs`.
This exercises the actual TypeScript palette via `typescript.transpileModule`,
checks the model/renderer identifier contract and guards representative existing
colors. Full `npm run verify:angular` and browser/headless chart comparison
remain required before merging or integrating VirgoStars/Astrolabio.
