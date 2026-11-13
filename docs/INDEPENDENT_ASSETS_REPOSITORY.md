# Scelta architetturale: archivio asset separato per collaboratori

**Decisione in attuazione, non ancora applicata a VirgoStars:** il repository dedicato **[`Cesare-ml/astrological-assets`](https://github.com/Cesare-ml/astrological-assets)** è pubblicamente leggibile e contiene immagini autorizzate dal proprietario per la collaborazione; la visibilità pubblica non autorizza la redistribuzione dei singoli file, con manifest SHA-256. Il font di origine dalla licenza sconosciuta non è incluso. La sorgente dei file in produzione resta `Cesare-ml/virgo-stars/public/assets`.

Questa decisione nasce da un requisito concreto: un collaboratore che ha accesso solo a `astrological-charts` deve poter visualizzare i grafici correttamente, anche quando non può leggere `virgo-stars`.

## Perché non basta il pacchetto Angular

Il codice Three.js carica URL esterni. Una libreria che non include immagini può essere compilata senza le immagini, ma non è automaticamente in grado di produrre gli stessi grafici. I simboli dei pianeti, dei segni, delle case e le skin sono asset essenziali.

Tre modi di dare accesso agli asset ai collaboratori:

| Modalità | Accesso al repo VirgoStars? | Funziona offline? | Limiti |
|---|---|---|---|
| URL pubblici del sito `virgostars.it/assets/...` | No | No | Richiede sito disponibile e regole CORS valide; non usare il sito live come dipendenza obbligatoria di test |
| Repository separato `astrological-assets` | No, basta accesso agli asset | Sì | Richiede verifica manifest SHA-256 e diritti dei file; nessun invito per la lettura pubblica |
| Fixture sintetiche originali o liberamente distribuibili | No | Sì | Non garantiscono fedeltà a tutte le skin di produzione |

**La soluzione robusta:** repository separato con asset approvati e verifica SHA-256 + fixture sintetiche liberamente distribuibili; le URL pubbliche possono restare una modalità opzionale di sola visualizzazione, dopo verifica CORS.

## Struttura proposta

```text
astrological-charts/             # CODICE Angular + Three.js, zero immagini di produzione
  src/
  tests/
  scripts/serve-local-assets.mjs

astrological-assets/             # Archivio separato, versione indipendente
  README.md
  catalog/approvals.json
  public/assets/
    img/
      simboli-bianchi/
      simboli/
      grafici/
      textures/
      risuonatore-solare-*.png  # Solo file con diritti verificati
    # Font originale escluso: licenza non verificata
  manifests/
    approved-assets.json        # Metadati, mai dati utenti
```

Non copiare l'intero `virgo-stars/public`: contiene anche risorse non pertinenti e potenzialmente materiali soggetti a diritti diversi. La proposta richiede un inventario e una revisione dei file selezionati prima del trasferimento. I nomi e le directory devono mantenere la stessa struttura dei riferimenti esistenti.

## Collaboratore con solo due repository

Il collaboratore può avere accesso **solo** a `astrological-charts` (codice) e a `astrological-assets` (immagini), senza vedere il backend, le credenziali o i temi degli utenti di VirgoStars.

```powershell
git clone https://github.com/Cesare-ml/astrological-charts.git
git clone https://github.com/Cesare-ml/astrological-assets.git

cd astrological-charts
npm ci
# Nel checkout fratello astrological-assets: npm run verify:pack
npm run demo:assets:repo
```

Il server restituisce gli asset su `http://127.0.0.1:4177/assets/...`, espone soltanto richieste GET/HEAD locali e limita gli origin dei browser. Nessun account AWS, endpoint backend, password o token è necessario.

La demo Angular configura il server locale tramite:

```ts
GestoreImmagini.configurePublicAssetsBase('http://127.0.0.1:4177/assets/');
```

Questa impostazione va usata **solo** nella demo locale, non nel sito live. Il server non è un servizio di produzione né un CDN. La demo e i test sono descritti in [ANGULAR_DEMO.md](ANGULAR_DEMO.md).

## VirgoStars non deve caricare due copie

**Oggi:** `virgo-stars/public/assets` resta la fonte degli asset effettivamente serviti.

**Durante una migrazione:** è possibile che codice e immagini esistano temporaneamente in due repository; questa duplicazione **di sorgente**, transitoria, va gestita con checksum e un piano di rimozione, ma non bisogna far arrivare due copie alla stessa build Angular.

**Dopo la migrazione verificata:** `astrological-assets` diventa la fonte unica dei soli asset grafici. VirgoStars usa una versione **pinned** del repository (per esempio un Git submodule in `vendor/astrological-assets` oppure un archivio versionato e controllato manualmente). Nel frontend Angular una singola entry `assets` copia gli elementi del pacchetto nel percorso di output `/assets/`. Prima bisogna rimuovere dal vecchio `public/assets` i file ormai forniti dal pacchetto, evitando sovrapposizioni.

Il resto di `public/` (logo del sito, risorse UI generiche, tarocchi e altri media) rimane nel repository VirgoStars. Entrambi i frontend Angular e la build Astrolabio devono essere verificati separatamente: oggi non cambiamo alcun `angular.json`, script di deploy o dispositivo.

## Astrolabio offline

L'Astrolabio dovrà ottenere **una copia locale per dispositivo** del solo sottoinsieme necessario, generato dal manifest versionato. Un dispositivo offline non può condividere fisicamente gli asset distribuiti dal sito web. Il pacchetto locale deve rimanere coerente con la versione del renderer e supportare rollback.

## Requisiti prima di popolare e condividere il repository

1. Repository attualmente **pubblicamente leggibile**. Prima di distribuire singoli file o concedere accesso in scrittura, verificare provenienza, autorizzazioni e licenze; l'accesso pubblico non concede diritti di riutilizzo.
2. Trasferire soltanto risorse con provenienza e autorizzazioni documentate. Evitare di pubblicare automaticamente texture stock o font e gli elementi brandizzati senza autorizzazione.
3. Conservare path, lettere maiuscole, nomi con spazi e formati usati dal frontend.
4. Aggiungere un manifest SHA-256 e una lista delle licenze/diritti, senza dati utente.
5. Bloccare modifiche alla branch principale senza revisione; nessun deploy e nessuna GitHub Action.
6. Provare la build e i rendering del sito prima di togliere qualsiasi file dall'archivio originario.

## Cosa è stato implementato adesso

Il repository `astrological-charts` contiene il **server di sviluppo locale** e test che permettono l'uso di una cartella di asset indipendente dal repository `virgo-stars`.

Sono disponibili il repository pubblico in sola lettura per i visitatori, un pacchetto di immagini autorizzate e una demo Angular. Non sono stati attivati il collegamento della build VirgoStars o un CDN. La revisione dei diritti per la redistribuzione degli asset resta necessaria anche se il repository è già pubblico.

## Nota sui permessi di accesso

Per eventuali repository privati sotto un account GitHub personale, la documentazione ufficiale GitHub avverte che i collaboratori di repository privati personali possono ottenere accesso in scrittura anziché un ruolo strettamente read-only. Se è indispensabile la sola lettura, valutare una organizzazione GitHub con ruoli separati prima degli inviti. Non confondere repo **privato** con repo **sola lettura**.

## Local proof of independent asset access

`astrological-charts/scripts/preview-synthetic.ps1` creates 78 **original synthetic** PNGs in git-ignored `.local/` and serves them in a manifest-gated preview at `http://127.0.0.1:4177/__preview`. The separate demo can also use the separate approved pack without VirgoStars repository access. See [LOCAL_ASSET_PREVIEW.md](LOCAL_ASSET_PREVIEW.md). Production cutover remains pending.
