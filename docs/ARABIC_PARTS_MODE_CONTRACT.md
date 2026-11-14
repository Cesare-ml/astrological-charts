# Arabic-parts mode TypeScript contract

## Diagnosis

The chart options interface `PartiArabeOptions.modalita` previously allowed the string `'abu mashar'` (with a space). Both the chart-state renderer and the planet renderer check the string `'abumashar'` (without a space), so code typed against `OpzioniGrafico` could not select the implemented Abu Ma'shar rendering path using the canonical runtime value.

## Change

The declared union now uses `'abumashar'`, matching both existing runtime comparisons and the corresponding `partiArabe.abumashar` data field. The other values `'essenziali'` and `'crea'` and the initial default `undefined` are unchanged. No astronomical algorithm, position, chart geometry, sprite or public function signature is modified. **This is a compile-time contract correction**; a caller that previously passed the nonfunctional `'abu mashar'` literal needs to update its value.

## Verification

Run `npm run test:arabic-parts-mode`. Four tests validate the public interface union through the TypeScript AST, use the TypeScript semantic checker to accept `'abumashar'` and reject `'abu mashar'`, check the canonical literal in both runtime rendering modules and preserve the defaults. Run `npm run verify:angular` on a full clean checkout and browser comparisons in natal + Arabic-parts modes before integration. Headless and e-ink/Astrolabio remain separately gated.

This PR intentionally does not change actual `Parti Arabe` calculations, enable additional modes by default, add assets or publish or deploy. Coordinate merge order with PR #61, which also modifies `opzioni-grafico.model.ts`.
