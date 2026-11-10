# Architecture decision — separate chart asset repository

**Status: implemented for private collaboration; not migrated into the
live VirgoStars website or Astrolabio.** The dedicated
[`Cesare-ml/astrological-assets`](https://github.com/Cesare-ml/astrological-assets)
repository is currently **private**, containing image files the owner
has authorized for **private collaboration** and a SHA-256 manifest.
It does not contain the original font of unresolved license status.
The website's production asset owner remains
`Cesare-ml/virgo-stars/public/assets`.

This decision addresses a real contributor requirement: someone with
access to `astrological-charts` must be able to inspect rendered
graphics without needing access to the private `virgo-stars`
application, backend or user data.

## Why the Angular package alone is not enough

The existing Three.js code loads external resource URLs.
Successful compilation does not guarantee actual symbol and
texture availability. Planet, zodiac, house and skin artwork
are essential for reproducing the original chart appearance.

Ways to provide asset access:

| Option | Needs VirgoStars repository access? | Works offline? | Limitations |
| --- | --- | --- | --- |
| Public `virgostars.it/assets/...` URLs | No | No | Depends on website uptime and CORS. Do not silently depend on the live site for tests |
| Private `astrological-assets` repository | No, but requires an asset repository invitation | Yes | Requires permission checks for each redistributed file |
| Generated synthetic or independently redistributable fixtures | No | Yes | Does not reproduce production skin artwork |

**Preferred arrangement:** an independently reviewed, private
asset pack for invited collaborators and locally generated
synthetic fixtures for everyone else. Public image URLs should
not be a mandatory hidden test dependency.

## Repository separation

```text
astrological-charts/                  # Angular/Three.js source; no real artwork
  src/
  tests/
  scripts/serve-local-assets.mjs

astrological-assets/                  # Separate, versioned private asset pack
  README.md
  catalog/approvals.json
  public/assets/
    img/
      simboli-bianchi/
      simboli/
      grafici/
      textures/
      risuonatore-solare-*.png      # Rights-reviewed files only
    fonts/                         # Only if individually cleared
  manifests/
    approved-assets.json           # Asset metadata; no personal data
```

This layout describes the intended organization; the actual pack
currently contains an authorized image subset and **no original
unknown-license font**. Do not copy the whole `virgo-stars/public`
directory, which contains unrelated and potentially differently
licensed resources. Preserve exact relative paths, spelling, letter
casing and formats because the renderer uses them as resource keys.

The CPAL-1.0 source-code license for Astrological Charts does **not**
grant public distribution rights for these separately owned images
or fonts. Permission to share privately is not automatically a
license to republish files in a public GitHub repository.

## Contributor without the production application

An invited collaborator may access only the renderer source
(`astrological-charts`) and the approved image repository
(`astrological-assets`), without seeing production backends,
credentials or VirgoStars users' birth charts.

```powershell
git clone https://github.com/Cesare-ml/astrological-charts.git
git clone https://github.com/Cesare-ml/astrological-assets.git

cd astrological-charts
npm ci
npm run demo:assets:repo
```

The development server serves approved files under
`http://127.0.0.1:4177/assets/...` and limits HTTP methods and
allowed browser origins. It requires **no** AWS account, backend
endpoint, production password or access token.

The local Angular demo can select this base URL:

```ts
GestoreImmagini.configurePublicAssetsBase('http://127.0.0.1:4177/assets/');
```

Use this setting **only for local development**, never as a change
to the live website. The server is not a public CDN or a
production service. See [Angular demo](ANGULAR_DEMO.md).

Contributors without private asset access can run
[the synthetic gallery](LOCAL_ASSET_PREVIEW.md) and demo instead.

## Keep a single copy in each VirgoStars build

**Today:** `virgo-stars/public/assets` is the source of images
actually served by the website.

**During a future migration:** a temporary duplicate in two source
repositories may exist. Track its checksums and removal plan,
but ensure that the Angular build does not package two copies
of the same graphics.

**After an explicitly approved migration:** `astrological-assets`
could become the single source of relevant chart artwork.
VirgoStars would use a **pinned version** of that repository,
for example through a reviewed Git submodule in
`vendor/astrological-assets` or a manually verified release archive.
A single Angular asset copy rule would then place the selected
files into `/assets/`. Remove overlapping old files first,
and verify the final deployment manifest.

Unrelated website resources (the site logo, generic UI media,
tarot imagery and other content) remain in VirgoStars itself.
**No `angular.json`, production deployment script or hardware
device is modified by this decision.**

## Offline Astrolabio

Each offline device needs **its own local copy** of the subset of
assets required by its pinned renderer version. It cannot
physically share the website's hosted files while offline.
Generate the device subset from an approved manifest, verify
integrity and support version rollback.

The existing Astrolabio backend uses a separate Node.js-driven,
offline Firefox `file://` rendering adapter; it is **not**
equivalent to the Chromium developer bridge for generic Node/Python
callers. See [Node integration](NODE_INTEGRATION.md) and
[integration plan](INTEGRATION_PLAN.md).

## Rights and release requirements

Before filling or privately sharing an asset pack:

1. Keep the asset repository private and give access only to
   authorized collaborators. Restrict write access to editors
   actually managing assets.
2. Include only resources whose provenance and permitted uses
   have been documented. Do not publish unknown-license fonts,
   stock textures or branding merely because they are available.
3. Preserve file paths, case-sensitive names, spaces and exact
   file formats expected by the renderer.
4. Maintain SHA-256 checksums and a reviewable rights/permission
   inventory with **no personal user data**.
5. Protect the main branch with review rules; do not add automatic
   GitHub Actions, deployment or publication.
6. Test both the site and chart exports before removing any
   original files from the production-owned folder.

## What has been implemented

The `astrological-charts` repository includes a **local
manifest-verified asset server**, and tests allowing an independent
asset directory without any clone of the `virgo-stars` application.
An authorized private image pack and Angular rendering demo
are available. Automated production import, public CDN distribution,
and production cutover are **not enabled**.

The decision to make either repository public is separate and
requires a rights audit. Do **not** assume that an authorized
private pack is ready for open-source redistribution.

## Important GitHub collaborator permission note

In a personal GitHub account's private repository, the available
collaborator permissions may include write access rather than a
strict read-only role. If separate read-only permissions are
required, consider moving the asset collaboration repository to
a GitHub organization with managed roles before inviting people.
**Private does not mean read-only.**

## Independent preview evidence

The `scripts/preview-synthetic.ps1` script creates 78 **original
generated checkerboard** PNGs in git-ignored `.local/` and
serves a manifest-verified preview at
`http://127.0.0.1:4177/__preview`. The separate Angular
demo can also run with a privately approved pack without
production source access. See [LOCAL_ASSET_PREVIEW.md](LOCAL_ASSET_PREVIEW.md).

Actual migration to the website or hardware is a separate,
reviewed and tested decision.
