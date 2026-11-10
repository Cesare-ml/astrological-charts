# VirgoStars graphics extraction provenance

Original repository: `Cesare-ml/virgo-stars`, branch `master`, subtree `shared/grafici-astrologici/`.

Reference head observed when extracting the code: `9900c36acc309bc2a6e87009f554b2e4141e4864`. Representative unchanged files (render service, model `TemaRender`, house renderer and skin manager) were checked against this commit by blob SHA. No complete monorepo Git history was imported.

## Copied source files (25)

- `src/public-api.ts`
- `src/lib/grafici-astrologici.ts`
- `src/lib/models/tema.model.ts`
- `src/lib/models/tema-localdb.model.ts`
- `src/lib/models/tema-render.model.ts`
- `src/lib/models/tema-form.model.ts`
- `src/lib/models/settaggi.model.ts`
- `src/lib/models/settaggi-astrolabio.model.ts`
- `src/lib/models/posizione.model.ts`
- `src/lib/models/posizione-localdb.model.ts`
- `src/lib/models/opzioni-grafico.model.ts`
- `src/lib/services/grafico-render.service.ts`
- `src/lib/renderers/_colori.config.ts`
- `src/lib/renderers/@skin-manager.ts`
- `src/lib/renderers/@gestore-eventi-mouse.ts`
- `src/lib/renderers/oggetti-semplici.renderer.ts`
- `src/lib/renderers/gestore-immagini.ts`
- `src/lib/renderers/@carta-astrale/carta-astrale.renderer.ts`
- `src/lib/renderers/@carta-astrale/latitudini.renderer.ts`
- `src/lib/renderers/moduli/segni.renderer.ts`
- `src/lib/renderers/moduli/case.renderer.ts`
- `src/lib/renderers/moduli/elementi-celesti.renderer.ts`
- `src/lib/renderers/moduli/aspetti.renderer.ts`
- `src/lib/renderers/moduli/transiti.renderer.ts`
- `src/lib/renderers/moduli/sinastria.renderer.ts`

## Intentional deviations

The following three imports from the package's own public entry point were replaced with relative imports for isolated compilation:

- `src/lib/models/settaggi-astrolabio.model.ts`: `PosizioneLocalDB` from `./posizione-localdb.model`
- `src/lib/renderers/moduli/segni.renderer.ts`: `StatoCartaAstrale` from `../@carta-astrale/carta-astrale.renderer`
- `src/lib/renderers/@carta-astrale/latitudini.renderer.ts`: `SkinManager` from `../@skin-manager`

Excluded: original `src/lib/renderers/_old/`, `public/assets/`, frontend and backend directories, database, credentials, build artifacts and repository history. No visual rendering algorithms were intentionally rewritten in the import.

## Production safety

This extraction has **no production activation**. The live VirgoStars website and Astrolabio continue using the original monorepo source until separately verified and explicitly approved.

## Local verification

An invited contributor can run `scripts/verify-local.ps1` on Windows. The extraction branch passed `npm ci`, preflight and build on Windows/Node 22.18.0; contributors should record their own results and not infer visual compatibility from the build.
