import * as THREE from 'three';
import { SegniRender } from '../moduli/segni.renderer';
import { CaseRender } from '../moduli/case.renderer';
import {ElementiCelestiRender} from '../moduli/elementi-celesti.renderer'
import {AspettiRender} from '../moduli/aspetti.renderer'
import { TransitiRender } from '../moduli/transiti.renderer';
import { SkinManager } from '../@skin-manager';
import { SinastriaRender } from '../moduli/sinastria.renderer';
import { OggettiSempliciRender } from '../oggetti-semplici.renderer';

// ---------------------------
// Stato globale per tutti i renderer
// ---------------------------
export interface StatoCartaAstrale {
    opzioni: any;
    temaRender: any;
    temaRenderTransiti: any;
    temaRenderSinastria: any;
    temaRenderDirezione?: any;
    diametri: any;
    simboliScale: any;
    asc: number;
    mc: number;
    ascSinastria: number;
    mcSinastria: number;
    forzaUsaAssiInElementiCelesti: boolean;
    calcolaPartiArabe: boolean;

    // Gruppi già renderizzati
    gruppoSegni?: THREE.Group;
    gruppoCase?: THREE.Group;
    gruppoElementiCelesti?: THREE.Group;
    gruppoAspetti?: THREE.Group;
    gruppoTransiti?: THREE.Group;
    // altri gruppi modulari come transiti, sinastria, ecc.
}

// ---------------------------
// Helpers
// ---------------------------
function isEmpty(obj) {
    return Object.keys(obj).length === 0;
}

function setOpacity( obj, opacity ) {
  obj.children.forEach((child)=>{
    setOpacity( child, opacity );
  });
  if ( obj.material ) {
    obj.material.opacity = opacity ;
  };
}

// ---------------------------
// Inizializzazione stato
// ---------------------------
function creaStatoCartaAstrale(opzioni, temaRender, temaRenderTransiti, temaRenderSinastria): StatoCartaAstrale | null {

    if (!temaRender || !opzioni) return null;
    let temaRenderDirezione;
    if (opzioni.mostraDirezioni && opzioni.direzioni2ndTemaRender) {
        temaRenderDirezione = opzioni.direzioni2ndTemaRender;
    }

    if (opzioni.mostraSinastria && opzioni.sinastria?.invertiTemi) {
        [temaRender, temaRenderSinastria] = [temaRenderSinastria, temaRender];
    }

    
    var forzaUsaAssiInElementiCelesti = false;
    if(opzioni.mostraTransiti || opzioni.mostraDirezioni) {
      forzaUsaAssiInElementiCelesti = true;
    }

    // Parti Arabe
    var calcolaPartiArabe = false;
    if(
      opzioni.mostraPartiArabe
      && (
        (
          opzioni.partiArabe.elDestinazione
          && opzioni.partiArabe.nomeElCeleste
          && temaRender.planets[opzioni.partiArabe.nomeElCeleste]
          && opzioni.partiArabe.modalita == 'crea'
        ) || (
          opzioni.partiArabe.formulaSelezionataIndex != undefined
          && opzioni.partiArabe.formulaAbumasharCasaSelezionata != undefined
          && opzioni.partiArabe.modalita == 'abumashar'
        ) || (
          opzioni.partiArabe.formulaSelezionataIndex != undefined
          && opzioni.partiArabe.modalita == 'essenziali'
        )
      )
    ) {
      calcolaPartiArabe = true;
    }


    const {diametri, simboliScale} = calcolaDiametri(opzioni, temaRender, temaRenderTransiti, temaRenderSinastria);

    const asc = temaRender?.houses?.[opzioni.settaggi.domificazione_selezionata]?.ascendant || 0;
    const mc = temaRender?.houses?.[opzioni.settaggi.domificazione_selezionata]?.mc || 0;
    const ascSinastria = temaRenderSinastria?.houses?.[opzioni.settaggi.domificazione_selezionata]?.ascendant || 0;
    const mcSinastria = temaRenderSinastria?.houses?.[opzioni.settaggi.domificazione_selezionata]?.mc || 0;

    return {
        opzioni,
        temaRender,
        temaRenderTransiti,
        temaRenderSinastria,
        temaRenderDirezione,
        diametri,
        simboliScale,
        asc,
        mc,
        ascSinastria,
        mcSinastria,
        forzaUsaAssiInElementiCelesti,
        calcolaPartiArabe
    };
}

// 2. Calcolo diametri
function calcolaDiametri(opzioni, temaRender, temaRenderTransiti, temaRenderSinastria) {

    const diametri: any = {};

    // ---------------------------
    // Settaggio proporzioni grafico
    // ---------------------------
    let simboliScaleAnelloSegni = 1.05;
    let simboliScaleAnelloElementiCelesti = 1;
    let simboliScaleCase = 0.9;

    // Diametro base anello segni
    let diametroAnelloSegni = opzioni.mostraTransiti ? 3.7355 : 4.5723;

    // Transiti sinodici
    if (opzioni.mostraTransitiSinodici && temaRender?.transitiSinodici) {
        diametroAnelloSegni = 1.4;
        simboliScaleAnelloSegni = 0.4;
        simboliScaleAnelloElementiCelesti = 0.4;
        simboliScaleCase = 0.4;
    }
    diametri.diametroAnelloSegni = diametroAnelloSegni;

    // Diametri proporzionali
    const proporzioni = {
        diametroAnelloTransitiSinodici: 440 / 120,
        diametroUltimaOrbitaTransitiSinodici: 412.5 / 120,
        diametroAssiTransiti: 152.64 / 120,
        diametroAnelloStelleFisse: 146.64 / 120,
        diametroAnelloTransiti: 146.64 / 120,
        diametroAssi: 138 / 120,
        diametroGrigliaTransiti: 120/120, //122.56 / 120,
        diametroAnelloElementiCelesti: 95.82 / 120,
        diametroCerchioDodecatemori: 91.66 / 120,
        diametroCerchioDodecatemori2: 87.5 / 120,
        diametroInternoMiniArcoCase: 75.1 / 120,
        diametroAnelloCase: 74.16 / 120,
        diametroCerchioInternoTermini: 70.03 / 120,
        diametroInternoAnelloCase: 63.36 / 120
    };

    for (const key in proporzioni) {
        diametri[key] = diametroAnelloSegni * proporzioni[key as keyof typeof proporzioni];
    }

    

    // Direzioni
    if (
        (opzioni.direzioniModalita === 'primarieSemplificate' ||
            opzioni.direzioniModalita === 'simboliche') &&
        (opzioni.direzioni2ndTemaRender ||
            (opzioni.mostraLunazioniErmetiche && temaRender?.lunazioniErmetiche))
    ) {
        diametri.diametroAnelloCase = diametri.diametroInternoAnelloCase;
        diametri.diametroInternoAnelloCase = diametroAnelloSegni * 57.96 / 120;
        simboliScaleCase = 0.5;
    }

    // Transiti sinodici con sinastria
    if (opzioni.mostraTransitiSinodici && opzioni.transitoSinodicoSinastriaConRadix) {
        diametri.diametroAnelloCase = diametroAnelloSegni * 39.03 / 120;
        diametri.diametroInternoAnelloCase = diametroAnelloSegni * 28.23 / 120;
        simboliScaleCase = 0.7;
        simboliScaleAnelloElementiCelesti = 0.7;
    }

    // Chakram
    if (opzioni.chakramAttivi && opzioni.chakram) {
        diametri.diametroCerchioAspetti = diametri.diametroInternoAnelloCase * Math.sqrt(2) / 2;
    } else {
        diametri.diametroCerchioAspetti = diametri.diametroInternoAnelloCase;
    }

    // Sinastria
    if (opzioni.mostraSinastria) {
        simboliScaleCase = 0.7;
        diametri.diametroCerchioInternoTermini = false;

        diametri.diametroInternoAnelloCase = diametroAnelloSegni * 68.76 / 120;
        diametri.diametroCerchioAspetti = diametroAnelloSegni * 37 / 120;
    }  else if(!temaRender.houses || isEmpty(temaRender.houses)){
        //non e' sinastria e il tema e' senza orario
        diametri.diametroCerchioAspetti = diametri.diametroInternoMiniArcoCase;
    }

    // Diametri sinastria separati
    diametri.diametroAnelloCaseSinastria = diametri.diametroInternoAnelloCase;
    diametri.diametroAnelloElementiCelestiSinastria = diametroAnelloSegni * 63.36 / 120;
    diametri.diametroAnelloSegniSinastria = diametroAnelloSegni * 45.6666667 / 120;

    if (opzioni.mostraSinastria && !(temaRender?.houses && Object.keys(temaRender.houses).length)) {
        diametri.diametroAnelloElementiCelestiSinastria = diametri.diametroAnelloCaseSinastria;
        diametri.diametroAnelloCaseSinastria = diametri.diametroAnelloCase;
    }
    

    if (!(temaRenderSinastria?.houses && Object.keys(temaRenderSinastria.houses).length)) {
        diametri.diametroAnelloElementiCelestiSinastria = diametri.diametroAnelloCaseSinastria;
    }

    // Effemeridi
    if ((opzioni.mostraEffemeridi && opzioni.effemeridiGrafiche) || !temaRender?.houses || isEmpty(temaRender.houses)) {
        diametri.diametroInternoAnelloCase = diametri.diametroAnelloCase;
    }

    var simboliScale:any = {};
    // Valori finali di simboli scale e imgCase
    simboliScale.AnelloSegni = simboliScaleAnelloSegni;
    simboliScale.AnelloElementiCelesti = simboliScaleAnelloElementiCelesti;
    simboliScale.Case = simboliScaleCase;

    //diametri.coloreCerchio = coloreCerchio;

    // Elementi Celesti
    diametri.diametroInternoAnelloElementoCelesti = diametri.diametroInternoMiniArcoCase;
    // Orario Sconosciuto togle le case ed assi
    diametri.diametroEsternoAnelloElementoCelesti = diametri.diametroAnelloElementiCelesti;
    diametri.diametroDodecatemoriAnelloElementoCelesti = diametri.diametroCerchioDodecatemori;
    if(opzioni.antisci['Cardinale'] == 'tutti' || opzioni.antisci['Fissa'] == 'tutti' || opzioni.antisci['Mutevole'] == 'tutti') {
      diametri.diametroEsternoAnelloElementoCelesti = diametri.diametroCerchioDodecatemori;
      diametri.diametroDodecatemoriAnelloElementoCelesti = diametri.diametroCerchioDodecatemori2;
    }


    return {diametri, simboliScale};
}


// ---------------------------
// Funzioni helper modulari
// ---------------------------
/*
async function creaStelle(stato: StatoCartaAstrale) {
    return await StelleFisseRender.getAnelloStelleFisse(stato);
}*/

async function creaSegni(stato: StatoCartaAstrale) {
    const group = await SegniRender.getAnelloSegni(
      stato.asc,
      stato.simboliScale.AnelloSegni,
      stato.diametri.diametroAnelloElementiCelesti,
      stato.diametri.diametroAnelloSegni,
      stato.temaRender.australInversion,
      stato.opzioni.mostraDecani,
      stato.opzioni.mostraDecadi,
      stato.opzioni
    );
    stato.gruppoSegni = group;
    return group;
}

async function creaCase(stato: StatoCartaAstrale) {
    let group;
    if(
        !(stato.opzioni.mostraEffemeridi && stato.opzioni.effemeridiGrafiche)
        && stato.temaRender.houses && !isEmpty(stato.temaRender.houses)
    ) {
        group = await CaseRender.getAnelloCaseCartaAstrale(
            stato.temaRender.houses,
            0,
            stato.simboliScale.Case, //simboli scale
            stato.diametri.imgCase,
            stato.opzioni,
            /*
            diametroInternoAnelloCase,
            diametroAnelloCase,*/
            stato.diametri.diametroInternoAnelloCase,
            stato.diametri.diametroInternoMiniArcoCase,
            stato.diametri.diametroAnelloElementiCelesti,
            stato.diametri.diametroCerchioInternoTermini,
            stato.temaRender.australInversion && !stato.opzioni.mostraSinastria
        );
        stato.gruppoCase = group;
        return group;
    } else {
        group = new THREE.Group();

        const {coloreLinea, texture, coloreTexture} 
            = SkinManager.skins[stato.opzioni.settaggi.skin_id].anelloCase;
    
        if ( !texture ) {
            const cerchioInterno = await OggettiSempliciRender.getCerchio(
                stato.diametri.diametroInternoAnelloCase/2,
                coloreLinea
            );
            const cerchioEsterno = await OggettiSempliciRender.getCerchio(
                stato.diametri.diametroAnelloElementiCelesti/2,
                coloreLinea
            );
            group.add(cerchioInterno);
            group.add(cerchioEsterno);
        } else {
            const arco = OggettiSempliciRender.getSemiArcoGrosso(
                0,//+ 0.4,
                360,//- 0.4,
                stato.diametri.diametroInternoAnelloCase/2,
                stato.diametri.diametroAnelloElementiCelesti/2,
                coloreTexture,
                texture
            );
            arco.position.z = -0.0009;
            group.add(arco);
        }
    }
    return group;
}

async function creaElementiCelesti(stato: StatoCartaAstrale) {
    const group = await ElementiCelestiRender.getAnelloElementiCelesti(
        stato.temaRender,
        stato.asc,
        [],//stato.elementiCelestiDaColorare.main,
        stato.simboliScale.AnelloElementiCelesti,
        stato.opzioni,
        [],//['monomeri','antisci','aspetti-main','aspetti-main-radix'],
        [],//['monomeri'],
        stato.diametri.diametroInternoAnelloElementoCelesti,
        stato.diametri.diametroAnelloElementiCelesti,
        stato.diametri.diametroDodecatemoriAnelloElementoCelesti,
        true,
        stato.temaRender.australInversion && !stato.opzioni.mostraSinastria,
        'longitude',
        stato.forzaUsaAssiInElementiCelesti, //usaAssi
        stato.calcolaPartiArabe,
        0,//degOffs
        0,//offsDirezioniSemplificate
        0,//offsDirezioniSemplificateFasullo
        false//cerchia la luna
    );
    stato.gruppoElementiCelesti = group;
    return group;
}


async function creaAspetti(stato: StatoCartaAstrale) {
    if (!stato.opzioni.mostraAspetti) return null;

    var nomeElementoCelesteInEvidenza:any = false;
    if(stato.opzioni.temaRadixElementoCelesteFocusAspetti && stato.opzioni.temaRadixFocusAspettiAttivo) {
        nomeElementoCelesteInEvidenza = stato.opzioni.temaRadixElementoCelesteFocusAspetti.nome;
    }
    if(stato.opzioni.dodecatemore && stato.opzioni.dodecatemore!='tutti') {
        nomeElementoCelesteInEvidenza = stato.opzioni.dodecatemore+'-dodecatemoria';
    }

    let monocoloreLineeAspetti: string|boolean = false;
    if(SkinManager.skins[stato.opzioni.settaggi.skin_id].cerchioAspetti.monocoloreLineeAspetti) {
        monocoloreLineeAspetti = SkinManager.skins[stato.opzioni.settaggi.skin_id].cerchioAspetti.monocoloreLineeAspetti;
    } else {
        monocoloreLineeAspetti = stato.opzioni.mostraAntisci?'#444':false;
    }

    const group = await AspettiRender.getCerchioAspetti(
        stato.asc,
        stato.temaRender,
        stato.opzioni,
        stato.diametri.diametroCerchioAspetti,
        monocoloreLineeAspetti,
        stato.calcolaPartiArabe,
        nomeElementoCelesteInEvidenza,
        stato.temaRender.australInversion && !stato.opzioni.mostraSinastria
    );
    stato.gruppoAspetti = group;
    return group;
}



async function creaTransiti(stato: StatoCartaAstrale) {
    if(
        !(
            stato.opzioni.mostraTransiti 
            && stato.temaRenderTransiti 
            && !(
                stato.opzioni.mostraTransitiSinodici 
                && stato.opzioni.transitoSinodicoSinastriaConRadix
            )
        )
    ) {
        return null;
    }
    const group = await TransitiRender.getAnelloTransiti(
        stato.temaRenderTransiti,
        stato.asc,
        [],//stato.elementiCelestiDaColorare.transiti,
        stato.opzioni,
        stato.diametri.diametroGrigliaTransiti,
        stato.diametri.diametroAnelloTransiti,
        stato.diametri.diametroAssiTransiti,//diametro degli assi
        true
    );
    stato.gruppoTransiti = group;
    return group;
}


async function creaSinastria(stato: StatoCartaAstrale) {
    if (!stato.opzioni.mostraSinastria) return null;

    const group = await SinastriaRender.getAnelloSinastria(
        stato.temaRenderSinastria,
        stato.asc,
        [],//stato.elementiCelestiDaColorare.sinastria,
        stato,
        stato.diametri.diametroAssi,
        stato.diametri.diametroCerchioAspetti,
        stato.diametri.diametroAnelloSegniSinastria,
        stato.diametri.diametroAnelloElementiCelestiSinastria,
        stato.diametri.diametroAnelloElementiCelestiSinastria,
        stato.diametri.diametroAnelloCaseSinastria
    );
    stato.gruppoTransiti = group;
    return group;
}

async function aggiornaModuli(disegno: THREE.Group, stato: StatoCartaAstrale, moduli: ((stato: StatoCartaAstrale)=>Promise<THREE.Group|null>)[]) {
    for (const modulo of moduli) {
        // Rimuove il gruppo precedente se esiste
        const nomeGruppo = 'gruppo' + modulo.name.replace('crea','');
        if (stato[nomeGruppo]) {
            disegno.remove(stato[nomeGruppo]);
        }
        // Ricrea e salva nel stato
        const nuovoGruppo = await modulo(stato);
        if(nuovoGruppo) disegno.add(nuovoGruppo);
    }
}

// ---------------------------
// Funzione principale
// ---------------------------
export async function CartaAstraleCreaScena(opzioni, temaRender, temaRenderTransiti, temaRenderSinastria) {
    const stato = creaStatoCartaAstrale(opzioni, temaRender, temaRenderTransiti, temaRenderSinastria);
    if (!stato) return null;

    const disegno = new THREE.Group();


    // Aggiungi tutti i moduli principali
    const moduli = [
        //creaStelle,
        creaTransiti,
        creaSegni,
        creaElementiCelesti,
        creaCase,
        creaAspetti,
        creaSinastria
        // puoi aggiungere altre funzioni come direzioni, lunazioni, ecc.
    ];

    await aggiornaModuli(disegno, stato, moduli);

    
    if(temaRender.australInversion && !opzioni.mostraSinastria)
      disegno.rotation.y = Math.PI;

    return disegno;
}
