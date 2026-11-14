# Latitude symbol filename contract

The latitude renderer uses `latitudePlanetAsset(theme, name, transit)` to choose
host-owned PNG paths for a body symbol (circle) or transit marker (outlined
ring). The function does not fetch files or bundle artwork.

## Filename stem validation

`name` is a single, non-empty filename stem, not a directory, URL or asset
path. Invalid values throw `TypeError` **before** a path is constructed:

- leading/trailing whitespace, empty names, `.` and `..`;
- slashes, backslashes, URI encoding (`%`), query/fragment markers
  (`?` / `#`), colons and ASCII control characters.

Existing body names with spaces and a dot, such as `true Node`,
`mean Node Sud` and `osc. Apogee`, remain supported. The historical
`true Node` to `true node.png` casing rule remains unchanged. All seven
existing skins still resolve to their established `dark`, `light` or
`astrolabio` PNG families. Unknown custom skins retain the previous
`light` fallback; this change does not enforce a skin allowlist.

The host asset root and rights policy remain unchanged. This is a
validation-only change: normal chart pixels, geometry, orientation and PNG
export are untouched. It applies to latitude symbol construction in the
library; the browser's downstream URL resolver continues to check complete
asset paths.

## Verification

Run `node --test tests/latitude-asset-paths.test.mjs` after `npm ci`.
Also run `npm run check:types` and `npm run build:library` in a full
Angular checkout before integration. Browser comparisons with approved
artwork and external VirgoStars/Astrolabio integration are separate gates.
