# Windows quickstart for invited collaborators

You need Git, Node.js compatible with Angular 20 and repository access via your GitHub account. No AWS/production credentials or VirgoStars database access are required.

```powershell
git clone https://github.com/Cesare-ml/astrological-charts.git
cd astrological-charts
powershell -NoProfile -File .\scripts\verify-local.ps1
```

The local verification script runs a fresh dependency install (`npm ci` if a lockfile exists), static import and asset inventory checks, TypeScript validation and the Angular package build. It does **not** render a natal chart, check GPU memory or run Astrolabio.

If PowerShell restricts script execution, open the script and run the documented `npm` commands manually rather than globally weakening security settings.

Before submitting changes, read `AGENTS.md` and `CONTRIBUTING.md`. Make a new branch, commit the focused fix and open a PR. Describe actual tests and limitations; do not merge or deploy.

## Optional real asset pack for contributors

The code repository does **not** include the production icons, ring textures or fonts. A successful `npm run build` will not automatically make the graphics demo work.

**Private repository now exists:** `Cesare-ml/astrological-assets` has integrated [PR #1](https://github.com/Cesare-ml/astrological-assets/pull/1) with metadata, rights reviews and tooling, but no original image files. When the owner has approved and imported the actual graphics, contributors may clone that pack **without access to `virgo-stars`**:

```powershell
# Both repos should be sibling directories.
cd ..
git clone https://github.com/Cesare-ml/astrological-assets.git
cd astrological-charts
node scripts/serve-local-assets.mjs --root ../astrological-assets/public/assets --manifest ../astrological-assets/manifests/approved-assets.json
```

The asset server binds only to `127.0.0.1:4177`. It serves GET/HEAD requests under `/assets/img/` and `/assets/fonts/`, permits CORS from the Angular development origin `http://localhost:4200` / `http://127.0.0.1:4200`, and does not support uploading or listing files. Set the library's development asset base to:

```ts
GestoreImmagini.configurePublicAssetsBase('http://127.0.0.1:4177/assets/');
```

**The asset repository exists but its original image/font files have not yet been imported.** The real-pack command above is therefore a future workflow. The [Angular demo](ANGULAR_DEMO.md) already works with locally generated synthetic assets. See [asset repository decision](INDEPENDENT_ASSETS_REPOSITORY.md).

## Immediate synthetic preview (does not require VirgoStars or real asset files)

```powershell
powershell -NoProfile -File .\scripts\preview-synthetic.ps1
```

Open `http://127.0.0.1:4177/__preview`. This generates 78 **original checkerboard PNG placeholders** with the exact preload filenames and a local verification manifest. The preview is an asset gallery only; it does not render a natal chart. When the private asset repo contains approved images, point the dev server at its `public/assets` **and** its `manifests/approved-assets.json`. Read [LOCAL_ASSET_PREVIEW.md](LOCAL_ASSET_PREVIEW.md).

For an interactive chart instead of the gallery, use `npm run demo:pack`, `npm run demo:assets` and `npm run demo` as described in [ANGULAR_DEMO.md](ANGULAR_DEMO.md).
