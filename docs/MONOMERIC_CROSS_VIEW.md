# Monomeric Cross — responsive renderer (prototype)

`MonomericCrossComponent` is a standalone Angular 20 component exported by
`grafici-astrologici`. It displays the hour-ruler arm above, +90° left,
−90° right, and opposition below; on a narrow screen it changes to a
connected vertical sequence. Four semantic buttons select a detail panel.

The `MonomericCrossView` input is strictly presentation data. No ephemeris,
planetary-hour or house calculations occur in the component. A consumer can
pass the output of `astrological-functions/monomeric-cross` to the exported
`monomericCrossViewFromGeometry` adapter; this adapter translates sign names,
but never invents historical descriptions. Missing catalog content is clearly
marked pending verification.

This intentionally uses no additional artworks, fonts or copied monomer
catalogs. Before adding Serto di Iside images/text, validate rights, source
identity and 0–29 indexing conventions with editorial review. No real user
birth charts are committed as demo fixtures.

```html
<vs-monomeric-cross [cross]="cross" [locale]="locale" />
```

Known follow-up: check real browser/mobile and e-ink visual output, confirm
source catalog convention, integrate solar-event-backed hour ruler, and run
human UI acceptance in all consumers. A successful Angular build is not
visual parity evidence.
