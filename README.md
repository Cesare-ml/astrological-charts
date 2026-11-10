# Astrological Charts

**Free, open-source-ready astrological chart drawing software from
[VirgoStars](https://www.virgostars.it/)** — Angular 20, TypeScript
and Three.js. Source-code license: **CPAL-1.0** with required
VirgoStars attribution (see [LICENSE](LICENSE) and [NOTICE](NOTICE)).

**Release status:** this repository is still **private** while source,
dependency, artwork and contributor permissions are reviewed.
The license and collaboration guides have been prepared for a future
public release. This package is not yet a published stable API,
integrated with VirgoStars production or approved for Astrolabio
deployment. Follow [the release checklist](docs/PUBLIC_RELEASE_CHECKLIST.md)
before changing repository visibility.

## You do not need to be a programmer

**On Windows:** install Node.js 22 LTS and Chrome, download/clone this
repository, then double-click **`START_HERE.cmd`**. It prepares a
safe synthetic image pack and launches the interactive demo at
http://127.0.0.1:4200/.

**On any platform:**

```sh
npm ci
npm run demo:pack
# Terminal 1
npm run demo:assets
# Terminal 2
npm run demo
```

Read **[Start here — a beginner's guide](docs/START_HERE.md)** for
download instructions, screenshots, troubleshooting and a ready-to-copy
prompt for AI coding assistants.

## Draw from Python — PNG or JPEG

The renderer **does not compute planetary positions**. Feed it
precomputed longitude/latitude coordinates, angles and house cusps
from Python (or another language) and it produces a graphic with the
existing Three.js engine.

```sh
npm ci
python examples/python/example.py
python examples/python/example.py --jpg
```

Output: `.local/python-example.png` or `.local/python-example.jpg`.

The sample coordinates and house cusps are deliberately invented for
demonstration; they are **not real ephemerides**. The Python helper
uses the standard library and delegates rendering to a local
headless Chrome/Angular demo; no Python reimplementation of the
drawing engine is needed.

See [Python integration, JSON v1 format and troubleshooting](docs/PYTHON_INTEGRATION.md).
You can also import a JSON chart manually in the demo and click
**Export PNG**. The forthcoming
[VirgoStars-Ephemeris](https://github.com/Cesare-ml/VirgoStars-Ephemeris)
Python/Rust bindings are not yet available; this bridge is ready to
accept their numeric output when they exist.

## What this library contains

- Actual Three.js charts for natal themes, transits, synastry and
  ecliptic latitudes, with multiple skins and browser PNG export.
- An independent Angular development demo, synthetic fixtures and
  deterministic preview assets.
- A versioned JSON interoperability contract and Python wrapper,
  with local PNG/JPEG conversion for non-Angular programs.
- A manual test/build workflow and contribution rules; no automatic
  production deployments.

It **does not** contain an astronomy engine, a house-calculation
engine, predictions, the VirgoStars user database or private accounts.
Astrology computations belong in
[VirgoStars-Ephemeris](https://github.com/Cesare-ml/VirgoStars-Ephemeris)
(Rust astronomical source) and
[astrological-functions](https://github.com/Cesare-ml/astrological-functions)
(astrological logic). Those integrations are separate work.

## Artwork is intentionally separate

The renderer requests symbol and texture files from an asset server.
Only original **generated placeholders** are provided for a public
reproducible demo. The independently maintained
`astrological-assets` repository contains an owner-authorized
private image pack with a signed-off manifest, **not automatically
licensed for public redistribution**, and excludes the original font.
Never copy it into this repository or hotlink live production assets.

See the [asset architecture](docs/SHARED_ASSET_ARCHITECTURE.md),
[asset manifest rules](docs/ASSET_MANIFEST.md),
[local preview](docs/LOCAL_ASSET_PREVIEW.md) and
[Angular demo](docs/ANGULAR_DEMO.md).

## Develop and contribute

You can ask an AI assistant to make interface changes without
understanding TypeScript. Give it the
[beginner guide](docs/START_HERE.md), [AGENTS.md](AGENTS.md),
[CONTRIBUTING.md](CONTRIBUTING.md) and a screenshot of your idea.
It should work on a separate branch, run tests, and ask the maintainer
to review the resulting draft PR. **Do not merge, deploy or publish
without approval.**

After `npm ci`, useful manual checks are:

```sh
npm run test:chart-input
npm run preflight
npm run build
npm run build:demo
```

Browser visual tests require the two local servers and Chrome/Firefox
as explained in [the demo guide](docs/ANGULAR_DEMO.md).
A successful compilation alone is **not** proof of the same pixels
as the original production artwork or correct astronomy.

## Technical documentation

- [Start here — Windows, AI assistants and Python](docs/START_HERE.md)
- [Python JSON contract and output formats](docs/PYTHON_INTEGRATION.md)
- [Architecture and renderer boundaries](docs/ARCHITECTURE.md)
- [Extraction and compatibility status](docs/EXTRACTION_STATUS.md)
- [Upstream origin](docs/UPSTREAM_PROVENANCE.md)
- [Dependency/build policy](docs/BUILD_AND_DEPENDENCIES.md)
- [Angular demo and browser tests](docs/ANGULAR_DEMO.md)
- [Multi-repository integration and blockers](docs/MULTIREPO_INTEGRATION_CHECKPOINT.md)
- [Public release readiness](docs/PUBLIC_RELEASE_CHECKLIST.md)
- [CPAL-1.0 license and credits](docs/LICENSING_AND_CREDITS.md)
- [Technical reference docs](docs/reference/README.md)

## Licensing and credits

The covered source code is licensed under the
[Common Public Attribution License 1.0](LICENSE). It is **free of
license fees**, including commercial covered-code use under the
license terms. Exhibit B specifies the following attribution even for
Larger Works, as described by the license:

```text
Copyright (c) 2026 Cesare-ml (VirgoStars project)
Powered by VirgoStars
https://www.virgostars.it/
```

For GUI applications, **CPAL Section 14** requires prominent
attribution at launch/session start. A Credits/About entry with a
link is welcome but may **not** by itself satisfy that rule.
Section 15 also concerns network use and source availability.
Generated image outputs are not automatically required to carry a
permanent watermark. See [licensing guidance](docs/LICENSING_AND_CREDITS.md)
and the full license for actual conditions.

The source was extracted from the VirgoStars `grafici-astrologici`
package. The production site and shipped Astrolabio devices continue
using their existing code until separately tested and approved.
