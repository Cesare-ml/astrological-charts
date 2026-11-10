# Build, dependency and baseline policy

The isolated library builds with the lockfile on Windows and Node 22.18.0. The renderer and its consumers still need visual tests; the original `virgo-stars` renderer remains the production implementation.

## Node and Angular

- Target Angular 20.3, TypeScript 5.8.3 and Three.js 0.170.0, matching original source.
- `@angular/core`, `@angular/common`, RxJS, Three.js, GSAP and Moment Timezone are peer dependencies, to avoid duplicated UI/runtime modules in consumers.
- `tslib` is a runtime dependency, while `@types/three` and the Angular compiler/build packages are development dependencies.
- `package.json` stays **private**. Do not publish to npm.

## Commands (run in a clean checkout)

```bash
node --version
npm --version
npm ci
npm run preflight
npm run build:library
npm run build:demo
```

The Windows `scripts/verify-local.ps1` wrapper runs exactly these quality gates and fails if the tracked lockfile is absent. It does **not** run a WebGL browser; `npm run test:latitude:local` is opt-in after the above commands.

The static checks are **not** substitute for the build or screenshot tests.
`npm run check:assets` is an inventory, not a proof that each image is present.

Keep evidence of actual results (Node/npm versions, lockfile, compiler errors). Do not put private API credentials, local absolute paths or real birth charts into output.

## Build and release gates

1. Reproducible build in a clean environment, committed lockfile.
2. Host-agnostic asset manifest and explicit resolution for browser/headless.
3. Synthetic fixture + screenshot regression across radix/transits/synastry/latitudes.
4. GPU resource cleanup test (repeated redraw/export).
5. Site and Astrolabio compatibility, version pin + rollback.
6. Maintainer approval, no unattended deployment or updates.

Do not change the framework or silently refactor the visual geometry.
