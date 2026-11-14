# Windows quickstart for invited collaborators

You need Git, Node.js compatible with Angular 20 and repository access via your GitHub account. No AWS/production credentials or VirgoStars database access are required.

```powershell
git clone https://github.com/Cesare-ml/astrological-charts.git
cd astrological-charts
powershell -NoProfile -File .\scripts\verify-local.ps1
```

The local verification script now **requires** the committed `package-lock.json`, runs `npm ci` and then `npm run verify:angular` (preflight, library build **and demo build**). It fails immediately if any step fails and writes `.local/verify-local-report.json` with the source commit, Node/npm versions, step exit codes and PASS/FAIL/NOT RUN results. For repeat local checks on an already installed worktree, pass `-SkipInstall`; the default is the reproducible clean install. See [local QA reporting](LOCAL_QA_REPORT.md).

The script does **not** start a browser, compare real artworks, check WebGL memory or run Astrolabio. It explicitly marks those gates **NOT RUN**; they require separate Chromium/Firefox and approved-device/asset verification before merge.

If PowerShell restricts script execution, open the script and run the documented `npm` commands manually rather than globally weakening security settings.

Before submitting changes, read `AGENTS.md` and `CONTRIBUTING.md`. Make a new branch, commit the focused fix and open a PR. Describe actual tests and limitations; do not merge or deploy.

## Optional real asset pack for contributors

The code repository does **not** include the production icons, ring textures or fonts. A successful `npm run build` will not automatically make the graphics demo work.

**Separate asset repository:** `Cesare-ml/astrological-assets` is publicly readable and contains an image pack and manifest. Public GitHub visibility **does not grant redistribution rights** to every artwork. Contributors can clone it without access to `virgo-stars`, but must follow the asset-specific rights policy:

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

The pack contains images only; it does not include the original font of unknown license. The [Angular demo](ANGULAR_DEMO.md) also works with locally generated synthetic assets. See [asset repository decision](INDEPENDENT_ASSETS_REPOSITORY.md).

## Immediate synthetic preview (does not require VirgoStars or real asset files)

```powershell
powershell -NoProfile -File .\scripts\preview-synthetic.ps1
```

Open `http://127.0.0.1:4177/__preview`. This generates 78 **original checkerboard PNG placeholders** with the exact preload filenames and a local verification manifest. The preview is an asset gallery only; it does not render a natal chart. When the separate asset repo contains images approved for the intended use, point the dev server at its `public/assets` **and** its `manifests/approved-assets.json`. Read [LOCAL_ASSET_PREVIEW.md](LOCAL_ASSET_PREVIEW.md).

For an interactive chart instead of the gallery, use `npm run demo:pack`, `npm run demo:assets` and `npm run demo` as described in [ANGULAR_DEMO.md](ANGULAR_DEMO.md).
