# Preview indipendente degli asset astrologici — codice eseguibile senza VirgoStars

**Stato:** la galleria e la demo sono integrate in `main` e sono state provate con asset sintetici; non sono verificate con i file reali né integrate in produzione. Questa pagina descrive la galleria **degli asset**; la distinta [demo Angular](ANGULAR_DEMO.md) usa il renderer completo con fixture sintetiche.

Il server rifiuta record con uno `status` esplicito diverso da `approved`. I manifest generati dall'importatore senza campo `status` restano supportati; metadati e checksum non dimostrano da soli l'autorizzazione legale.

## Il problema risolto

Un collaboratore può clonare `astrological-charts` ma non `virgo-stars`. Il renderer ha bisogno di texture e immagini per mostrare fedelmente i grafici, quindi il codice da solo non basta.

La soluzione finale è un secondo repository privato, `Cesare-ml/astrological-assets`, contenente solamente gli asset originali **approvati**, senza accesso a backend, database, account o AWS. Il nuovo server locale accetta l'archivio approvato come input e serve solo i file presenti in un manifest verificato via SHA-256.

Per sbloccare lo sviluppo **prima** dell'importazione originale, è disponibile un pacchetto **sintetico**, generato in locale, che contiene 78 PNG a scacchiera originali con gli stessi percorsi dei simboli bianchi di preload. Sono solo segnaposto: non rappresentano i simboli né ne attestano la correttezza visiva.

## Modalità A — subito disponibile, immagini sintetiche

Dal repository `astrological-charts`, su Windows:

```powershell
powershell -NoProfile -File .\scripts\preview-synthetic.ps1
```

Apri nel browser: **http://127.0.0.1:4177/__preview**

Se preferisci Node direttamente (Windows/macOS/Linux):

```bash
node scripts/generate-synthetic-pack.mjs --out .local/synthetic-pack
node scripts/serve-local-assets.mjs \
  --root .local/synthetic-pack/public/assets \
  --manifest .local/synthetic-pack/manifests/approved-assets.json
```

Il generatore si rifiuta di sovrascrivere una directory già esistente. Il wrapper PowerShell usa i file già generati, oppure interrompe se la directory è incompleta. Cancella manualmente la cartella `.local/synthetic-pack` solo se vuoi rigenerarla.

- Crea 78 PNG di test 48×48, con nomi e directory esattamente corrispondenti ai 78 percorsi statici di `GestoreImmagini.preloadArraySimboli`.
- Genera `manifests/approved-assets.json` con SHA-256 e marcatura esplicita **synthetic**; non include nessuna immagine di VirgoStars, nessuna texture stock e nessun dato personale.
- Il server verifica l'intero manifest **all'avvio**; a ogni richiesta ricontrolla i byte del file richiesto.
- La galleria locale è `/__preview`; gli URL sono `/assets/img/...`. Il server serve solamente i percorsi contenuti nel manifest, niente directory listing, metodi di scrittura o condivisione pubblica.
- Bind soltanto su `127.0.0.1:4177`, con CORS limitato a `http://localhost:4200` e `http://127.0.0.1:4200`. Non è un servizio esponibile a Internet.

Questo test è utile per verificare struttura dei nomi, disponibilità degli asset, MIME, percorso e autorizzazioni, **ma non** certifica le scene Three.js o l'aspetto originale dei grafici.

## Modalità B — immagini autentiche del repository asset (non ancora disponibili)

Dopo la revisione dei diritti, l'importazione e il merge dei file originali nel repository `astrological-assets`:

```powershell
git clone https://github.com/Cesare-ml/astrological-assets.git
git clone https://github.com/Cesare-ml/astrological-charts.git
cd astrological-charts
node scripts/serve-local-assets.mjs `
  --root ../astrological-assets/public/assets `
  --manifest ../astrological-assets/manifests/approved-assets.json
```

La libreria Angular può configurare il server locale così:

```ts
GestoreImmagini.configurePublicAssetsBase('http://127.0.0.1:4177/assets/');
```

Il sito VirgoStars continuerà a usare `/assets/` e una sola copia dei file, mentre la demo utilizza questo server di sviluppo. Nessun accesso a `virgo-stars` è necessario al collaboratore. **Gli asset autentici attualmente non sono stati importati.**

## Contratto del manifest

Il server accetta **soltanto** il manifest `schemaVersion: 1` emesso dall'importatore `astrological-assets`, con:

```json
{
  "schemaVersion": 1,
  "assets": [
    {
      "path": "img/simboli-bianchi/segni/01.png",
      "bytes": 1234,
      "sha256": "64 lowercase hexadecimal characters",
      "rightsHolder": "verified rights holder",
      "permissionBasis": "verified legal permission",
      "approvalEvidence": "reference to private evidence"
    }
  ]
}
```

L'esempio non è un manifest utilizzabile: gli hash e i permessi vanno prodotti/verificati realmente. Per ciascun percorso controlla file effettivo, SHA-256, dimensione, estensione, case-sensitivity e dichiarazione della revisione. Una stringa di autorizzazione nel JSON non è di per sé una verifica legale: il titolare deve effettuare un audit separato.

Si rifiuta di avviarsi con manifest mancante, vuoto, alterato, con file non approvati o con hash sbagliato. Richieste di file fuori dal manifest restituiscono **404**; un file modificato durante la sessione restituisce **409**.

## Limiti deliberati

1. **La galleria non è la demo Angular interattiva**: non esegue `GraficoRenderService`, animazioni o calcoli astrologici. La [demo separata](ANGULAR_DEMO.md) esegue il renderer con dati sintetici, senza calcolare le effemeridi.
2. I 78 PNG di test non hanno i contenuti visivi reali; nessun confronto affidabile tra skin è possibile prima del pacchetto approvato.
3. La fonte degli asset di produzione è ancora `virgo-stars/public/assets/`; non modificare le sue regole di copia o i dispositivi fisici.
4. Permessi collaboratore: i repository privati sotto account GitHub personali possono concedere scrittura; usare un'organizzazione per ruoli di sola lettura quando necessario.
5. Nessuna GitHub Action, release, npm publish, CDN, deploy AWS o aggiornamento hardware.

## Test locali

```bash
npm run test:local-assets
npm run test:assets
npm run build
```

Sono stati eseguiti su Windows test con fixture sintetiche per il generatore PNG, la verifica di integrità, l'accesso HTTP, la galleria e il rifiuto di file non approvati, traversal, origini esterne, file modificati e symlink. Anche la build e i test browser della demo sono passati; consulta [ANGULAR_DEMO.md](ANGULAR_DEMO.md) per comandi e limiti.

## Successivo gate

Validare la demo separata con immagini originali solo dopo revisione e importazione autorizzata. Non considerare questa galleria o i test sintetici come sostitutivi delle prove con gli asset reali e sull'Astrolabio.
