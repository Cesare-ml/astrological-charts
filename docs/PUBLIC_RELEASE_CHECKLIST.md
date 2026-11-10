# Public release checklist

**Status: NOT CLEARED.** The maintainer plans to publish this repository,
but a `LICENSE` file by itself is not permission to publish every
tracked file. Do not flip the GitHub visibility, publish npm packages or
release host artwork until each gate below has been reviewed.

- [ ] Confirm the initial developer owns or has redistribution rights
      for every extracted TypeScript/Angular/Three.js source file, every
      copied documentation excerpt and every fixture. Record third-party
      provenance and any contributor permissions.
- [ ] Verify `LICENSE` is the unmodified CPAL-1.0 legal text with only
      owner-specific Exhibits A/B completed; check CPAL source notice
      placement in files and directories (Section 3.5).
- [ ] Audit `package-lock.json`, dependencies, copied snippets and
      relevant license files. Prepare applicable third-party notices.
- [ ] Ensure no original font, restricted artwork, images, tokens, credentials,
      private data, birth dates, user records, server URLs or internal
      operational documents leak through source, docs, branches or Git history.
- [ ] Keep `astrological-assets` independent. Its image pack is not
      automatically publicly redistributable; its private approval
      manifest is not a public redistribution license.
- [ ] Run `npm ci`, `npm run preflight`, `npm run build`,
      `npm run build:demo`, and a local synthetic browser export. Test
      a fresh public-reader checkout with no private dependencies.
- [ ] Verify that concurrent Node.js requests from the same process
      are serialized, that a failed request does not poison the queue,
      and that multi-process/persistent backend rendering remains
      explicitly unsupported until separate stress and locking tests.
- [ ] Run `npm run test:node-concurrency` and
      `npm run test:node-adapter`,
      `npm run test:local-render-services`,
      `npm run test:local-process-lifecycle`, and `npm run test:node-types`,
      then the programmatic
      Node.js-to-JSON-to-PNG example, and the Python-to-JSON-to-PNG
      example using the real demo,
      then verify the output dimensions and JPEG conversion.
- [ ] Run `npm run test:validate-chart-input`,
      `npm run test:chart-cli-validation` and
      `npm run test:chart-input` to verify matching Node/Python
      and Angular acceptance/rejection rules, including zero-degree
      latitude and missing transits/synastry. Both are browser-free;
      also test malformed JSON via the real CLI before release.
- [ ] Run `npm run test:render-bridge` with a real Chrome/Chromium
      browser and working WebGL; confirm the natal/light PNG and
      transits/dark JPEG are both 1600×1600 and nonblank. This is
      manual, not part of preflight. Then separately run the Python
      wrapper and record the tested OS/browser.
- [ ] Test the Astrolabio Node.js + offline Firefox `file://`
      adapter separately; never confuse the Chromium local demo with
      offline/e-ink device compatibility.
- [ ] Ensure README, beginner/contributor instructions and remaining
      public-facing guides (including older Italian asset/reference docs)
      are fully reviewed and available in English.
- [ ] Review new public issues/PR templates, attribution display in
      the demo and any applicable launch/session branding under CPAL.
- [ ] Review outstanding draft PRs and resolve incompatible changes.
- [ ] Explicitly approve public visibility only after the audit,
      with a rollback plan and source-availability obligations.

The repository is **not** the live VirgoStars site; public release
must not change production integrations or deployed Astrolabio devices.
