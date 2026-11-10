# Contributing to Astrological Charts

This repository is private and shared by invitation. Contributions with Codex, Claude Code, or other AI tools are welcome. The maintainer retains final review and merge control.

## Workflow

1. Create a feature branch from `main`, named `feat/...`, `fix/...` or `docs/...`.
2. Read `AGENTS.md` and current extraction status before modifying code.
3. Use synthetic fixture data, never real VirgoStars users' natal charts or credentials.
4. Make a focused change and add geometric/visual tests where possible.
5. Attempt `npm install` then `npm run build` from a clean checkout; report actual results and any missing assets. Do not claim passing tests if they were not executed.
6. Open a PR with scope, screenshots for rendering changes, test results, risks, and effects on website/Astrolabio.
7. Wait for maintainer approval. Do not merge or deploy without authorization.

## AI-assisted changes

AI-assisted contributions are welcome, but their author is responsible for reviewing generated code, licensing, security and correctness. Avoid full-repo rewriting agents that modify unrelated code. Never submit prompts or logs containing private data.

## Public release and intellectual property

The repository is private and has no open-source license at this stage. Do not relicense or publish it. Before accepting external contributions, establish written permission/terms allowing VirgoStars to use, modify, commercially distribute, and potentially open-source accepted contributions in future. Each contributor confirms they have the right to contribute their work and that new assets are properly licensed.

## Review gates

- correct layers, positions, symbols, house cusps, aspects and rotation;
- changes documented in public inputs/options;
- no regressions to natal, transits, synastry or latitude modes;
- no GPU resource leaks or abandoned animation timelines;
- no breaking asset paths for headless Astrolabio;
- no impact on live VirgoStars without separate reviewed integration.
