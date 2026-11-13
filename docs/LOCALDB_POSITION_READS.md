# LocalDB position reads must not discard inactive coordinates

The Astrolabio-oriented `PosizioneLocalDB` model carries a city
(`citta` / `citta_id`) and optional manually entered coordinates
(`posizione_manuale`). `usa_posizione_manuale` chooses the active
source for `getLng()`, `getLat()` and `getTz()`.

## Issue

Before this fix, **every getter call** silently deleted the inactive
source, via `resetCitta()` or `resetPosManuale()`. In particular,
`TemaLocalDB.getDataoraUtc()` asks the position for its time zone
and could therefore discard city/manual metadata during a read-only
date conversion. A user switching between a saved city and manual
coordinates then lost the previously selected values.

The getters now read only the active source. Their return values,
nullish defaults, selection flag and method names are unchanged.
The explicit `resetCitta()` and `resetPosManuale()` methods remain
available for intentional deletion.

This is a **behavioral compatibility change** for any host relying on
a getter to remove inactive data before serialization. Such a host
must now explicitly reset the inactive source at the persistence
boundary. Do not modify production Astrolabio storage without
reviewing those callers.

This PR mirrors the independently proposed web-model change in
[PR #68](https://github.com/Cesare-ml/astrological-charts/pull/68)
but edits a separate file, with standalone tests. Neither PR
deploys the model to VirgoStars or shipped Astrolabio devices.

## Focused verification

```sh
node --test tests/localdb-position-accessors.test.mjs
```

The test transpiles the actual `PosizioneLocalDB` and
`CittaLocalDB` TypeScript source with the repository's TypeScript
dev dependency. Four cases cover repeated reads, switching sources,
frozen-object safety and explicit reset/fallback behavior.
All location fixtures are synthetic.

**Executed in an isolated Node v22.16.0 / TypeScript 5.8.3
workspace with exact GitHub blob content:**
- Changed model blob `7ac8bae02a324eb19a135d3f7086e02d66693bc5`.
- New test blob `928ee0e45bf3d219d12ca28dc062a937c9e370db`.
- Corrected model: 4/4 PASS, `node --test` exit 0.
- Original `main` model blob
  `089f2c2d405e3d853653fdd5c1ebaa4d70f6c090`:
  1/4 PASS and 3/4 FAIL under the same tests, exit 1.
- Isolated typecheck with repository-compatible `strict: false`
  passes. The existing model has unrelated `strict: true` errors
  (`_ObjId` field initialization, optional `stato`), not introduced
  or addressed in this scoped fix.

**Not executed:** `npm ci`, complete `npm run preflight`,
`npm run check:types`, Angular library/demo builds,
Chromium/Firefox/WebGL, production date conversions, Astrolabio
persistence and hardware checks. These remain review gates.

No application secrets, user charts, source images, fonts or
production assets are included. No automatic merge, deployment,
npm release or GitHub Actions is authorized by this PR.
