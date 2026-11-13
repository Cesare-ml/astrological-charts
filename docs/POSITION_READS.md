# Non-destructive position reads

`Posizione` is a public model used by renderer configuration.
It can carry both a selected city (`citta`, `citta_id`) and optional
manual coordinates (`posizione_manuale`). The boolean
`usa_posizione_manuale` decides **which source is active**.

## Why this change

Previously, each call to `getLat()`, `getLng()` or `getTz()` silently
called `resetCitta()` or `resetPosManuale()`. Merely reading a chart's
latitude therefore deleted the inactive source, including its location
metadata. Switching between a city and manual coordinates later lost the
original values even if the UI had never asked to delete them.

These three getters now **only read** the currently selected source.
They return the same values and nullish fallbacks as before and do not
alter the selection flag. The constructor and `Citta`/`Stato`
initialization are unchanged. No renderer, astronomy calculation or
asset behavior changes.

```typescript
import { Posizione } from 'grafici-astrologici';

// Synthetic example: not a real client or natal record.
const position = new Posizione({
  usa_posizione_manuale: true,
  posizione_manuale: { lat: -33.5, lng: 151.75, tz: 'Australia/Sydney' },
  citta_id: 101,
});

const latitude = position.getLat(); // -33.5
// Reading the latitude does not erase citta_id (or an existing citta).
```

If a host needs a **single-source serialized payload**, it should call
`resetCitta()` or `resetPosManuale()` **explicitly at the point where
it chooses to discard the inactive source**, not as a side effect of
displaying or reading the coordinates. This is the one deliberate
behavioral compatibility change: hosts that relied on automatic
inactive-field deletion during a getter call must migrate their
serialization logic.

## Regression test and limits

```sh
node --test tests/position-accessors.test.mjs
npm run check:types
npm run build:library
```

The Node test imports/transpiles the **actual** TypeScript model and
covers repeated city reads, repeated manual reads, toggling the source,
frozen-object reads, default values and the explicit reset methods.
All data is synthetic. The test is standalone to avoid conflicting
`package.json` edits across concurrent draft PRs.

An isolated Node v22.16.0 + TypeScript 5.8.3 verification of matching
GitHub blob files passed **4/4** tests; the prior getter behavior
failed **3/4** against the same test suite. Isolated
`tsc --noEmit --strict --target ES2022 --module ESNext` passed for the
model file. A full `npm ci`, Angular library/demo build, browser
rendering, downstream VirgoStars/Astrolabio integration and persistence
tests have **not** been run. No production migration is included.
