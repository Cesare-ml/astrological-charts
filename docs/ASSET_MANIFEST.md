# Manifest degli asset condivisi — versione e checksum

Questa funzione completa il sistema di URL condivisi della libreria, **senza aggiungere copie dei file grafici**. Il proprietario dell'archivio rimane `Cesare-ml/virgo-stars/public/assets/`: è già usato dalle pagine Angular e dal renderer.

Il file manifest contiene solo **nomi relativi, dimensione in byte, SHA-256** e un fingerprint deterministico. Non contiene immagini, font né dati dei temi astrologici. Non è una verifica delle licenze.

## Flusso operativo

```text
virgo-stars/public/assets/    (solo archivio di produzione)
         |
         +-- frontend Angular -> /assets/img/... (una sola copia per build)
         |
         +-- script asset-manifest.mjs -> manifest JSON (solo metadati)
                                                  |
                                                  +-- verifica integrità
                                                  +-- differenze tra versioni
                                                  +-- selezione offline Astrolabio (fase successiva)
astrological-charts/src/ -> URL resolver verso /assets/img/...  (nessun file copiato)
```

## Uso

Dopo aver clonato VirgoStars e Astrological Charts in cartelle vicine, **solo sul computer locale**:

```bash
# Esempio minimo. La selezione contiene percorsi relativi a public/assets/.
node scripts/asset-manifest.mjs generate \
  --root ../virgo-stars/public/assets \
  --selection examples/chart-assets.selection.example.json \
  --out ./chart-assets-manifest.local.json

# Il controllo fallisce se uno dei file selezionati manca o è cambiato.
node scripts/asset-manifest.mjs verify \
  --root ../virgo-stars/public/assets \
  --manifest ./chart-assets-manifest.local.json

# Confronta due revisioni e genera una lista di asset aggiunti/modificati/rimossi.
node scripts/asset-manifest.mjs diff \
  --before ./chart-assets-manifest.previous.json \
  --after ./chart-assets-manifest.local.json
```

L'esempio `examples/chart-assets.selection.example.json` è **illustrativo e incompleto**: per tutte le skin va generata una lista verificata a partire dai riferimenti nel renderer e dai componenti Angular. Non considerare l'esempio un elenco esaustivo.

Il generatore **richiede una selezione esplicita**; per una scansione di tutti gli asset grafici e i font, occorre richiedere esplicitamente `--all yes`. Questo evita di includere per errore migliaia di immagini estranee al renderer. La scansione riguarda esclusivamente `img/` e `fonts/` e tipi consentiti. Symlink, path traversal e nomi collidenti per maiuscole/minuscole producono errori.

### Canonical asset path validation

Generated, imported and approved asset paths must be **literal relative** `img/...` or `fonts/...` filenames. Spaces in filenames are supported. Paths containing percent escapes (`%2e`), URL query/fragment delimiters (`?`, `#`), colons or ASCII control bytes are rejected before hashing, selection or approved-pack serving. These byte sequences could otherwise be interpreted differently by a URL parser, filesystem or WebGL host. Legacy `../../../assets/img/...` references are normalized by the chart-selection helper before validation.

If an existing asset has an ambiguous name, resolve the naming and source references in the host-owned asset catalogue under a separately reviewed migration; do not silently rename or copy artwork here. This path validation checks safety, **not** redistribution rights or image completeness.

Il manifest va generato in una directory di lavoro, revisionato e usato per verificare la disponibilità delle risorse prima del rilascio. **Non** è richiesto al browser per mostrare un grafico né va importato come insieme di immagini durante la build.

## Aggiornamenti Astrolabio

I dispositivi offline possiedono già i file necessari a funzionare senza rete. In una futura fase di packaging, per ogni build Astrolabio potremo:

1. scegliere un sottoinsieme dal manifest degli asset canonici;
2. copiare **una sola volta sul dispositivo** ogni file richiesto, non tutto l'archivio del sito;
3. confrontare il manifest installato con quello della versione successiva;
4. trasferire soltanto file nuovi o modificati, con verifica SHA-256 prima dell'attivazione.

**Questo generatore non copia, cancella né aggiorna asset sui dispositivi**. La distribuzione incrementale e i test hardware non sono ancora implementati.

## Test

```bash
npm run test:asset-manifest
npm run test:assets
```

Casi previsti: ordine deterministico, SHA-256, selezione, modifica file, duplicati, case collision, traversal e symlink. Un test con fixture temporanee non certifica automaticamente che l'intero catalogo reale o le sette skin siano completi.

## Limiti e sicurezza

- La libreria non deve dichiarare `assets` dentro `ng-package.json`.
- Il frontend deve copiare `public/` **una volta soltanto**. Evitare che Angular importi gli stessi PNG dal pacchetto npm.
- Il manifest non concede licenze: il diritto di distribuire ciascuna immagine, specie texture e Risuonatore Solare, richiede un audit separato.
- Non pubblicare manifest completi di file estranei al prodotto in una release open source.
- Restano da realizzare: selezione automatica per skin, validazione degli asset esistenti, test WebGL/network, integrazione sito e Astrolabio.

## Automatic chart-only selection (next candidate PR)

Rather than maintaining `examples/chart-assets.selection.example.json` by hand, the candidate tool `scripts/derive-chart-asset-selection.mjs` derives the list from live `SkinManager`/preload references and known chart-only folders of the host. See [ASSET_SELECTION_AUTOMATION.md](ASSET_SELECTION_AUTOMATION.md). The selection is conservative, not a proven per-device minimum, and unresolved literal references block output.
