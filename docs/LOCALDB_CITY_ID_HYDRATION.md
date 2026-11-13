# LocalDB city identifier hydration

`CittaLocalDB` declares an `_ObjId` field for its persisted city
identity, but its constructor previously copied the other city fields
without assigning that identifier. Reconstructing a city or its parent
`PosizioneLocalDB` from a plain saved record consequently lost
`citta._ObjId`, even if `citta_id` remained available separately.

The constructor now initializes:

```ts
this._ObjId = obj?._ObjId ?? -1;
```

**Behavior:** valid numeric IDs, including `0`, are preserved. Missing
or nullish IDs receive the existing model convention of `-1` for
an unknown record, rather than the previously implicit `undefined`.
The other city fields, position defaults, coordinate getters and
explicit reset methods are unchanged.

The change is stacked **on PR #70**, which prevents those getters from
deleting the inactive city or manual coordinates. Together they
preserve both the stored city data and its identity while switching
modes. The two PRs should be reviewed and merged in parent-first
order; this stacked PR must not independently target `main` before
PR #70 is integrated.

## Synthetic regression

Run from a complete checkout of this stacked branch:

```sh
npm ci
node --test tests/localdb-city-id.test.mjs
npm run check:types
npm run build:library
```

`tests/localdb-city-id.test.mjs` compiles the **actual** TypeScript
model using the repository's `typescript` dependency and tests:
- `_ObjId` and existing location values survive constructor hydration.
- An ID of `0` is valid; missing/nullish IDs become `-1`.
- A nested `PosizioneLocalDB` preserves `citta_id` and `citta._ObjId`.
- A synthetic JSON save/restore and manual/city mode switch retain
  identity and both coordinate sources.

**Executed in an isolated local Node 22.16.0 / TypeScript 5.8.3
workspace** with files whose Git blob hashes exactly match the GitHub
branch:
- Model: `4c59d55f38a1399e34c6d96bd6294dee29f802fd`.
- Test: `e75bfd5ae7fddbab58bb7f170d1b2cd2a1356afd`.
- Fixed model: **4 tests passed**, `node --test` exit 0.
- Parent PR #70 model (Git blob
  `7ac8bae02a324eb19a135d3f7086e02d66693bc5`):
  **4 tests failed**, exit 1, confirming that the tests detect the
  missing identifier assignment.
- Isolated TypeScript check under repository-compatible
  `strict: false`: **PASS**, exit 0.

This is not a complete checkout validation. Full `npm ci`,
`preflight`, library and Angular demo builds, real browser WebGL,
VirgoStars/Astrolabio persistence consumers and hardware testing
remain **NOT RUN**.

No personal chart/location records, external assets, fonts, database
access, migrations, build workflows, GitHub Actions, npm publication
or production deployment are included. Review whether the `-1`
sentinel matches every downstream persisted-ID consumer before merge.

## TemaLocalDB consumer regression (added 2026-11-14)

The new standalone `tests/localdb-theme-hydration.test.mjs` also
transpiles and executes the **real** `TemaLocalDB` and
`PosizioneLocalDB` constructors and `TemaLocalDB.getDataoraUtc()`
method. The test injects a tightly scoped `moment-timezone` spy,
allowing it to verify the supplied local date/time, active IANA
timezone, `.utc().format('YYYY-MM-DD HH:mm:ss')` call sequence and
absence of **any serialized theme mutation**, without needing an
Angular application or a browser.

It covers nested `_ObjId` preservation, both city/manual location
sources, switching the active source, and restoring a full synthetic
theme through JSON. It intentionally **does not** validate real
UTC arithmetic, daylight saving transitions, timezone database
accuracy, or real Astrolabio persistence.

```sh
node --test tests/localdb-city-id.test.mjs tests/localdb-theme-hydration.test.mjs
```

The new test was executed with **Node 22.16.0 and TypeScript 5.8.3**
against exact GitHub file contents: `TemaLocalDB`
`f9490b5f2c20da6bf8fb16f7cdcf2a18fd46495e`,
`PosizioneLocalDB` `4c59d55f38a1399e34c6d96bd6294dee29f802fd`,
and test `1c4dddd27d5c14f586b59c48a2925b71e6ad12b4`.
Result: **4/4 PASS, exit 0**. Replacing the position model with
the unmodified parent PR #70 version
`7ac8bae02a324eb19a135d3f7086e02d66693bc5`
gave **0/4 PASS, exit 1** on the same test, confirming the identity
regression is detected. This remains isolated-source validation,
not a full project build or actual Moment integration test.

