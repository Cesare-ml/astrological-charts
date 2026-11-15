# Reentrant pointer exit during hover replacement

**Scope:** the draft on-screen `PlanetInteractionController` of
`astrological-charts`. This change does not affect exported static charts,
astronomical calculations, glyph zoom/scale, or production VirgoStars.

## Problem

A pointermove from natal Sun to natal Moon emits `leave:Sun` before it
installs Moon as the new hover. This is intentional to avoid exposing a
new selection before its leave event. But a synchronous host callback can
dispatch `pointerleave` or another `pointermove` during that interval.

When `hovered` was already `null`, the nested pointerleave previously
returned without advancing `pointerRevision`. The outer move subsequently
emitted a **stale** `enter:Moon` even though the pointer had already left
the canvas. Merely moving the revision increment would prevent that enter
but could leave the old Sun focus paint and pointer cursor onscreen.

## Event contract

- `pointerleave` always invalidates an older in-flight pointer transition,
  even if `hovered` is temporarily `null`.
- The controller tracks the retiring focus in `pendingHoverExit` only
  while sending its synchronous `leave` callback.
- A nested exit restores the pinned or neutral visual focus, resets the
  cursor, and **does not** emit a second `leave` for the same planet.
- A nested move to Venus (or empty canvas) uses the pending Sun as its
  prior *visual* focus, paints the newest target once, and prevents the
  older Moon transition from taking over.
- Repeated pointerleave events on an idle canvas do **not** allocate
  overlay geometry, emit events or request WebGL frames.
- If the old hover is already identical to a pinned focus, pointer exit
  does not needlessly repaint.
- Scene replacement and controller destruction drop the pending focus;
  their existing revision/disposal protection remains authoritative.

## Validation

`npm run test:planet-interactions` includes
`tests/pointer-transition-reentrancy.test.mjs`. The new fixture
transpiles the **actual** `move` and `leave` TypeScript arrow
properties and verifies seven deterministic synthetic event sequences.

Before merging the parent draft interactive PR #22 into `main`, run
`npm ci`, `npm run verify:angular` and real Chromium/Firefox pointer
tests, including nested callback, screen cursor, native gray aspect
lines, selected AS/DS/MC/IC, no zoom or scale changes, PNG output and
approved local asset/license checks. Synthetic tests are not proof of
real WebGL behavior. Do not deploy from this patch.
