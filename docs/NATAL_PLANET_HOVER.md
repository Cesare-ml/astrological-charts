# Natal planet hover API

`GraficoRenderService.setNatalPlanetHoverListener(callback)` opts an initialized
interactive canvas into natal glyph picking. The callback receives
`{name, longitude}` from the actual natal glyph or visible axis marker, or `null` on leave. `longitude`
is the input longitude, not the collision-adjusted display angle. Only the
primary natal group and its ASC/DS/MC/IC markers are pickable; transit and synastry glyphs and background
objects do not intercept it. Passing `null` unsubscribes. Scene replacement,
resize, zoom and destruction update or clear the hover and detach listeners.

`setNatalAspectsVisible(false)` temporarily hides the natal aspect lines in the
on-screen scene; `true` restores the group if one was drawn. It does not change
settings or off-screen PNG exports, nor create an aspect group when aspects
were disabled. The aspect background remains visible. Both methods are optional;
existing consumers remain unchanged.

`nascondiAssiDuplicati` is an opt-in rendering option: in the ordinary primary
wheel, it hides each axis glyph in the planet band only if that axis has its
external marker enabled and valid house data. Axis positions remain available
to picking through the corresponding external markers. The default is
unchanged for existing consumers.

This is a local integration, not a production web, mobile or Astrolabio rollout.
Node tests exercise real Three.js picking with synthetic scenes. Browser/WebView,
device visual acceptance, and shipped consumer integration remain separate.
# Transit interactions

The optional two-ring hover listener distinguishes the natal ring and its axis markers from transit glyphs, including when the two bodies share a name. `setNatalAspectsDimmed` saves and restores existing material properties; `setTransitAspectLines` draws caller-supplied, already-calculated directional aspects with the wheel geometry and existing aspect styles. Replacing a scene or destroying the renderer disposes scene-owned resources. Neither method computes astrological aspects. These methods affect the interactive scene only, not offscreen exports.
