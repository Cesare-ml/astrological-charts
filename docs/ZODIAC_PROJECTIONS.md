# Zodiac projection rendering

`proiezioneZodiacale` is an optional `OpzioniGrafico` field. The host supplies the mode, axis, selection, and already-calculated natal/reflected longitudes for visible points. The renderer does not calculate or alter astronomical positions. All-points mode draws filled antiscia or hollow contra-antiscia markers; a single selected body draws the website's triangle or dashed ray and a glyph from the host's approved asset pack. The normal natal aspects are grey while a reflection is shown.

Existing `dodecatemoriAttivi` and `dodecatemore` options draw the host-provided dodecatemoria. The seven traditional points supported by Desktop are calculated upstream. All-points mode uses colored dots; single-point glyphs use the common `simboli-bianchi/elementi-celesti` assets across skins. Scene redraw/export owns and disposes these resources, including cleanup if projection asset loading fails. All options are off by default for existing consumers.
