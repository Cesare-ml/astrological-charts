# Theme model hydration regression

The Angular chart library includes three theme models with different consumers:

- `Tema`: browser-facing theme data;
- `TemaLocalDB`: offline/local theme data;
- `TemaForm`: form-specific state inherited from `Tema`.

## Previous behavior

All three classes already declared optional metadata fields, but the constructors
omitted them when reconstructing a class instance from a plain object:

- `Tema.sesso` was declared but lost;
- `TemaLocalDB.sesso` was declared but lost;
- `TemaForm.stato` was declared but lost.

This is a serialization/hydration defect, **not** an ephemeris calculation or
chart geometry issue. The values are opaque metadata: this change does not
interpret or normalize them.

## Correct behavior

Constructors copy the optional fields exactly when supplied, including an
empty string. Missing fields remain `undefined`. All existing defaults,
position reconstruction, timezone formatting, public imports and rendering
geometry remain unchanged.

The test uses only synthetic objects. It checks both theme variants, the
subclass, the empty/missing-field cases and the unchanged position constructor
path. Position and timezone imports are test doubles to avoid requiring
Angular, network access or real records for this narrow regression.

## Local verification

On a full checkout with Node 20.19+, 22.12+ or 24 and `npm ci`:

```bash
npm run test:model-hydration
npm run verify:angular
```

The hydration test is also included in `npm run preflight`. A successful
hydration test does **not** validate browser rendering, WebGL resource
disposal, real artwork, headless Astrolabio integrations or original
production behavior. Run the normal Chromium/Firefox and consumer gates
before integrating this change.

This change does not copy production assets, alter the renderer, run
GitHub Actions, publish npm packages or deploy to VirgoStars.
