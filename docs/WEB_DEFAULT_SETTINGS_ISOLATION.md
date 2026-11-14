# Independent web chart settings

`settaggiDefault` is an existing, exported mutable settings object.
Passing it directly to multiple chart instances (or shallow-spreading it)
shares nested aspect controls, celestial-body options and position data.
Changes in one chart can then affect another chart.

## Opt-in constructor

```ts
import { createDefaultSettaggi } from 'grafici-astrologici';

const natalSettings = createDefaultSettaggi();
const transitSettings = createDefaultSettaggi();

natalSettings.elementi_celesti.Sun.orb = 2;
// transitSettings retains the original Sun orb.
```

The new `createDefaultSettaggi(): Settaggi` function makes a fresh
`Settaggi` instance and independently copies:

- aspect activity flags and aspect orb controls;
- every celestial-body configuration;
- the `Posizione` model, manual coordinates and city;
- the nested `Stato` (country) of the city.

Its values match the legacy `settaggiDefault`, including the chosen skin,
house system, aspect settings and default position. The legacy export and
all existing imports remain unchanged. The function does **not**
automatically migrate web consumers; a caller must explicitly opt in.

## Validation and boundaries

Run `node --test tests/web-default-settings-isolation.test.mjs` after
`npm ci`. The test compiles the real TypeScript model and checks matching
serialized defaults, model methods, and isolation across independent
instances. Before integrating with production, additionally run
`npm run check:types`, `npm run verify:angular` and browser tests.

This change does not alter the renderer, chart pixels, coordinates,
camera behavior, PNG export or Astrolabio's separate settings model.
It does not change the public release/licensing status, include artwork
or modify consumer repositories.
