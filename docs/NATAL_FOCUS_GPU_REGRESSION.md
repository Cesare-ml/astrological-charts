# GPU regression for temporary native natal aspect foregrounds

The focused natal-aspect presentation (setNatalAspectPresentation('focused'))
duplicates existing native Line2/LineGeometry/LineMaterial strokes into
temporary on-screen foreground layers. Original native strokes remain gray
underneath the selected colored connections. Each copy must own and dispose
its geometry/material independently when the planet selection changes.

## Browser regression (draft PR #22)

The synthetic fixture tests/fixtures/natal-focus-gpu-harness.ts is registered
in npm run test:demo-interactions. It creates three tagged native natal aspects
(Sun–Moon, Sun–Venus, Moon–Venus) plus three neutral glyphs. It renders with a
real Three.js WebGLRenderer and alternates programmatic Sun/Moon/Venus focus
120 times, with exactly two related foreground aspect strokes per selection.

The browser test checks:
- exactly two temporary copies with non-shared geometry and material;
- renderer.info.memory.geometries stays at native chart baseline + 2;
- no increase in texture/program counts after initial shader warm-up;
- previous foreground geometry/material each disposed exactly once;
- original native stroke resources never disposed by interaction handling;
- muted native colors during focus and original colors restored afterward;
- geometry count returns to baseline after clearing focus and zero after
  explicitly disposing the synthetic chart's native resources.

This is GPU allocation bookkeeping, NOT an FPS or device-memory benchmark.
It changes no astronomical calculations, coordinates, assets, host API, skin
or export format. Run the full browser suite with the demo + local approved
or synthetic asset server in Chromium and Firefox before accepting the PR.
Committing the fixture alone is not a successful browser test.
