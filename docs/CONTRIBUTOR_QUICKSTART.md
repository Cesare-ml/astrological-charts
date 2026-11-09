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
