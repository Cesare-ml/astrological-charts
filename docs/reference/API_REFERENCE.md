# `grafici-astrologici` — reference API e contratti runtime

Ultima revisione: **11 agosto 2026**

Questa reference descrive la superficie realmente esportata da `shared/grafici-astrologici/src/public-api.ts`, i contratti che i consumer devono rispettare e i side effect che oggi non sono espressi dai tipi.

È complementare a:

- `PUBLIC_API_AND_BUILD.md` per build e distribuzione;
- `MODELS_AND_SERIALIZATION.md` per il disegno futuro dei DTO;
- `RENDERER_MODULE_REFERENCE.md` per il comportamento dei renderer interni;
- `INTEGRATION_AND_EXTENSION_GUIDE.md` per uso ed estensione sicura.

> Sorgente normativo: `shared/grafici-astrologici/src/`.
> Le copie `_old`, i renderer JavaScript legacy e `astrolabio/backend/node-cache/grafici-astrologici/` non definiscono l'API corrente.

---

## 1. Entry point pubblico

L'unico entry point intenzionale è:

```ts
import {
  GraficoRenderService,
  Tema,
  TemaForm,
  TemaLocalDB,
  TemaRender,
  Posizione,
  PosizioneLocalDB,
  Citta,
  CittaLocalDB,
  Stato,
  Settaggi,
  SettaggiAstrolabio,
  settaggiDefault,
  settaggiAstrolabioDefault,
  OpzioniGrafico,
  defaultOpzioniGrafico,
  Colori,
  SkinManager,
  CartaAstraleCreaScena,
  OggettiSempliciRender,
  GestoreImmagini
} from 'grafici-astrologici';
```

`public-api.ts` esporta `_colori.config` due volte: è ridondante ma, al momento, innocuo. I renderer modulari (`SegniRender`, `CaseRender`, `ElementiCelestiRender`, `AspettiRender`, `TransitiRender`, `SinastriaRender`, `LatitudiniRender`) **non** fanno parte della superficie pubblica.

`GestoreEventiMouse` è implementato nel sorgente, ma non è esportato e non è collegato al rendering attivo.

### Livelli di stabilità

| Simbolo | Ruolo | Stabilità pratica |
|---|---|---|
| `GraficoRenderService` | adapter Angular/WebGL e PNG | alta dipendenza dei frontend, contratto ancora permissivo |
| `Tema`, `Posizione` | modelli web | ampiamente usati; attenzione ai getter mutanti |
| `TemaLocalDB`, `PosizioneLocalDB` | modelli Astrolabio locale | attivi sul dispositivo; duplicano logica web |
| `Settaggi`, `SettaggiAstrolabio` | configurazione astrologica/grafica | centrali ma con default e naming non perfettamente allineati |
| `TemaRender` | risultato del calcolo astrologico | criticissimo ma quasi completamente `any` |
| `OpzioniGrafico` | configurazione del rendering | incompleto rispetto a ciò che i renderer leggono realmente |
| `SkinManager` | tema visuale | attivo; struttura non tipizzata |
| `CartaAstraleCreaScena` | core compositivo Three.js | usato direttamente dall'headless Astrolabio |
| `OggettiSempliciRender` | primitive geometriche | attivo; mantiene stato statico globale |
| `GestoreImmagini` | caricamento/preload asset | attivo; cache principale attualmente disabilitata |
| `Colori` | palette semantiche | attivo per corpi/aspetti e funzioni speciali |

---

# 2. `GraficoRenderService`

File:

```text
src/lib/services/grafico-render.service.ts
```

Servizio Angular singleton:

```ts
@Injectable({ providedIn: 'root' })
export class GraficoRenderService implements OnDestroy
```

## Stato interno importante

- canvas HTML attivo;
- `THREE.WebGLRenderer` principale;
- `THREE.PerspectiveCamera` pubblica;
- `THREE.Scene` principale;
- zoom corrente;
- dimensioni nominali;
- sottoscrizione al resize;
- flag di inizializzazione;
- richiesta di render differita se chiamata prima dell'init.

Poiché il servizio è `providedIn: 'root'`, una applicazione Angular ne condivide normalmente **una sola istanza**.

## `inizializzaGraficoRender()`

```ts
inizializzaGraficoRender(
  canvas: ElementRef<HTMLCanvasElement>,
  dimensioni: { x: number; y: number }
): void
```

Effetti:

1. salva il canvas;
2. crea un nuovo `THREE.WebGLRenderer` con `alpha` e `antialias`;
3. inizializza `OggettiSempliciRender.dimensioniCanvas`;
4. crea scena e camera prospettica;
5. posiziona la camera a `z = 2.98`;
6. applica lo zoom corrente;
7. normalizza risoluzione e `LineMaterial`;
8. sottoscrive `window.resize` con debounce di 150 ms;
9. imposta `isInizializzato = true`.

### Precondizioni

- DOM/browser disponibile;
- `canvas.nativeElement` valido;
- WebGL disponibile;
- `window` disponibile.

Non è quindi un metodo Node/headless puro.

### Side effect

Modifica lo stato statico globale di `OggettiSempliciRender`. Una seconda sessione di rendering può influenzare lo spessore delle linee della prima.

## `disegnaScena()`

```ts
async disegnaScena(
  temaRender: TemaRender,
  temaRenderTransiti: TemaRender,
  temaRenderSinastria: TemaRender,
  grafico: string,
  opzioni: any
): Promise<void>
```

Comportamento:

- se `temaRender == null`, ritorna senza disegnare;
- riusa la scena ma invoca `scene.clear()`;
- imposta il background da `SkinManager.skins[opzioni.settaggi.skin_id].bgColor`;
- reintroduce la camera nella scena;
- seleziona il renderer:
  - `latitudini` → `LatitudiniRender.creaScena()`;
  - `carta-astrale` o qualunque altro valore → `CartaAstraleCreaScena()`;
- aggiunge il `THREE.Group` prodotto;
- chiama `render()`.

**Nota:** il parametro `opzioni` è `any` nonostante esista `OpzioniGrafico`. Il consumer può quindi passare uno stato non coerente senza errore TypeScript.

## `render()`

```ts
render(): void
```

Se il servizio non è ancora inizializzato, registra la richiesta e la eseguirà dopo `inizializzaGraficoRender()`. Altrimenti chiama:

```ts
renderer.render(scene, camera)
```

## zoom

```ts
setZoom(zoom: number): void
zoomIn(step = 0.04): void
zoomOut(step = 0.04): void
```

Range imposto:

```text
0.05 <= zoom <= 5
```

`setZoom()` aggiorna immediatamente la matrice di proiezione e ridisegna.

## `generaImmagine()`

```ts
async generaImmagine(
  temaRender: TemaRender,
  temaRenderTransiti: TemaRender,
  temaRenderSinastria: TemaRender,
  grafico: string,
  opzioni: any,
  dimensioni = { x: 1080, y: 1080 },
  scala = 2
): Promise<string>
```

Restituisce un **data URL PNG**.

Pipeline:

```text
document.createElement('canvas')
  -> WebGLRenderer offscreen
  -> camera/scena dedicate
  -> CartaAstraleCreaScena o LatitudiniRender
  -> renderer.render
  -> canvas.toDataURL('image/png')
  -> renderer.dispose
```

### Importante

La scena è locale, ma il metodo chiama comunque:

```ts
OggettiSempliciRender.setDimensioniCanvas(dimensioni)
```

Quindi l'export offscreen modifica lo stato globale usato dalle primitive e può interferire con un grafico interattivo contemporaneo.

`offRenderer.dispose()` viene eseguito, ma `scene.clear()` non libera automaticamente geometrie, materiali e texture create per la scena.

## `ngOnDestroy()`

Cancella l'eventuale animation frame e la sottoscrizione resize. Non esegue attualmente un disposal ricorsivo delle risorse Three.js del renderer principale.

---

# 3. Modelli tema e posizione

## `Tema`

```ts
class Tema {
  id: number;
  nome: string;
  data: string;
  ora: string;
  sesso?: string;
  orario_sconosciuto: boolean;
  img_nome?: string;
  utente_id: number;
  gruppi?: string[];
  note?: string;
  posizione_id: number;
  posizione: Posizione;
}
```

Il costruttore reidrata `posizione` in una vera istanza di `Posizione`.

### `getDataoraUtc()`

```ts
getDataoraUtc(): string
```

Interpreta `data + ora` nella timezone restituita da `posizione.getTz()`, converte in UTC e formatta:

```text
YYYY-MM-DD HH:mm:ss
```

Usa `moment-timezone`.

**Attenzione:** `getTz()` oggi può mutare `Posizione`, quindi anche `Tema.getDataoraUtc()` può avere un side effect indiretto sul modello.

## `TemaForm`

Estende `Tema` e aggiunge esclusivamente:

```ts
stato?: string
```

È un modello UI, non un DTO persistente distinto.

## `Stato`

Campi:

```text
id, nome, nome_it?, iso2
```

## `Citta`

Campi:

```text
id, nome, nome_it?, lat, lng, tz, tz_offs,
pop?, regione?, stato_id, stato
```

Il costruttore reidrata `stato`.

## `Posizione`

Supporta due forme:

```text
A. posizione manuale
   usa_posizione_manuale = true
   posizione_manuale = { nome?, lat?, lng?, tz? }

B. città
   usa_posizione_manuale = false
   citta_id + citta
```

Metodi pubblici:

```ts
getLng(): number
getLat(): number
getTz(): string
resetPosManuale(): void
resetCitta(): void
```

### Comportamento non ovvio dei getter

I tre getter **normalizzano distruttivamente** l'altro ramo:

- modalità manuale → cancellano `citta_id` e `citta`;
- modalità città → cancellano `posizione_manuale`.

Quindi non vanno trattati come funzioni pure.

---

# 4. Varianti LocalDB Astrolabio

## `TemaLocalDB`

Replica quasi integralmente `Tema` ma usa `PosizioneLocalDB`. Anche `getDataoraUtc()` è duplicato.

## `CittaLocalDB`

Contratto:

```text
_ObjId
citta
iso2
label
lat/lng
tz/tz_offs
pop?
regione?
stato
```

Il costruttore corrente **non assegna `_ObjId`**, anche se il campo è dichiarato e i dati locali possono contenerlo.

## `PosizioneLocalDB`

Replica la strategia di `Posizione`, inclusi getter mutanti e reset distruttivi.

---

# 5. `TemaRender`: contratto del motore astrologico

`TemaRender` è il payload centrale consumato dai renderer.

Campi dichiarati:

```ts
dataora: string
as: number
ds: number
mc: number
ic: number
planets: any
ascendenze?: any
sinodi?: any
letture?: any
fasiSinodiche: any
fasiSinodicheLatitudinali: any
lunazioniErmetiche: any
astrologiaOraria: any
orePlanetarie: any
partiArabe: any
houses: any
australInversion: boolean
```

## Schema effettivamente richiesto dal rendering principale

Per ogni corpo usato:

```ts
planets[nome] = {
  longitude: number,
  longitudeSpeed: number,
  latitude?: number,
  latitudeSpeed?: number,
  equatoriale?: {
    declination?: number
  },
  dodecatemoria?: {
    longitude: number
  }
}
```

Per le case:

```ts
houses[sistema] = {
  ascendant: number,
  mc: number,
  vertex?: number,
  house: number[] // 12 cuspidi attese
}
```

Alcune modalità richiedono inoltre strutture in `partiArabe`, `lunazioniErmetiche`, dati sinodici o temi secondari.

### Regola operativa

Prima di aggiungere nuovi consumer, non assumere che `TemaRender` sia auto-descrittivo: il vero schema è oggi distribuito tra backend e accessi dei renderer. Una futura API pubblica deve introdurre uno schema versionato e validazione al confine.

---

# 6. `Settaggi`

## Classi annidate

### `SettaggiElementoCeleste`

```ts
att = false
orb = 6
aspVerso = false
```

### `SettaggiElementiCelesti`

Contiene configurazioni per pianeti, luminari, trans-saturnini, assi, nodi, apsidi, Vertex, Chirone e kleroi/sorti (`Tyche`, `Daimon`, `Basis`, `Ananke`, `Eros`, `Hermes`, `Tolma`, `Nike`, `Nemesi`).

### `SettaggiAspettiAttivi`

Flag booleani per:

```text
congiunzione, opposizione, trigono, quadrato, quintile, sestile,
settile, semiquadrato, novile, semiquintile, semisestile,
phisolare, quinconce, biquintile, philunare,
parallelodideclinazione, antiparallelo
```

### `SettaggiAspettiOrbite`

Stesse chiavi, con override numerici opzionali dell'orbita.

## Campi principali di `Settaggi`

```text
id
skin_id
utente_id
tema_account_id
transaturnini_se_congiunti
pagina_dashboard
modalita_adesso_posizione_id
modalita_adesso_posizione
domificazione_selezionata
aspetti_attivi
aspetti_orbite
elementi_celesti
```

## Cataloghi statici

### Domificazioni

Attive nel catalogo:

```text
egizia
placido
regio-montano
porfirio
koch
```

`egiziaplacido` è ancora supportata da parti del renderer ma commentata nel catalogo.

### Aspetti e angoli

| Aspetto | Gradi |
|---|---:|
| congiunzione | 0 |
| opposizione | 180 |
| trigono | 120 |
| quadrato | 90 |
| quintile | 72 |
| sestile | 60 |
| settile | 51.42 |
| semiquadrato | 45 |
| novile | 40 |
| semiquintile | 36 |
| semisestile | 30 |
| phi solare | 222.49 |
| quinconce | 150 |
| biquintile | 144 |
| phi lunare | 137.50 |
| parallelo declinazione | sentinel `-1` |
| antiparallelo | sentinel `-2` |

## Default divergenti

```text
new Settaggi().domificazione_selezionata = "egizia"
settaggiDefault.domificazione_selezionata = "placido"
```

`settaggiDefault` è un object literal tipizzato come `Settaggi`, non una istanza costruita.

## Drift di naming da non ignorare

Il modello e l'API centrale espongono:

```text
transaturnini_se_congiunti
```

mentre `ElementiCelestiRender` legge:

```text
opzioni.settaggi.transaturniniSeCongiunti
```

Non introdurre nuovi utilizzi del nome camelCase: va prima normalizzato il contratto.

---

# 7. `SettaggiAstrolabio`

Campi:

```text
skin_id = dark-bn
inversione_in_australe = true
transaturnini_se_congiunti = true
domificazione_selezionata = egizia
modalita_adesso_posizione: PosizioneLocalDB
aspetti_attivi
aspetti_orbite
elementi_celesti
```

Il default literal `settaggiAstrolabioDefault` usa invece `placido` e incorpora attualmente una posizione di default concreta.

Il file importa `PosizioneLocalDB` dal package root:

```ts
import { PosizioneLocalDB } from 'grafici-astrologici';
```

È un auto-import interno da evitare perché la pipeline headless riscrive solo alcuni alias.

---

# 8. `OpzioniGrafico`

È il contratto di composizione del grafico, ma include sia configurazione sia stato UI temporaneo.

## Aree principali

### Aspetto generale

```text
settaggi
temaGrafico
```

### Effemeridi

```text
mostraEffemeridi
effemeridiGrafiche
effemeridiGrafichePianetiAttivi
```

### Dodecatemori / chakram

```text
elementi.mostraDodecatemori
dodecatemoriAttivi
dodecatemore
chakramAttivi
chakram
```

### Aspetti e focus

```text
mostraAspetti
aspettiHoverEl
aspettiHoverAnello
temaRadixFocusAspettiAttivo
temaRadixElementoCelesteFocusAspetti
orePlanetMostraAspetti
```

### Transiti

```text
mostraTransiti
mostraTransitiSinodici
transitoSinodicoNomePianeta
transitoSinodicoFase
transitoSinodicoLunaNeraConjCount
transitoSinodicoSinastriaConRadix
transitoSinodicoFissatoInBackground
temaTransitiSinodoRender
```

### Sinastria

```text
mostraSinastria
sinastria.sinastriaDeflettiva
sinastria.deflettiSuCasa
sinastria.invertiTemi
```

### Modalità speciali

Comprende inoltre ritorni solari/lunari, sizigia, stagioni, termini, monomeri, antisci, ascendenze, lunazioni ermetiche, astrologia oraria, parti arabe, sinodi, kleros, stelle fisse e direzioni.

## Contratto dichiarato vs contratto reale

Sono noti accessi runtime non rappresentati correttamente dal tipo:

- `mostraDecani`;
- `mostraDecadi`;
- kleros `estrapola-tutto`;
- kleros `estrapola-4luminarie`;
- kleros `estrapola-5planetarie`;
- valori stringa come `"tutti"` letti dentro `antisci`, mentre l'interfaccia dichiara booleani;
- skin `astrolabio-girasole` non inclusa nella union `TemaGrafico`.

Per nuove funzioni, aggiornare prima il tipo e poi i consumer; non continuare ad affidarsi ad `any`.

---

# 9. `CartaAstraleCreaScena`

API pubblica low-level:

```ts
async function CartaAstraleCreaScena(
  opzioni,
  temaRender,
  temaRenderTransiti,
  temaRenderSinastria
): Promise<THREE.Group | null>
```

È il punto di ingresso usato dall'Astrolabio headless, che non istanzia `GraficoRenderService`.

Restituisce un `THREE.Group` già composto ma **non** crea renderer, scena o camera.

La composizione interna è documentata in `RENDERER_MODULE_REFERENCE.md`.

## `StatoCartaAstrale`

È esportato insieme al renderer e rappresenta il context mutabile dell'orchestrazione. Contiene temi, opzioni, diametri, scale, assi e riferimenti ai gruppi già creati.

Non deve essere considerato un DTO stabile: contiene oggetti Three.js e campi `any`.

---

# 10. `SkinManager`

API attuale:

```ts
class SkinManager {
  static skins = { ... }
}
```

Non esistono metodi di lookup, validazione o fallback. I renderer leggono direttamente:

```ts
SkinManager.skins[skin_id].<sezione>.<campo>
```

Skin presenti nel sorgente corrente:

```text
dark
dark-bn
light
light-bn
sun
astrolabio
astrolabio-girasole
```

Schema concettuale minimo:

```ts
{
  bgColor,
  elementi: [fuoco, terra/aria/acqua secondo convenzione corrente],
  cerchioAspetti: {...},
  anelloElementiCelesti: {...},
  anelloSegni: {...},
  anelloCase: {...},
  anelloTransiti: {...},
  latitudini: {
    elementiCelesti: {...}
  }
}
```

Alcune sezioni possono avere override `.sinastria`.

Una skin incompleta può fallire in profondità durante il rendering: non c'è validazione preventiva.

---

# 11. `Colori`

Contiene palette semantiche condivise:

```text
Colori.elementiCelesti
Colori.chakram
Colori.elementi
Colori.aspetti
```

I colori delle skin e `Colori` hanno responsabilità diverse:

- `SkinManager` controlla lo stile strutturale del grafico;
- `Colori` assegna colori semantici a corpi/aspetti e ad alcune modalità di evidenziazione.

---

# 12. `OggettiSempliciRender`

Factory statica di primitive Three.js.

## Stato statico

```ts
dimensioniCanvas
baseWidth = 1300
lineScaleFactorMultiplier = 1
```

Metodi di configurazione:

```ts
setDimensioniCanvas({ x, y })
getLineScaleFactor()
getMatLineResolutionSizes()
```

## Primitive principali

```text
getCerchio
getAnello
getSemiArcoGrosso
getLinea
getLineaGrossa
getLineaGrossaTratteggiata
getLineaGrossaPuntoLinea
createFatLineGeometry
createFatLine
getTesto
getQuadrilatero
getTriangolo
getArco
getSfondoQuadrato
getImg
getMaterial
lanciaFrecciaAdArco
```

### Linee spesse

Usano:

```text
three/examples/jsm/lines/Line2
LineMaterial
LineGeometry
```

Lo spessore viene scalato rispetto a `dimensioniCanvas.x / 1300` e al moltiplicatore globale.

### Texture immagini

`getMaterial()` normalizza implicitamente il riferimento aggiungendo:

```text
../../../assets/img/
```

prima di delegare a `GestoreImmagini.loadAsync()`.

Questo dettaglio è parte del contratto runtime attuale, anche se va sostituito da un asset resolver esplicito.

### Edge case noti

- linee tratteggiate/punto-linea possono calcolare `segmenti = 0` se la distanza è inferiore al passo, con divisioni successive per zero;
- `getTesto()` crea una `THREE.Texture` da canvas ma lascia `texture.needsUpdate = true` commentato;
- ogni chiamata tende a creare nuove geometrie/materiali/texture senza registry centralizzato.

---

# 13. `GestoreImmagini`

Stato:

```ts
static assetsBase = ''
private static pool = new Map<string, THREE.Texture>()
```

## `getImg(ref)`

Caricamento sincrono-lazy tramite `TextureLoader.load()`.

La logica di riuso dal `pool` è presente ma commentata: al momento crea normalmente una nuova texture.

## `loadAsync(ref)`

Restituisce `Promise<THREE.Texture>`; anche qui la cache principale è disabilitata.

## `preload(ref)`

È il percorso che usa realmente `pool`.

## `cleanCache()`

Invoca `dispose()` solo sulle texture memorizzate nel pool e poi lo svuota. Non può quindi liberare tutte le texture create tramite i due loader principali.

## `preloadImages(urls)`

Usa oggetti DOM `Image`: pre-carica la risorsa nel browser, ma non crea una texture Three.js riutilizzabile.

## `preloadAssetsGrafico()` / `urlsAssetsGrafico()`

Compongono la lista da:

- risuonatore solare;
- tutte le `texture` trovate ricorsivamente nelle skin;
- lista hardcoded di simboli case, elementi, corpi celesti e segni.

---

# 14. `GestoreEventiMouse` — API interna dormiente

File:

```text
src/lib/renderers/@gestore-eventi-mouse.ts
```

Non è esportato dalla public API.

Costruttore:

```ts
new GestoreEventiMouse(canvas, camera, scene, callbacks)
```

Callback supportate:

```ts
onClick?
onHoverEnter?
onHoverLeave?
```

Usa `THREE.Raycaster` e interseca ricorsivamente `scene.children`.

Il metodo:

```ts
distruggi(): void
```

rimuove correttamente listener `mousemove`, `click` e `resize`.

Nei renderer attivi restano blocchi commentati che mostrano una precedente integrazione degli eventi con i simboli. Prima di riattivarla va progettato un contratto di metadata degli oggetti e un lifecycle unico col componente Angular.

---

# 15. Dipendenze runtime reali

Il sorgente usa direttamente:

```text
@angular/core
@angular/common
three
three/examples/jsm/lines/*
rxjs
moment-timezone
gsap
tslib
```

Il `package.json` della libreria dichiara attualmente come peer soltanto Angular e come dependency `tslib`. Questo significa che il monorepo fornisce implicitamente dipendenze non dichiarate dal package.

---

# 16. Contratto minimo per un render carta astrale

Un consumer deve fornire almeno:

```text
TemaRender radix valido
Opzioni con settaggi
skin_id esistente
sistema di domificazione coerente con houses, se si mostrano case/assi
planets per i corpi attivi
asset risolvibili
canvas/dimensioni valide nel renderer host
```

Con transiti:

```text
opzioni.mostraTransiti = true
temaRenderTransiti != null
```

Con sinastria:

```text
opzioni.mostraSinastria = true
temaRenderSinastria != null
```

Il renderer tollera alcuni `houses` assenti, ma non tutte le modalità speciali sono compatibili con un tema senza orario.

---

# 17. Esempi minimi

## Angular interattivo

```ts
constructor(private grafici: GraficoRenderService) {}

ngAfterViewInit() {
  this.grafici.inizializzaGraficoRender(
    this.rendererCanvas,
    { x: 1200, y: 1200 }
  );
}

async render() {
  await this.grafici.disegnaScena(
    this.radix,
    this.transiti,
    this.sinastria,
    'carta-astrale',
    this.opzioni
  );
}
```

## PNG browser

```ts
const dataUrl = await this.grafici.generaImmagine(
  radix,
  transiti,
  sinastria,
  'carta-astrale',
  opzioni,
  { x: 1080, y: 1080 },
  1
);
```

## Low-level Three.js / headless browser

```ts
const group = await CartaAstraleCreaScena(
  opzioni,
  radix,
  transiti,
  sinastria
);

scene.add(group);
renderer.render(scene, camera);
```

Il low-level consumer è responsabile di renderer, camera, scena, asset resolver e disposal.

---

# 18. Regole per evolvere l'API

1. Non esportare un modulo interno solo per evitare un import relativo: correggere prima l'architettura.
2. Non aggiungere proprietà lette dal renderer senza inserirle nel tipo `OpzioniGrafico` e nei default.
3. Non aggiungere campi a `TemaRender` senza documentarne schema, unità e opzionalità.
4. Non introdurre nuovi auto-import `from 'grafici-astrologici'` dentro la libreria stessa.
5. Non introdurre nuovi percorsi asset hardcoded: usare il flusso documentato in `INTEGRATION_AND_EXTENSION_GUIDE.md`.
6. Considerare ogni modifica a diametri, offset, ordine dei gruppi o z-index come **breaking change visuale**, anche se TypeScript compila.
7. Ogni nuova API pubblica deve avere un consumer test o fixture che ne dimostri il contratto.
8. Il target desiderato è ridurre progressivamente `any`, non estenderlo.
