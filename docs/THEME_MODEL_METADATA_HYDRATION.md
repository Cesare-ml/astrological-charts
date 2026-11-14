# Theme model metadata hydration

`Tema`, `TemaLocalDB` and `TemaForm` deserialize host-provided records
into model instances. Their constructors previously omitted optional properties
that were already declared in the TypeScript types:

- `Tema.sesso` (ordinary chart records)
- `TemaLocalDB.sesso` (offline/headless records)
- `TemaForm.stato` (form-specific state)

The constructors now preserve those input values, including the empty string,
without inventing defaults when a value is missing. Existing nested
`Posizione`/`PosizioneLocalDB` hydration remains unchanged.

This is a **data-preservation fix**, not an astronomical or gender-based calculation
change. It does not add these fields to the renderer's input requirements,
change visual geometry, modify the public types, or update existing stored
records. It does not introduce personal data or logs.

## Regression checks

In a complete checkout:

```bash
npm ci
node --test tests/theme-metadata-hydration.test.mjs
npm run verify:angular
```

The focused Node test evaluates the repository's real TypeScript models
transpiled in memory, using synthetic fixture values and stubbed position/time
dependencies. No external clock, network, database, production data or browser
is required. A successful focused test is **not** proof of all rendering,
browser compatibility, local DB persistence, or Astrolabio firmware behavior.

Before any VirgoStars/Astrolabio integration, independently test date/time,
saved record loading, offline mode and existing chart screenshots. Production
remains on the original VirgoStars renderer until a reviewed versioned upgrade.
