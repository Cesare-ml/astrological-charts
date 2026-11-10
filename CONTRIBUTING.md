# Contributing to Astrological Charts

**You may contribute even if you do not know how to code.** The
repository was designed for people who can describe a visual idea to
an AI coding assistant, review screenshots and ask for changes.
Please start with [the beginner guide](docs/START_HERE.md).

## First-time contributors

1. Download or clone the repository. Run `START_HERE.cmd` on Windows,
   or follow the [command-line quickstart](docs/START_HERE.md).
2. Tell an AI what you would like to change and attach a screenshot.
   Ask the AI to read `AGENTS.md` and the docs before editing.
3. Keep changes on a new `feat/...`, `fix/...` or `docs/...`
   branch. Never edit production VirgoStars or deployed Astrolabio.
4. Use fake/deterministic input coordinates in tests. Do not commit
   real users' birth information, secrets or private asset packs.
5. Have the AI run `npm run preflight`, `npm run build`, and,
   when needed, `npm run build:demo` and browser visual tests.
   If a test cannot run, say so in the pull request.
6. Open a **draft pull request**. Explain the visual change and attach
   before/after screenshots when appropriate. The maintainer
   controls review, approval and merge.

**Short AI prompt:** “Read AGENTS.md and README.md first. I'm new to
coding. Implement [my idea] on a new branch, preserving the renderer's
public API, CPAL-1.0 credits and independent asset architecture.
Explain each step in plain English, run tests, and open a draft PR.
Do not deploy, merge or publish.”

## Python contributors

You do not need Angular knowledge just to render existing charts:
[Python integration](docs/PYTHON_INTEGRATION.md) explains the
`schemaVersion: 1` JSON contract. Your own program may calculate
coordinates and feed them into the library to generate PNG/JPEG.

If you need a **new chart type or visual option**, propose an
extension to the versioned JSON format and implement the matching
Angular rendering behavior. Keep astronomy/house algorithms out of
this repository; they belong in their own libraries.

## AI-generated work and testing

AI assistance is welcome. Contributors are still responsible for
reviewing generated source, dependencies, licensing, security,
correctness and screenshots. Describe precisely which tests were
actually executed. A PR without a local browser check must not claim
pixel parity. Do not modify unrelated files, introduce external
network calls, enable GitHub Actions, or add automatic releases.

## License, artwork and contributor rights

The original covered source code is released under
[CPAL-1.0](LICENSE), including VirgoStars attribution under Exhibit B.
Contributions to covered files should be offered under compatible
CPAL-1.0 terms and preserve source notices. State the origin of any
borrowed code, verify you can submit it, and record modifications with
dates as required by the license. **Do not copy private art,
unknown-license fonts or brand assets into the repo.** Publicly
visible assets are not automatically licensed for redistribution.

Contributors retain copyright where applicable. Contributions under
CPAL do **not** automatically grant the owner permission to relicense
everyone's code later. A separate contributor rights agreement may
be needed if future relicensing is desired.

The maintainer is still performing a
[public release audit](docs/PUBLIC_RELEASE_CHECKLIST.md): the
repository remains private until explicitly approved. No outside
contributor should change GitHub visibility or publish packages.

## Compatibility and review gates

- Correct zodiac rings, house cusps, planet symbols, rotation,
  aspect lines and all four chart modes.
- Stable public Angular imports and `schemaVersion: 1` JSON input.
- No accidental replacement of missing real coordinates with fake
  positions or silently accepted malformed JSON.
- Asset manifest/hash verification, rights clearance and no asset
  duplication across repositories.
- No regressions in PNG export, browser UI, mobile layout or
  resource cleanup after repeated render/export.
- No change to the live VirgoStars website or Astrolabio hardware
  without separate explicit integration approval.

Full PR description: goal; changed files; visual before/after;
test commands and results; remaining risks; rollback; upstream and
device compatibility; and how AI was used.
