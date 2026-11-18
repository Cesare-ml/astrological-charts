# Per-chart options: prevent shared mutable state

`defaultOpzioniGrafico` remains a **legacy shared object** for compatibility.
It has nested mutable maps and a `Settaggi` instance with further nested
mutable state. Spreading it shallowly does **not** isolate these values:

```typescript
// Do not use this for two independently controlled charts:
const chartA = { ...defaultOpzioniGrafico };
const chartB = { ...defaultOpzioniGrafico };
chartA.sinastria.invertiTemi = true; // also changes chartB
```

Use the additive public factory when starting a fresh chart instance:

```typescript
import { createDefaultOpzioniGrafico } from 'grafici-astrologici';

const natalOptions = createDefaultOpzioniGrafico();
const transitOptions = createDefaultOpzioniGrafico();

natalOptions.settaggi.skin_id = 'dark';
natalOptions.sinastria.invertiTemi = true;
// transitOptions remains unchanged.
```

Each call builds a fresh `OpzioniGrafico` with its own nested maps and a new
`Settaggi` class object graph; no JSON round-trip, `structuredClone` or
shallow copy is used. This maintains the original class methods and avoids
browser-specific clone requirements. The previous
`defaultOpzioniGrafico` export and its initial values stay available; **the
factory does not migrate existing consumers automatically**.

## Regression verification

```shell
node --test tests/default-chart-options.test.mjs
npm run check:types
npm run build:library
```

The focused test loads the **actual** TypeScript models with the repo's
TypeScript dev dependency using a temporary in-memory CommonJS transpilation
harness. It checks value parity, class identity, disjoint nested reference
graphs and mutation isolation. It does not exercise browser rendering,
WebGL/PNG geometry, race conditions or Astrolabio hardware.

A full clean-checkout build and visual validation are required before merging.
No consumer import migration, site deployment, npm publication, artwork
redistribution or production configuration changes are included in this PR.
