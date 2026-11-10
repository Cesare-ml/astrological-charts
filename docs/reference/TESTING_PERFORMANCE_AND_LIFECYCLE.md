# Test, performance e lifecycle

Ultima revisione: **5 agosto 2026**

## Stato test

Non risultano file `*.spec.ts` attivi nella libreria. `tsconfig.lib.json` esclude comunque gli spec dalla build del package.

Il comando root `npm test` non equivale a una suite dedicata e non verifica automaticamente:

- output visuale;
- build headless;
- asset;
- memoria GPU;
- compatibilità e-ink;
- contratti `TemaRender`;
- determinismo fra browser.

## Lifecycle del renderer principale

`GraficoRenderService.ngOnDestroy()`:

- cancella un eventuale frame animation;
- rimuove la sottoscrizione RxJS al resize.

Non risultano cleanup completi per:

- renderer WebGL principale;
- geometrie;
- materiali;
- texture;
- WebGL context;
- gruppi rimossi con `scene.clear()`.

`scene.clear()` scollega gli oggetti, ma non invoca `dispose()` sulle risorse GPU.

## Renderer offscreen

`generaImmagine()` dispone il renderer offscreen e pulisce la scena, ma non visita il grafo per liberare geometrie, materiali e texture. Esportazioni ripetute possono quindi aumentare la memoria.

Inoltre modifica `OggettiSempliciRender.dimensioniCanvas`, stato globale condiviso con il grafico interattivo.

## Texture

La cache attiva non copre i caricamenti principali. Ogni simbolo può creare nuove texture anche quando lo stesso asset è già stato usato.

Mancano:

- reference counting;
- registry per URL;
- invalidazione per skin;
- disposal quando una scena viene sostituita;
- metriche su texture e memoria;
- limite per cache mobile.

## Geometrie e materiali

Ogni ridisegno ricrea numerosi:

- `RingGeometry`;
- `ShapeGeometry`;
- `PlaneGeometry`;
- `LineGeometry`;
- `MeshBasicMaterial`;
- `LineMaterial`.

Una carta con molti aspetti e più temi può generare molti oggetti piccoli. Senza pooling/disposal, un ridisegno frequente è costoso.

## GSAP

Gli elementi evidenziati possono creare timeline infinite. Le timeline non vengono registrate nello stato del grafico né terminate quando il gruppo viene rimosso.

Serve un lifecycle per:

- creare animazioni;
- metterle in pausa quando invisibili;
- interromperle al redraw;
- distruggerle con il renderer.

## Event listener

Il servizio gestisce correttamente la sottoscrizione RxJS del resize. Il componente frontend aggiunge però listener DOM per mouse/touch/pan e non tutti risultano rimossi nel destroy.

`GestoreEventiMouse` possiede invece un metodo `distruggi()`, ma non risulta collegato al flusso attivo.

## Singleton

Un solo `GraficoRenderService` rende semplice il grafico principale, ma limita:

- più grafici simultanei;
- thumbnail parallele;
- confronti affiancati;
- test concorrenti;
- rendering in worker;
- isolamento fra componenti.

Direzione consigliata: introdurre un `ChartRenderSession` per canvas/scena, mantenendo un servizio factory Angular.

## Performance da misurare

Per ogni scenario:

- tempo costruzione scena;
- tempo caricamento asset;
- draw calls;
- numero geometrie/materiali/texture;
- memoria JS e GPU;
- dimensione PNG;
- tempo export;
- frame rate durante zoom/pan;
- comportamento dopo 50–100 redraw;
- differenza desktop/mobile/headless.

Scenari minimi:

1. radix senza case;
2. radix completo;
3. molti aspetti;
4. transiti;
5. sinastria;
6. termini e decani;
7. parti arabe;
8. latitudini;
9. inversione australe;
10. ogni skin;
11. export 1080×1080;
12. display e-ink supportati.

## Strategia di test

### Test modelli

- reidratazione JSON;
- conversione UTC con DST;
- ora sconosciuta;
- posizione manuale/città;
- nessuna mutazione dei getter dopo correzione;
- serializzazione round-trip;
- compatibilità LocalDB.

### Contract test

Validare fixture `TemaRender` con JSON Schema:

- pianeti richiesti;
- case per ogni domificazione;
- assi;
- range numerici;
- campi facoltativi;
- versione algoritmo.

### Test geometrici

Senza confrontare pixel:

- numero gruppi;
- angoli principali;
- ordine dei moduli;
- rotazione australe;
- posizione assi/cuspidi;
- esclusione/inclusione corpi;
- archi aspetti attesi.

### Visual regression

Generare PNG deterministici e confrontarli con tolleranza per:

- browser Chromium;
- Firefox headless Astrolabio;
- skin;
- dimensione;
- modalità.

Le baseline devono indicare:

- commit libreria;
- fixture dati;
- browser/versione;
- GPU/software renderer;
- sistema operativo;
- asset manifest.

### Test asset

- tutti i riferimenti esistono;
- nessun problema di maiuscole/minuscole;
- checksum atteso;
- loader web/headless equivalenti;
- errore controllato su mancanza.

### Test lifecycle

Dopo molti redraw:

- nessuna crescita non limitata di texture;
- nessun listener duplicato;
- nessuna timeline attiva orfana;
- renderer precedente disposto;
- canvas rimosso correttamente;
- contatore `renderer.info.memory` stabile.

## Refactoring consigliato

Separare:

```text
@virgostars/chart-contracts
@virgostars/chart-core
@virgostars/chart-three
@virgostars/chart-angular
@virgostars/chart-headless
```

Non è obbligatorio pubblicare package distinti subito; i confini possono essere introdotti internamente.

Principi:

- core geometrico puro e testabile;
- adapter asset iniettato;
- sessione renderer non globale;
- dispose ricorsivo;
- tipi rigorosi;
- snapshot in CI;
- build headless ufficiale.
