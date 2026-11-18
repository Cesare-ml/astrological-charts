# Deflective synastry

Status: **prototype, geometry tests only**. The renderer applies the legacy Regolo display rotation to the entire partner ring, including its signs, houses and celestial positions. House 1 aligns the two Ascendants; house N adds `(N-1)*30°`. The option requires the `egizia` Vehlow house system and a house in 1–12; invalid inputs fail rather than silently drawing an ordinary comparison. It does not mutate the astronomical chart or calculate new aspects. Consumers must label the view and must not present ordinary cross-aspect tables as deflected aspects.

Reference: VirgoStars legacy renderer's previously commented deflection geometry and Regolo Alpha Leonis. Synthetic geometry tests do not establish browser visual parity; WebGL rendering, transits plus deflection, opposite direction and supported consumers require visual acceptance.
