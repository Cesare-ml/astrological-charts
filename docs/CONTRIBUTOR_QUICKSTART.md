# Windows quickstart for invited collaborators

You need Git, Node.js compatible with Angular 20 and repository access via your GitHub account. No AWS/production credentials or VirgoStars database access are required.

```powershell
git clone https://github.com/Cesare-ml/astrological-charts.git
cd astrological-charts
git switch feat/import-virgostars-graphics
powershell -NoProfile -File .\scripts\verify-local.ps1
```

The local verification script runs a fresh dependency install (`npm ci` if a lockfile exists), static import and asset inventory checks, TypeScript validation and the Angular package build. It does **not** render a natal chart, check GPU memory or run Astrolabio.

If PowerShell restricts script execution, open the script and run the documented `npm` commands manually rather than globally weakening security settings.

Before submitting changes, read `AGENTS.md` and `CONTRIBUTING.md`. Make a new branch, commit the focused fix and open a PR. Describe actual tests and limitations; do not merge or deploy.

## Optional real asset pack for contributors

The code repository does **not** include the production icons, ring textures or fonts. A successful `npm run build` will not automatically make the graphics demo work.

**Proposed future mode:** when a separate, private `Cesare-ml/astrological-assets` repository exists and the maintainer has approved sharing its images, collaborators can clone that pack **without access to `virgo-stars`**:

```powershell
# Both repos should be sibling directories.
git clone https://github.com/Cesare-ml/astrological-assets.git
cd astrological-charts
node scripts/serve-local-assets.mjs --root ../astrological-assets/public/assets
```

The asset server binds only to `127.0.0.1:4177`. It serves GET/HEAD requests under `/assets/img/` and `/assets/fonts/`, permits CORS from the Angular development origin `http://localhost:4200` / `http://127.0.0.1:4200`, and does not support uploading or listing files. Set the library's development asset base to:

```ts
GestoreImmagini.configurePublicAssetsBase('http://127.0.0.1:4177/assets/');
```

**The assets repository has not yet been created** and the interactive Angular demo is still planned. The commands above describe the intended workflow, not a ready-to-run end-to-end demo. See [asset repository decision](INDEPENDENT_ASSETS_REPOSITORY.md). For code-only tasks, the local asset pack is not required.
