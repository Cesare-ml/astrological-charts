# Natal planet hover API

`GraficoRenderService.setNatalPlanetHoverListener(callback)` opts an initialized
interactive canvas into natal glyph picking. The callback receives
`{name, longitude}` from the actual natal glyph or `null` on leave. `longitude`
is the input longitude, not the collision-adjusted display angle. Only the
primary natal group is pickable; transit and synastry glyphs and background
objects do not intercept it. Passing `null` unsubscribes. Scene replacement,
resize, zoom and destruction update or clear the hover and detach listeners.

`setNatalAspectsVisible(false)` temporarily hides the natal aspect lines in the
on-screen scene; `true` restores the group if one was drawn. It does not change
settings or off-screen PNG exports, nor create an aspect group when aspects
were disabled. The aspect background remains visible. Both methods are optional;
existing consumers remain unchanged.

This is a local integration, not a production web, mobile or Astrolabio rollout.
Node tests exercise real Three.js picking with synthetic scenes. Browser/WebView,
device visual acceptance, and shipped consumer integration remain separate.
