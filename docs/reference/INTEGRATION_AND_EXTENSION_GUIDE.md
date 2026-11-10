# `grafici-astrologici` — guida di integrazione ed estensione sicura

Ultima revisione: **11 agosto 2026**

Questa guida risponde alla domanda pratica: **come usare o modificare `grafici-astrologici` senza rompere VirgoStars web, export PNG o Astrolabio?**

Va letta insieme a:

- `API_REFERENCE.md` — simboli pubblici e contratti runtime;
- `RENDERER_MODULE_REFERENCE.md` — moduli, geometria e invarianti;
- `PUBLIC_API_AND_BUILD.md` — packaging/build;
- `SKINS_ASSETS_AND_HEADLESS.md` — asset e runtime headless;
- `TESTING_PERFORMANCE_AND_LIFECYCLE.md` — strategia di verifica;
- `KNOWN_ISSUES.md` — debiti tecnici da non propagare.

---

# 1. Regola fondamentale: un sorgente, più runtime

Il codice da modificare è:

```text
shared/grafici-astrologici/src/
```

Non modificare come sorgente:

```text
shared/grafici-astrologici/src/lib/renderers/_old/
astrolabio/backend/node-cache/grafici-astrologici/
frontend/vecchi_codici/
backend/lib/charts/
astrolabio/backend/lib/charts/
shared/_old/
```

`node-cache` è output generato. Le altre cartelle sono copie/implementazioni storiche che possono essere utili per confronto, ma non devono ricevere una correzione al posto della libreria condivisa.

---

# 2. Consumer attivi principali

## 2.1 VirgoStars web desktop

Il componente attivo importa dal package:

```ts
import {
  GraficoRenderService,
  SkinManager,
  TemaRender
} from 'grafici-astrologici';
```

Flusso:

```text
input Angular
  -> scheduleDisegna (debounce locale 300 ms)
  -> GraficoRenderService.disegnaScena
  -> Three.js canvas interattivo
```

Il componente inizializza un canvas nominale `1200 x 1200`, configura lo zoom e delega il resize del renderer al servizio.

## 2.2 VirgoStars web mobile

Il componente passa a immagine statica:

```text
GraficoRenderService.generaImmagine
  -> data URL PNG 1080 x 1080
  -> immagine mostrata dalla UI
```

Nel consumer corrente la scala passata è `1`.

Quindi una modifica può risultare corretta nel canvas desktop ma diversa nell'export mobile: vanno verificati entrambi.

## 2.3 Astrolabio frontend Angular

Condivide il package e i modelli, ma ha vincoli aggiuntivi:

- configurazione locale;
- display e-ink;
- aggiornamenti installabili su dispositivi già consegnati;
- build frontend/device distinta.

## 2.4 Astrolabio headless

Non usa `GraficoRenderService` per comporre la carta. Il backend genera una build browser della libreria e usa direttamente:

```ts
Grafici.CartaAstraleCreaScena(...)
```

all'interno di una pagina Playwright/Firefox.

Questo rende `CartaAstraleCreaScena`, `OggettiSempliciRender`, `SkinManager` e `GestoreImmagini` contratti critici anche se sembrano low-level.

---

# 3. Build della libreria

## Angular package

Dal root del monorepo:

```bash
npm ci
npm run build:grafici
```

Poi verificare almeno:

```bash
npm run build:frontend
npm run build:astrolabio
```

La libreria non va considerata valida soltanto perché `build:grafici` passa.

---

# 4. Pipeline headless Astrolabio

Script:

```text
astrolabio/backend/routines/build-angular-lib.js
```

## 4.1 Compilazione TypeScript

Lo script usa `tsc` con:

```text
shared/grafici-astrologici/tsconfig.lib.json
  -> astrolabio/backend/node-cache/grafici-astrologici/
```

con opzioni aggiuntive tra cui:

```text
--module ESNext
--moduleResolution bundler
--noEmitOnError false
```

**Conseguenza:** l'output può essere emesso anche in presenza di errori TypeScript. La presenza dei file in `node-cache` non dimostra quindi che il contratto sia sano.

## 4.2 Riscrittura import

`fixImports()`:

1. converte alias del tipo:

```ts
from 'grafici-astrologici/<sottopercorso>'
```

in relativo;

2. aggiunge `.js` agli import relativi.

Non gestisce esplicitamente auto-import dal solo package root:

```ts
from 'grafici-astrologici'
```

Per questo gli auto-import interni alla libreria sono vietati nella pratica, anche se Angular può risolverli nel monorepo.

## 4.3 Bundle

Dopo la compilazione, esbuild crea:

```text
public-api.bundle.js
```

con:

```text
format = esm
platform = browser
target = es2020
sourcemap = true
```

## 4.4 Caricamento nella pagina headless

`astrolabio/backend/views/page-template.html` esegue:

```js
import * as Grafici from '../node-cache/grafici-astrologici/public-api.bundle.js';
window.Grafici = Grafici;
```

Quindi il backend Playwright accede alla public API tramite `window.Grafici`.

---

# 5. Rendering e-ink headless

Routine:

```text
astrolabio/backend/routines/genera-carta-astrale.js
```

La pipeline attiva usa Firefox headless con WebGL.

## Dimensioni osservate

Il codice adatta canvas/pagina a seconda del display, per esempio:

```text
7.8p  -> canvas 1404 x 1404, pagina 1872 x 1404
13.3p -> canvas 1200 x 1200, pagina 1600 x 1200
altro -> canvas 1072 x 1072, pagina 1448 x 1072
```

Il dimensionamento è quindi parte del rendering dispositivo e non va sostituito con i valori web senza verifica sull'hardware.

## Scala delle linee

Prima della composizione il backend imposta:

```js
Grafici.OggettiSempliciRender.setDimensioniCanvas({ x: canvas_width, y: canvas_height });
Grafici.OggettiSempliciRender.lineScaleFactorMultiplier = ...;
```

Nel codice corrente il moltiplicatore è normalmente `2.5` e sale a `4` per il display `13.3p`.

Una modifica al calcolo dello spessore delle linee va quindi verificata fisicamente o con baseline specifiche e-ink.

## Asset adapter

Nel browser Playwright il backend sovrascrive:

```js
GestoreImmagini.getImg
GestoreImmagini.loadAsync
```

per risolvere tutti i riferimenti verso una directory `file://` preparata per il renderer.

Questa è una dipendenza esplicita dell'Astrolabio dall'API pubblica di `GestoreImmagini`.

## Composizione

Il backend chiama:

```js
CartaAstraleCreaScena(
  opzioni,
  lavagna.radixRender,
  lavagna.transitiRender,
  lavagna.sinastriaRender
)
```

Poi calcola una bounding box del gruppo per regolare la camera e applica correzioni specifiche quando sono mostrati i transiti.

---

# 6. Matrice minima di compatibilità

Ogni modifica sostanziale alla libreria deve essere classificata rispetto a questa matrice:

| Target | Render | Asset environment | Interazione |
|---|---|---|---|
| VirgoStars desktop | WebGL canvas | HTTP `/assets` | zoom/pan |
| VirgoStars mobile | PNG offscreen browser | HTTP `/assets` | immagine statica |
| Astrolabio frontend | WebGL/UI device | bundle locale | device-specific |
| Astrolabio headless | WebGL Firefox/Playwright | `file://` + adapter | nessuna |
| eventuali consumer futuri | da definire | resolver esplicito | da definire |

Una modifica non è completata finché non è noto quali celle della matrice tocca.

---

# 7. Procedura sicura per modificare la geometria

Esempi:

- cambiare diametro di un anello;
- cambiare posizione dei simboli;
- cambiare collision avoidance;
- cambiare offset ascendente;
- cambiare z-order.

Procedura:

1. scegliere fixture radix stabile;
2. generare snapshot prima della modifica;
3. identificare quale costante/rapporto geometrico viene cambiato;
4. verificare se transiti/sinastria sovrascrivono quel diametro;
5. modificare solo il sorgente condiviso;
6. build libreria;
7. build frontend;
8. render desktop;
9. export mobile PNG;
10. build Astrolabio;
11. render headless almeno nelle dimensioni e-ink supportate;
12. confrontare screenshot e posizione degli assi/cuspidi;
13. verificare `renderer.info.memory` su redraw ripetuti se sono state aggiunte geometrie/materiali.

Non validare una modifica geometrica soltanto “a occhio” su un singolo tema.

---

# 8. Come aggiungere una nuova skin

## 8.1 Non iniziare dagli asset

Prima definire lo schema completo atteso dai renderer.

Minimo pratico:

```ts
SkinManager.skins['nuova-skin'] = {
  bgColor: '#...',
  elementi: ['#...', '#...', '#...', '#...'],
  cerchioAspetti: {
    coloreTexture: '#...',
    texture: null,
    imgRisuonatoreSolare: '...',
    imgRisuonatoreSolareWidth: 0,
    imgRisuonatoreSolareHeight: 0,
    imgRisuonatoreColore: '#...',
    imgRisuonatoreScale: 1,
    imgRisuonatoreSolareOpacity: 1
  },
  anelloElementiCelesti: {
    coloreLinea: '#...',
    coloreSimboli: '#...',
    coloreImgFolder: null
  },
  anelloSegni: {
    coloreLinea: '#...',
    coloreSimboli: '#...',
    coloreImgFolder: null,
    coloreTexture: '#...',
    texture: null
  },
  anelloCase: {
    coloreLinea: '#...',
    coloreSimboli: '#...',
    coloreImgFolder: null,
    texture: null
  },
  anelloTransiti: {
    coloreLinea: '#...',
    coloreImgFolder: null
  },
  latitudini: {
    elementiCelesti: {
      coloreGriglia: '#...',
      coloreEclittica: '#...'
    }
  }
};
```

Se serve stile differente in sinastria, aggiungere gli override previsti in `anelloCase.sinastria` e/o `anelloElementiCelesti.sinastria`.

## 8.2 Aggiornare i tipi

Aggiornare `TemaGrafico` / il futuro tipo `SkinId`; non lasciare una skin raggiungibile solo con cast/`any` come accade oggi con `astrolabio-girasole`.

## 8.3 Asset

Ogni nuovo asset deve:

- vivere sotto il source asset tree canonico;
- usare casing identico al riferimento;
- essere incluso nel preload/manifest quando necessario;
- essere disponibile nella copia headless Astrolabio;
- essere testato con URL web e `file://`.

## 8.4 Verifica

Minimo:

```text
radix con case
radix senza case
transiti
sinastria
latitudini
PNG browser
headless Astrolabio
```

---

# 9. Come aggiungere un nuovo corpo celeste

Un corpo non è soltanto un file PNG.

Checklist:

1. definire il nome canonico, identico nel backend e nel renderer;
2. aggiungerlo al contratto del calcolo astrologico / `TemaRender.planets`;
3. aggiungerlo a `SettaggiElementiCelesti`;
4. aggiungere label a `Settaggi.elementiCelesti`;
5. definire default `att`, `orb`, `aspVerso`;
6. aggiungere colore semantico se necessario a `Colori.elementiCelesti`;
7. aggiungere asset diretto;
8. se può retrogradare, aggiungere asset `-r`;
9. aggiungere asset/variante per eventuali percorsi legacy della vista latitudini;
10. aggiungere asset al preload/manifest;
11. verificare collision avoidance;
12. verificare aspetti;
13. verificare transiti;
14. verificare sinastria;
15. verificare headless.

### Naming

Il nome è attualmente usato contemporaneamente come:

```text
chiave JSON
chiave settings
chiave colori
parte del path asset
identificatore negli aspetti
```

Cambiare maiuscole, spazi o punteggiatura è quindi breaking change.

---

# 10. Come aggiungere un nuovo aspetto

Checklist:

1. aggiungere il flag in `SettaggiAspettiAttivi`;
2. aggiungere l'orbita in `SettaggiAspettiOrbite`;
3. aggiungere la definizione in `Settaggi.aspetti` con angolo/sentinel;
4. aggiungere colore in `Colori.aspetti`;
5. aggiungere stile in `AspettiRender.tipoLinea`;
6. decidere se è simmetrico o direzionale;
7. decidere se usa longitudine o declinazione/altro parametro;
8. aggiornare `getArchi()`;
9. aggiornare `getArchiDoppioTema()` se deve funzionare fra temi;
10. aggiornare default web e Astrolabio;
11. testare wrap 0°/360°;
12. testare orbita esatta al confine;
13. testare esclusioni sugli assi;
14. snapshot visuale.

Non duplicare la logica di tolleranza angolare in un altro renderer: il target è estrarla in una funzione pura condivisa.

---

# 11. Come aggiungere una nuova opzione grafica

Prima distinguere:

```text
A. configurazione persistente utente
B. opzione temporanea della visualizzazione
C. dato derivato dal calcolo astrologico
```

Non usare `OpzioniGrafico` come contenitore universale.

## Se è persistente

Aggiornare:

```text
DB / default JSON
backend settings API
Settaggi o SettaggiAstrolabio
migrazione dati se necessaria
UI impostazioni
```

## Se è solo visuale

Aggiornare:

```text
OpzioniGrafico
defaultOpzioniGrafico
consumer che la modifica
renderer che la legge
fixture/test
```

## Se richiede dati astrologici

Aggiornare prima il contratto/versione di `TemaRender`, poi il renderer.

### Regola

Non introdurre un accesso runtime come:

```ts
opzioni.nuovaCosa
```

senza dichiararlo nel tipo e nel default. Il drift attuale (`mostraDecani`, kleros extra, antisci stringhe) non deve diventare il modello da imitare.

---

# 12. Come aggiungere una nuova modalità di grafico

Oggi il dispatcher pubblico riconosce sostanzialmente:

```text
carta-astrale
latitudini
```

Qualunque altro valore ricade su `carta-astrale`.

Per aggiungere una modalità:

1. definire un type `GraficoId` anziché una stringa libera;
2. creare un renderer che ritorna `Promise<THREE.Group>`;
3. evitare dipendenze da `GraficoRenderService` nel core;
4. inserire il caso in `disegnaScena()`;
5. inserire lo stesso caso in `generaImmagine()`;
6. decidere esplicitamente se deve essere supportato dall'Astrolabio headless;
7. se sì, esporre il core necessario dalla public API o creare un entry point headless dedicato;
8. definire asset richiesti;
9. definire comportamento con transiti/sinastria;
10. aggiungere test desktop/mobile/headless.

### Evitare la duplicazione

`disegnaScena()` e `generaImmagine()` hanno oggi switch simili. Prima di aggiungere molti grafici conviene estrarre:

```ts
creaGruppoGrafico(graficoId, inputs): Promise<THREE.Group>
```

puro rispetto al renderer/canvas.

---

# 13. Come aggiungere o cambiare un asset

## Problema attuale

Esistono riferimenti:

```text
simboli-bianchi/...
../../../assets/img/...
/assets/img/...
assets/img/...
simboli/elementi-celesti/<temaGrafico>/...
```

e l'Astrolabio li normalizza ulteriormente.

## Procedura corrente sicura

Prima di usare un nuovo percorso:

1. cercare se la stessa classe di asset ha già un namespace;
2. preferire il pattern usato dal renderer attivo, non da `_old`;
3. verificare `OggettiSempliciRender.getMaterial()` e il prefisso che aggiunge;
4. verificare `GestoreImmagini.urlsAssetsGrafico()`;
5. verificare la copia degli asset nell'Astrolabio;
6. testare Linux/case-sensitive anche se sviluppo avviene su Windows;
7. evitare URL remoti dentro `SkinManager`.

## Target architetturale

Introdurre:

```ts
interface ChartAssetResolver {
  resolve(ref: ChartAssetRef): string | Promise<...>
}
```

con adapter separati:

```text
web
headless Astrolabio
SSR/worker futuro
```

---

# 14. Modifiche al modello `TemaRender`

È l'area a più alto rischio di compatibilità.

## Prima di aggiungere un campo

Documentare:

```text
nome canonico
tipo
unità (gradi/radianti, UTC/local, ecc.)
range
obbligatorio/opzionale
versione algoritmo
dipendenza dall'orario noto
dipendenza dalla domificazione
consumer che lo usa
```

## Compatibilità

Preferire aggiunte backward-compatible e fallback espliciti. Se cambia semanticamente un campo esistente, introdurre una versione del contratto piuttosto che cambiare silenziosamente il significato.

## Validazione

Il target è validare un DTO serializzato prima di entrare nel renderer. Il renderer non deve diventare il luogo in cui si scopre un payload malformato.

---

# 15. Gestione temi senza orario

Un tema può arrivare senza `houses` utilizzabili.

Prima di usare:

```ts
temaRender.houses[domificazione]
```

verificare che:

```text
houses esista
houses non sia vuoto
la domificazione selezionata esista
```

Il renderer principale ha fallback per alcune aree, ma modalità come:

- parti arabe;
- alcune direzioni;
- case;
- assi;
- Vertex;
- funzioni basate su cuspidi;

possono richiedere dati che un tema senza orario non possiede.

Il test “tema senza orario” è obbligatorio per nuove feature che leggono `houses`.

---

# 16. Lifecycle e disposal nelle estensioni

Quando si aggiunge una geometria o texture, prevedere da subito come verrà liberata.

## Non sufficiente

```ts
scene.clear()
```

Rimuove i riferimenti dalla scena ma non invoca automaticamente:

```text
geometry.dispose()
material.dispose()
texture.dispose()
```

## Nuovo codice

Evitare di creare:

- timeline GSAP infinite non registrate;
- listener DOM anonimi impossibili da rimuovere;
- texture nuove per asset identici senza cache/ownership;
- materiale per ogni segmento quando può essere condiviso.

Ogni feature che crea risorse persistenti deve avere una strategia di teardown.

---

# 17. Concorrenza e più grafici simultanei

Oggi non sono scenari sicuri per default:

```text
due GraficoRenderService indipendenti
thumbnail parallele
export PNG mentre il canvas principale ridisegna
worker paralleli
più scene con scale linee diverse
```

perché esiste stato statico condiviso in `OggettiSempliciRender` e `GestoreImmagini`, oltre al singleton Angular.

Prima di introdurre confronti affiancati o batch thumbnail, creare una `ChartRenderSession` isolata.

---

# 18. Checklist pre-commit per la libreria

## Codice

- [ ] modifica solo `shared/grafici-astrologici/src/` come sorgente;
- [ ] nessun nuovo auto-import dal package root dentro la libreria;
- [ ] nessun nuovo `any` se il tipo è conoscibile;
- [ ] nessun nuovo campo options non dichiarato;
- [ ] nessun nuovo asset remoto;
- [ ] nessun nuovo listener senza cleanup;
- [ ] nessuna nuova timeline infinita senza ownership;
- [ ] nessun output compilato modificato manualmente.

## Build

- [ ] `npm run build:grafici`;
- [ ] `npm run build:frontend`;
- [ ] `npm run build:astrolabio`.

## Render

- [ ] radix;
- [ ] tema senza case;
- [ ] transiti;
- [ ] sinastria;
- [ ] inversione australe;
- [ ] skin interessate;
- [ ] mobile PNG;
- [ ] headless Astrolabio quando il cambiamento raggiunge il device.

## Risorse

- [ ] nessun asset mancante;
- [ ] casing corretto;
- [ ] memoria stabile dopo redraw ripetuti;
- [ ] nessun listener duplicato;
- [ ] nessuna animazione orfana.

---

# 19. Checklist specifica per aggiornamenti Astrolabio

Dato che gli Astrolabi già consegnati devono poter ricevere gli aggiornamenti, una modifica della libreria destinata al device deve evitare assunzioni sull'hardware appena prodotto.

Verificare:

1. compatibilità con le configurazioni già salvate;
2. assenza di migrazioni distruttive dei setting;
3. fallback per nuove proprietà mancanti;
4. asset inclusi nell'update;
5. build headless riproducibile sul dispositivo;
6. output sulle dimensioni dei display esistenti;
7. nessun aumento incontrollato di memoria;
8. nessuna dipendenza da rete per il rendering base;
9. nessuna modifica manuale richiesta sul device;
10. rollback possibile dell'applicazione se la release fallisce.

---

# 20. Troubleshooting rapido

## “Sul web funziona, Astrolabio no”

Controllare nell'ordine:

```text
auto-import package root
path asset
asset non copiato nel node-cache/views
casing filename
bundle headless non rigenerato
output node-cache vecchio
API pubblica non esportata
browser API non disponibile nel contesto headless
```

## “Le linee sono troppo sottili/spesse”

Controllare:

```text
OggettiSempliciRender.dimensioniCanvas
baseWidth
lineScaleFactorMultiplier
LineMaterial.resolution
pixelRatio
profilo display Astrolabio
```

## “Il PNG differisce dal desktop”

Controllare:

```text
dimensioni/scalaa passate a generaImmagine
stato globale dimensioniCanvas
camera z/zoom
pixel ratio
asset caricati in momenti differenti
```

## “Manca un pianeta”

Controllare:

```text
TemaRender.planets[nome]
settaggi.elementi_celesti[nome].att
effemeridiGrafichePianetiAttivi
naming esatto
asset diretto/retrogrado
logica kleros/assi
```

## “Un aspetto non compare”

Controllare:

```text
aspetti_attivi
aspVerso di entrambi i nodi coinvolti
orb del nodo
aspetti_orbite override
wrap 0/360
esclusioni speciali
presenza declinazione per paralleli
```

## “La vista latitudini perde un corpo”

Verificare prima se `latitude` vale esattamente `0`: il controllo corrente usa truthiness e in quel caso esclude il corpo.

---

# 21. Direzione architetturale consigliata

Senza dover riscrivere tutto subito, far convergere il package verso questi confini:

```text
chart-contracts
  DTO, settings, options, schema/versioni

chart-core
  geometria pura, collisioni, aspetti, layout

chart-three
  adapter THREE.Group/materiali/texture

chart-angular
  GraficoRenderService e integrazione browser

chart-headless
  asset resolver e sessione Astrolabio/SSR
```

La separazione può essere inizialmente solo interna al monorepo. Il vantaggio principale è rendere testabile il comportamento astrologico/geometrico senza WebGL e impedire che esigenze specifiche di Angular o Astrolabio si propaghino nel core.

---

# 22. Definition of done per una modifica grafica

Una modifica è finita quando:

```text
codice sorgente aggiornato
+ tipi aggiornati
+ default coerenti
+ asset coerenti
+ build libreria passa
+ consumer web passa
+ consumer Astrolabio passa se coinvolto
+ fixture aggiornata
+ snapshot verificati
+ lifecycle verificato
+ documentazione aggiornata
```

“Compila” non è una definition of done sufficiente per `grafici-astrologici`, perché il contratto principale della libreria è anche **visuale, geometrico e cross-runtime**.
