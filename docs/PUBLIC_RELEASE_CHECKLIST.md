# Public release checklist

**Status: NOT CLEARED.** GitHub currently reports this repository as **public** (issue #20), although release rights and validation remain unapproved. A `LICENSE` file by itself does not grant permission to publish every tracked file. Do not treat current visibility as release approval, publish npm packages, or release host artwork until each gate below has been reviewed. The maintainer must review the visibility discrepancy and any necessary remediation.

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
      that mixed object/file API calls preserve submission order
      despite asynchronous filesystem operations, and that
      multi-process/persistent backend rendering remains
      explicitly unsupported until separate stress and locking tests.
- [ ] Run `npm run test:node-concurrency` and
      `npm run test:node-adapter`,
      `npm run test:local-render-services`,
      `npm run test:local-process-lifecycle`, and `npm run test:node-types`,
      then the programmatic
      Node.js-to-JSON-to-PNG example, and the Python-to-JSON-to-PNG
      example using the real demo,
      then verify the output dimensions and JPEG conversion.
- [ ] Verify `node scripts/render-chart.mjs --input valid-chart.json
      --validate-only` works without Chrome or npm-installed graphics
      dependencies; ensure it produces no image and rejects incomplete
      mode overrides and duplicate/missing flags.
- [ ] Verify direct `renderChartFile()` calls reject malformed and
      oversized JSON **before** creating output folders or spawning
      the renderer; preserve existing images on failures.
- [ ] Run `npm run test:validate-chart-input`,
      `npm run test:chart-cli-validation` and
      `npm run test:chart-input` to verify matching Node/Python
      and Angular acceptance/rejection rules, including zero-degree
      latitude and missing transits/synastry. Both are browser-free;
      also test malformed JSON via the real CLI before release.
- [ ] On Windows, verify that a stale or incomplete Angular server
      on port 4200 cannot pass the mounted-control readiness gate.
      Confirm the CLI identifies missing `#chart-file` instead of
      timing out on upload, then rerun against the current demo.
- [ ] Run `npm run test:approved-render-assets` and the optional
      Python `python -m unittest discover -s tests -p
      'python_render_options_test.py'`. Verify paired-path
      failure behavior, corrupted bytes and rejection of synthetic
      manifest identity in external mode.
- [ ] With a locally authorized separate `astrological-assets`
      checkout, test `node examples/node/example.mjs --approved-assets`
      using actual binary hashes and manually compare the real
      planet/zodiac glyphs to the synthetic placeholders. Do not
      commit output images or asset inventories. Confirm occupied
      port 4177 causes a clean error, no fallback to production
      URLs and cleanup of **only owned** services.
- [ ] Run `npm run test:render-bridge` with real Chrome/Chromium
      and WebGL; confirm all four cases: natal/light PNG,
      transits/dark JPEG, synastry/light PNG and latitude/dark PNG
      are 1600×1600, nonblank, and natal/light differs from
      synastry/light. This is manual, not part of preflight.
      Record the OS/browser and separately test Python.
- [ ] Run `npm run test:chart-asset-request-audit`; verify browser
      export rejects missing (404), modified (409) and failed local
      asset requests, including when the approved manifest omits
      a symbol required by the selected chart mode/skin. In
      approved mode also reject zero successful local asset responses.
      Do not substitute synthetic placeholders in an approved-artwork export.
- [ ] Test the Astrolabio Node.js + offline Firefox `file://`
      adapter separately; never confuse the Chromium local demo with
      offline/e-ink device compatibility.
- [ ] Ensure README, beginner/contributor instructions and remaining
      public-facing guides (including older Italian asset/reference docs)
      are fully reviewed and available in English.
- [ ] Review new public issues/PR templates, attribution display in
      the demo and any applicable launch/session branding under CPAL.
- [ ] Review outstanding draft PRs and resolve incompatible changes.
- [ ] Resolve the already-public GitHub visibility discrepancy in issue #20; obtain explicit maintainer sign-off on source rights, remediation if needed, rollback plan and source-availability obligations before announcing a release.

The repository is **not** the live VirgoStars site; public release
must not change production integrations or deployed Astrolabio devices.
