# Start here — no programming experience needed

This repository provides the chart **drawing** part of VirgoStars.
It does **not** calculate planet positions or house cusps. You can
explore its interactive demo, suggest interface changes to an AI
assistant, or use Node.js **or** Python programs to make PNG/JPEG images.

The code is free and carries CPAL-1.0 source/attribution obligations.
The real VirgoStars artwork and fonts are **not bundled**. The initial
demo uses generated placeholder images, so its visuals are different.

## 1. Get the demo running (Windows)

1. Install **Node.js 22 LTS** from https://nodejs.org/ and **Google
   Chrome**. Git is optional if you download the repository ZIP.
2. Click **Code → Download ZIP** on GitHub and extract the folder; or
   run `git clone https://github.com/Cesare-ml/astrological-charts.git`.
   The project is currently private and needs an invitation until
   the maintainer makes it public.
3. Double-click **START_HERE.cmd** from the extracted folder.
4. Open **http://127.0.0.1:4200/** if it does not open automatically.
   Two local windows run the image server and the demo. Leave them
   open while experimenting; close them to stop the demo.
5. Choose a mode, theme/skin, and click **Export PNG**.

No cloud account, AWS key or VirgoStars production access is needed.
First setup downloads JavaScript dependencies from npm.

**Alternatively on macOS/Linux** (or if the Windows launcher fails):

```sh
npm ci
npm run demo:pack
# Terminal 1:
npm run demo:assets
# Terminal 2:
npm run demo
```

Open http://127.0.0.1:4200/. Only the first two setup commands
need to be repeated when reinstalling dependencies/regenerating assets.

## 2. Generate an image from Node.js or Python

If you already work in JavaScript/Node.js, **no Python installation
is needed**. With Node.js and Chrome installed:

```sh
npm ci
node examples/node/example.mjs
node examples/node/example.mjs --jpg
```

The generated files are `.local/node-example.png` and
`.local/node-example.jpg`. These are synthetic charts with invented
positions. Read the
[Node.js integration guide](NODE_INTEGRATION.md) to pass the output
of your own JavaScript calculations into `renderChart()`.

### Show original artwork from your authorized local checkout

The normal example deliberately uses synthetic checkerboard icons. If
you have the private, separately approved `astrological-assets`
repository next to `astrological-charts` on your own computer, you
can explicitly request its original images without copying them:

```powershell
node examples/node/example.mjs --approved-assets
```

This creates `.local/node-example-approved.png`. The script verifies
the external asset manifest against the actual binary files and stops
if port 4177 belongs to another process. Close any old asset server
**you** started before running it. The original assets remain private
and are not published or downloaded by this command. See
[NODE_INTEGRATION.md](NODE_INTEGRATION.md) for additional details.

### Alternatively, from Python

Install Python 3.10+ and run once:

```sh
npm ci
python examples/python/example.py
```

Look for `.local/python-example.png`. For JPEG use:

```sh
python examples/python/example.py --jpg
```

Both the Node and Python examples automatically start the local
demo and asset server if not running. The example numbers are **made up**, not an accurate birth
chart. To use coordinates computed in your own Python script, read
[Python integration](PYTHON_INTEGRATION.md). The planned Python bindings
for VirgoStars-Ephemeris do not exist yet.

## 3. Ask an AI to create features or improve the interface

You can copy this request into Codex, ChatGPT, Claude Code or another
coding assistant after giving it access to your **own** checkout:

> I'm a non-programmer. This is the open-source Astrological Charts
> project. Read AGENTS.md, README.md, CONTRIBUTING.md and the
> architecture/extraction docs first. Explain to me in plain English
> what I must install and how I can run the demo. Help me implement
> [DESCRIBE MY IDEA] without changing astronomy calculations,
> production VirgoStars, or the private image assets. Work on a
> separate branch, use safe synthetic test data, keep CPAL-1.0
> attribution, run the relevant tests, show screenshots of visual
> changes, and prepare a draft pull request. Tell me exactly what
> passed, what wasn't tested, and what I should click next. Do not
> merge, deploy or publish anything.

A good request includes a screenshot, the screen area you want to
change, expected behavior and whether it should work in PNG exports.

## What AI tools should know

- **The renderer:** Angular 20 + TypeScript + Three.js.
- **The calculation source:** elsewhere, not in this renderer.
- **Data format:** shared JSON version 1, documented in
  [Node integration](NODE_INTEGRATION.md) and
  [Python integration](PYTHON_INTEGRATION.md).
- **Source code license:** CPAL-1.0 with prominent VirgoStars credits.
- **Safety:** no production data, no real birth records, no deploys,
  no publication of copyrighted artwork or fonts.
- **Ownership:** contributions are reviewed by the maintainer.
- **Validation:** `npm run preflight`, `npm run build`, `npm run
  build:demo`, and browser screenshots when images are affected.

If an automated PNG/JPEG command says port 4177 or 4200 is already
in use, close the unrelated local server and try again. The exporter
refuses to use an unknown asset pack or a different web app.

If a command fails, copy the exact console error to your assistant
rather than guessing or deleting repository files.

## Need a human to review your changes?

See [CONTRIBUTING.md](../CONTRIBUTING.md). Anyone can propose an idea
in an issue once the repository is public; code changes should come
through a feature branch and a draft pull request.
