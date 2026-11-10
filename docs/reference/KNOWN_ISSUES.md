# Problemi noti della libreria grafica

Ultima revisione: **11 agosto 2026**

Questo registro descrive problemi osservati nel sorgente. Non implica che tutti si manifestino nello stesso runtime.

## P0 — Contratti e build che possono rompere consumer

### Dipendenze package incomplete

Il package dichiara Angular e `tslib`, ma importa Three.js, RxJS, Moment Timezone e GSAP. Una build isolata non è riproducibile.

### Auto-import dal package stesso

File interni importano simboli da `grafici-astrologici` anziché da percorsi relativi. La build Astrolabio riscrive soltanto alias con sottopercorso e può lasciare questi import irrisolti.

Casi osservati:

- `SettaggiAstrolabio` → `PosizioneLocalDB`;
- `SegniRender` → `StatoCartaAstrale`;
- `LatitudiniRender` → `SkinManager`.

### Contratto `TemaRender` non tipizzato

I renderer dipendono da strutture annidate non validate. Una modifica backend può rompere il grafico a runtime senza errore TypeScript.

### Drift `transaturnini_se_congiunti` / `transaturniniSeCongiunti`

Modello `Settaggi`, modello Astrolabio e API backend centrale usano:

```text
transaturnini_se_congiunti
```

`ElementiCelestiRender.getElementiCelesti()` verifica invece:

```text
opzioni.settaggi.transaturniniSeCongiunti
```

La `SELECT` del backend restituisce esplicitamente la chiave snake_case e non è stato individuato, nel flusso standard esaminato, un adapter che la rinomini prima del renderer. La funzione “mostra trans-saturnini se congiunti” può quindi non attivarsi come previsto. Correggere con contract test sul payload reale web e Astrolabio.

### Gruppo sinastria assegnato al campo transiti

`creaSinastria()` salva il gruppo in `stato.gruppoTransiti`. L’aggiornamento modulare cerca invece `gruppoSinastria`. Correggere con test transiti+sinastria.

### Mutazione durante lettura della posizione

`getLat/getLng/getTz` cancellano il ramo non attivo. Una lettura può modificare il payload da salvare.

### Build headless non garantita

La pipeline speciale Astrolabio usa timestamp directory e riscrittura regex. Può usare output vecchio o fallire su import non previsti.

## P1 — Modelli e configurazione

### Default divergenti

- `new Settaggi()` usa domificazione egizia;
- `settaggiDefault` usa Placido;
- `new SettaggiAstrolabio()` usa egizia;
- `settaggiAstrolabioDefault` usa Placido;
- `SettaggiAstrolabio.transaturnini_se_congiunti` nasce `true`, mentre il default literal lo imposta a `null`.

### Posizione predefinita specifica nel sorgente

I default web/device incorporano una località concreta. Dovrebbe essere configurazione o fixture, non comportamento della libreria.

### `CittaLocalDB._ObjId` non reidratato

Il costruttore dichiara ma non assegna `_ObjId`.

### `puntoFortuna` incoerente

È presente nel catalogo statico dei corpi ma non nella classe delle configurazioni degli elementi celesti.

### `egiziaplacido` dormiente

Il renderer contiene il ramo, mentre il catalogo domificazioni lo commenta.

### Opzioni incomplete

I renderer usano campi/valori non previsti da `OpzioniGrafico`, inclusi:

- `mostraDecani`;
- `mostraDecadi`;
- `kleros = estrapola-tutto`;
- `kleros = estrapola-4luminarie`;
- `kleros = estrapola-5planetarie`.

### Contratto antisci incoerente

`OpzioniGrafico` dichiara:

```text
antisci.Cardinale: boolean
antisci.Fissa: boolean
antisci.Mutevole: boolean
```

ma `calcolaDiametri()` confronta gli stessi campi anche con la stringa:

```text
"tutti"
```

Il tipo non rappresenta quindi tutti gli stati che il renderer tenta di gestire.

### Skin union incompleta

`astrolabio-girasole` esiste nel manager ma non nel tipo `TemaGrafico`.

### Tipi permissivi

Strict mode e strict template sono disabilitati; molti parametri sono impliciti o `any`.

## P1 — Rendering e lifecycle

### Renderer singleton

Un solo servizio root conserva canvas, renderer, camera e scena. Non supporta bene più grafici simultanei.

### Stato statico delle primitive

Dimensioni e moltiplicatore linee sono globali. Export offscreen e grafico interattivo possono interferire.

### Cleanup GPU incompleto

`scene.clear()` non dispone geometrie/materiali/texture. Il renderer principale non viene disposto nel destroy.

### Cache texture disattivata

I metodi principali di `GestoreImmagini` ignorano il pool. Il cleanup copre soltanto una parte delle texture.

### Timeline GSAP orfane

Animazioni infinite non vengono registrate o terminate al redraw.

### Latitudine zero esclusa

La vista latitudini richiede che `latitude` sia truthy; il valore numerico zero non viene renderizzato.

### Possibile divisione per zero nelle linee decorative

Se la distanza è inferiore al passo, il numero di segmenti può essere zero.

### Testo CanvasTexture non aggiornato

`getTesto()` crea una texture ma lascia commentato `needsUpdate`, con possibile output vuoto.

### Listener frontend non completamente rimossi

Il componente grafico aggiunge listener mouse/touch manuali; il lifecycle va verificato.

## P1 — Asset e skin

### Asset fuori dal package

La libreria dipende da `public/assets`, ma il package non include né dichiara gli asset.

### Percorsi eterogenei

Sono presenti riferimenti assoluti, relativi e prefissati in modi differenti. Web e headless usano override diversi.

### Skin senza schema

Un campo annidato mancante causa errore runtime. Serve validazione/fallback.

### Cache preload non equivalente alla cache texture

Il preload browser può scaricare le immagini senza evitare la creazione di nuove texture Three.js.

### Contenuto base64 e URL storici nel manager skin

Rendono il file difficile da mantenere e aumentano il rumore della cronologia.

## P1 — Duplicazione

### Molte implementazioni del renderer

Esistono sorgente condiviso, `_old`, copie frontend, copie backend e output node-cache. Il rischio è correggere il file sbagliato.

### Backend centrale ancora su renderer legacy

Il servizio immagini centrale importa `backend/lib/charts`, non la libreria condivisa.

### Modelli web/local duplicati

`Tema`/`TemaLocalDB` e `Posizione`/`PosizioneLocalDB` ripetono logica e possono divergere.

## P2 — Pulizia e qualità

- export colori duplicato;
- componente placeholder non esportato;
- log `console.log('asd')` nel renderer segni;
- import e helper inutilizzati;
- molto codice commentato nei renderer attivi;
- parametri posizionali troppo numerosi;
- nomi variabili con refusi;
- `sideEffects: false` da rivalutare con inizializzazioni/globali;
- nessuna suite visuale o unit test;
- nessuna versione reale oltre `0.0.1`.

## Ordine di stabilizzazione consigliato

1. contract test e fixture `TemaRender`;
2. correggere auto-import e matrice build;
3. riallineare naming `transaturnini_se_congiunti` e contratto `OpzioniGrafico`;
4. correggere gruppo sinastria;
5. rendere puri i modelli posizione;
6. dichiarare dipendenze package;
7. introdurre dispose ricorsivo e cache texture;
8. creare manifest asset e schema skin;
9. riallineare integralmente `OpzioniGrafico`;
10. visual regression browser/headless;
11. migrare/rimuovere copie legacy;
12. attivare progressivamente strict TypeScript.

## Regola operativa

Prima di modificare il renderer:

- identificare il consumer reale;
- usare una fixture stabile;
- costruire libreria, frontend e Astrolabio;
- generare snapshot prima/dopo;
- verificare memoria dopo redraw ripetuti;
- controllare asset mancanti;
- non modificare output compilati come se fossero sorgenti.
