# Reentrant natal aspect palette cleanup

## Bug and scope

On-screen natal aspect focus temporarily mutes native vertex-color lines
while preserving their original colors in `natalLineColors`. A synchronous
Three.js `Material.dispose()` listener may select a different body and repaint
the native lines while the previous focus is being cleaned up. Restoring the
**old** native palette after that listener runs would overwrite the new focus
and corrupt the baseline recorded by the newer paint.

The controller now detaches the previous paint's ownership maps and restores
its natal vertex-color attributes **before** disposing any of its old focused
materials. A reentrant callback can therefore start from the original native
colors and build an independent next focus without the older caller erasing it.

The patch preserves the existing material-clone ownership rules, scene and
pointer reentrancy guards, and all astronomy/ephemeris boundaries. No glyph
scale, camera zoom, aspect orb, asset, skin file or production VirgoStars path
changes.

## Regression gate

Run `npm run test:planet-interactions` for the actual TypeScript-method test
in `tests/natal-palette-reentrancy.test.mjs`. The synthetic regression tests
ordinary and interleaved native color attributes, synchronous nested cleanup
from a material-disposal callback, exactly-once disposal and restoring the
original palette when the *new* focus is eventually cleared.

This test does not instantiate a real WebGLRenderer or compare PNG pixels.
Before merging interactive rendering into `main`, complete the clean-checkout
Angular/preflight gate and Chromium/Firefox on-screen/WebGL tests with
approved local assets, alongside visual, licensing and consumer review.
