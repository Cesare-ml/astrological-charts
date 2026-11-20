import * as THREE from 'three';
import { SegniRender } from '../moduli/segni.renderer';
import { CaseRender } from '../moduli/case.renderer';
import {ElementiCelestiRender} from '../moduli/elementi-celesti.renderer'
import {AspettiRender} from '../moduli/aspetti.renderer'
import { TransitiRender } from '../moduli/transiti.renderer';
import { SkinManager } from '../@skin-manager';
import { SinastriaRender } from '../moduli/sinastria.renderer';
import { OggettiSempliciRender } from '../oggetti-semplici.renderer';
import { stopSceneAnimations } from '../scene-animations';
import { MarcatoriAssiRender } from '../moduli/marcatori-assi.renderer';
import { ProiezioniZodiacaliRender } from '../moduli/proiezioni-zodiacali.renderer';
import { directionOverlayOffsets } from '../moduli/direction-overlay';
import { createFixedStarRing } from '../moduli/fixed-stars.renderer';
import { Colori } from '../_colori.config';

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
export function calcolaDiametri(opzioni, temaRender, temaRenderTransiti, temaRenderSinastria) {

    const diametri: any = {};

    // ---------------------------
    // Settaggio proporzioni grafico
    // ---------------------------
    let simboliScaleAnelloSegni = 1.05;
    let simboliScaleAnelloElementiCelesti = 1;
    let simboliScaleCase = 0.9;

    // Diametro base anello segni
    // Keep the zodiac wheel at the same scale when the transit overlay is
    // toggled. The external transit grid has its own proportional annulus.
    let diametroAnelloSegni = 4.5723;

    // Transiti sinodici
    if (opzioni.mostraTransitiSinodici && temaRender?.transitiSinodici) {
        diametroAnelloSegni = 1.4;
        simboliScaleAnelloSegni = 0.4;
        simboliScaleAnelloElementiCelesti = 0.4;
        simboliScaleCase = 0.4;
    }
    diametri.diametroAnelloSegni = diametroAnelloSegni;

    // Diametri proporzionali
    // Ordinary transit charts keep the same roomy proportions as the natal
    // wheel. The former 75.1/120 house rim made the natal planetary band too
    // thin and silently changed its glyph size and collision algorithm.
    // Synastry still reserves room in the centre for its second house wheel.
    const nestedHouseWheel = opzioni.mostraSinastria || opzioni.mostraTransitiSinodici;
    const proporzioni = {
        diametroAnelloTransitiSinodici: 440 / 120,
        diametroUltimaOrbitaTransitiSinodici: 412.5 / 120,
        diametroAssiTransiti: 152.64 / 120,
        diametroAnelloStelleFisse: 146.64 / 120,
        diametroAnelloTransiti: 146.64 / 120,
        diametroAssi: 138 / 120,
        diametroGrigliaTransiti: 120/120, //122.56 / 120,
        // Preserve the full width of the zodiac sign ring. A wider planetary
        // band comes from a smaller house/aspect wheel, not cramped signs.
        diametroAnelloElementiCelesti: 103 / 120,
        diametroCerchioDodecatemori: 91.66 / 120,
        diametroCerchioDodecatemori2: 87.5 / 120,
        diametroInternoMiniArcoCase: (nestedHouseWheel ? 75.1 : 67.1) / 120,
        diametroAnelloCase: (nestedHouseWheel ? 74.16 : 66.16) / 120,
        diametroCerchioInternoTermini: (nestedHouseWheel ? 70.03 : 62.03) / 120,
        diametroInternoAnelloCase: (nestedHouseWheel ? 63.36 : 55.36) / 120
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
    // Synastry does not need a radial row of degree badges on the outer
    // chart. Use a slightly narrower celestial band without altering the house wheel
    // or the thickness of the zodiac signs.
    diametri.diametroInternoAnelloElementoCelesti = opzioni.mostraSinastria
        ? diametroAnelloSegni * 77 / 120
        : diametri.diametroInternoMiniArcoCase;
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

/** All segments share one geometry and material, including the 96-part view. */
export async function creaChakra(stato: StatoCartaAstrale) {
    const sides: Record<string,number> = {Ajna:96,Vishuddha:16,Anahata:12,Manipura:10,Muladhara:6,Swadhisthana:4};
    const name=stato.opzioni.chakram;
    const count=sides[name];
    if (!stato.opzioni.chakramAttivi || !count) return null;
    const inner=stato.diametri.diametroCerchioAspetti/2;
    const outer=stato.diametri.diametroInternoAnelloCase/2;
    const vertices:number[]=[], boundaries:number[]=[], sectors:number[]=[];
    const subdivisions=8, step=2*Math.PI/count;
    for (let i=0;i<count;i++) {
        const angle=Math.PI+(i-.5)*step, next=angle+step;
        const x=Math.cos(angle), y=Math.sin(angle);
        vertices.push(x*inner,y*inner,.001,x*outer,y*outer,.001);
        if (name!=='Ajna') vertices.push(x*inner,y*inner,.001,Math.cos(next)*inner,Math.sin(next)*inner,.001);
        const boundaryStart=count>=48 ? outer*.65 : 0;
        boundaries.push(x*boundaryStart,y*boundaryStart,.002,x*outer,y*outer,.002);
        for (let part=0;part<subdivisions;part++) {
            const a=angle+step*part/subdivisions, b=angle+step*(part+1)/subdivisions;
            sectors.push(0,0,.004,Math.cos(a)*outer,Math.sin(a)*outer,.004,Math.cos(b)*outer,Math.sin(b)*outer,.004);
        }
    }
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
    const lines=new THREE.LineSegments(geometry,new THREE.LineBasicMaterial({color:Colori.chakram[name]}));
    lines.name='chakra-lines';
    const guides=new THREE.BufferGeometry();guides.setAttribute('position',new THREE.Float32BufferAttribute(boundaries,3));
    const guideLines=new THREE.LineSegments(guides,new THREE.LineBasicMaterial({color:Colori.chakram[name],transparent:true,opacity:.24,depthWrite:false}));
    const background=new THREE.Mesh(new THREE.CircleGeometry(outer,128),new THREE.MeshBasicMaterial({color:Colori.chakram[name],transparent:true,opacity:.045,depthWrite:false,side:THREE.DoubleSide}));
    background.position.z=-.001;
    const highlightGeometry=new THREE.BufferGeometry();
    highlightGeometry.setAttribute('position',new THREE.Float32BufferAttribute(sectors,3));
    highlightGeometry.setDrawRange(0,0);
    const highlight=new THREE.Mesh(highlightGeometry,new THREE.MeshBasicMaterial({color:Colori.chakram[name],transparent:true,opacity:.3,depthWrite:false,depthTest:false,side:THREE.DoubleSide}));
    highlight.visible=false;highlight.renderOrder=5;highlight.name='chakra-highlight';
    // A square picking plane and a radial check cover the complete circle,
    // including the area between the polygon and the house ring.
    const hit=new THREE.Mesh(new THREE.PlaneGeometry(outer*2,outer*2),new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide}));
    hit.position.z=.003;
    hit.userData={chartInteractionRole:'chakra-sectors',chakra:name,sectorCount:count,radius:outer,subdivisions};
    const group=new THREE.Group(); group.add(background,lines,guideLines,highlight,hit); return group;
}

async function creaApogeo(stato: StatoCartaAstrale) {
    const longitudes=stato.opzioni.apogeeLongitudes;
    if (!Array.isArray(longitudes) || !longitudes.length || !longitudes.every(Number.isFinite)) return null;
    const radius=stato.diametri.diametroCerchioAspetti/2, lines:number[]=[], faces:number[]=[];
    let previous: [number,number]|null=null;
    for (const longitude of longitudes) {
        const angle=THREE.MathUtils.degToRad(180+longitude-stato.asc);
        const x=radius*Math.cos(angle), y=radius*Math.sin(angle);
        lines.push(-x,-y,.002,x,y,.002);
        if (previous) {
            const [px,py]=previous;
            lines.push(px,py,.002,x,y,.002,-px,-py,.002,-x,-y,.002);
            faces.push(0,0,0,px,py,0,x,y,0,0,0,0,-px,-py,0,-x,-y,0);
        }
        previous=[x,y];
    }
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(lines,3));
    const surface=new THREE.BufferGeometry();surface.setAttribute('position',new THREE.Float32BufferAttribute(faces,3));
    const group=new THREE.Group();
    group.add(new THREE.LineSegments(geometry,new THREE.LineBasicMaterial({color:'#ac7eea'})));
    group.add(new THREE.Mesh(surface,new THREE.MeshBasicMaterial({color:'#ac7eea',side:THREE.DoubleSide,transparent:true,opacity:.35,depthWrite:false})));
    group.name='apogee-radix';return group;
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
        false,//cerchia la luna
        false,//isElementiSinastria
        stato.opzioni.mostraTransiti || stato.opzioni.mostraSinastria ? 'primary-overlay' : 'default',
        [],
        stato.diametri.diametroAnelloCase / 2,
    );
    stato.gruppoElementiCelesti = group;
    group.userData.chartInteractionRole = 'natal-planets';
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

async function creaProiezioniZodiacali(stato: StatoCartaAstrale) {
    if (!stato.opzioni.proiezioneZodiacale?.tipo) return null;
    return ProiezioniZodiacaliRender.getLayer(stato.opzioni, stato.asc, stato.diametri.diametroAnelloSegni,
      stato.diametri.diametroAnelloCase, stato.diametri.diametroInternoAnelloElementoCelesti,
      stato.diametri.diametroAnelloElementiCelesti, stato.simboliScale.AnelloElementiCelesti,
      stato.temaRender.australInversion && !stato.opzioni.mostraSinastria);
}

async function creaMarcatoriAssi(stato: StatoCartaAstrale) {
    const caseTema = stato.temaRender?.houses?.[stato.opzioni.settaggi.domificazione_selezionata];
    if (!caseTema || !Number.isFinite(caseTema.ascendant) ||
        !Number.isFinite(caseTema.mc) || stato.opzioni.mostraEffemeridi) return null;
    return MarcatoriAssiRender.creaMarcatori(
        stato.asc, stato.mc, stato.diametri.diametroAnelloSegni / 2,
      MarcatoriAssiRender.getPresentationOptions(stato.opzioni), stato.temaRender,
      stato.diametri.diametroAnelloElementiCelesti / 2,
    );
}

async function creaStelle(stato: StatoCartaAstrale) {
    const stars = stato.temaRender?.fixedStars;
    if (!Array.isArray(stars) || !stars.length) return null;
    return createFixedStarRing(stars, stato.asc, stato.diametri.diametroAnelloSegni / 2 + .12);
}

async function creaMarcatoriAssiTransiti(stato: StatoCartaAstrale) {
    if (!stato.opzioni.mostraTransiti || !stato.opzioni.mostraAssiTransiti || stato.opzioni.mostraEffemeridi) return null;
    const house = stato.temaRenderTransiti?.houses?.[stato.opzioni.settaggi.domificazione_selezionata];
    if (!house || !Number.isFinite(house.ascendant) || !Number.isFinite(house.mc)) return null;
    return MarcatoriAssiRender.creaMarcatoriTransiti(stato.asc, house.ascendant, house.mc,
      stato.diametri.diametroAnelloSegni / 2, stato.diametri.diametroAnelloTransiti / 2, stato.opzioni);
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
        true,
        stato.mc,
    );
    stato.gruppoTransiti = group;
    return group;
}

/** The caller supplies the directed chart; the renderer only positions its ring. */
async function creaDirezioni(stato: StatoCartaAstrale) {
    if (!stato.opzioni.mostraDirezioni || !stato.temaRenderDirezione ||
        !['primarieSemplificate', 'simboliche'].includes(stato.opzioni.direzioniModalita)) return null;
    const house = stato.temaRenderDirezione.houses?.[stato.opzioni.settaggi.domificazione_selezionata];
    if (!house || !Number.isFinite(house.ascendant)) throw new RangeError('Direction chart house system unavailable');
    const offsets = directionOverlayOffsets(stato.asc, house.ascendant,
      stato.opzioni.direzioniModalita, stato.opzioni.direzioniDegOffs);
    const d = stato.diametri;
    const inner = (d.diametroInternoAnelloElementoCelesti + d.diametroAnelloElementiCelesti) / 2;
    return ElementiCelestiRender.getAnelloElementiCelesti(
      stato.temaRenderDirezione, stato.asc, [], stato.simboliScale.AnelloElementiCelesti,
      stato.opzioni, [], [], inner, d.diametroAnelloElementiCelesti,
      d.diametroDodecatemoriAnelloElementoCelesti, true, false, 'longitude', true,
      false, 0, offsets.geometry, offsets.symbolicAxis, false, false, 'synastry-overlay');
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
    disegno.userData.transitAspectGeometry = {
        asc: stato.asc,
        diameter: stato.diametri.diametroCerchioAspetti,
        transitRadius: (opzioni.mostraSinastria && opzioni.mostraAssiSinastria
          ? stato.diametri.diametroAnelloElementiCelestiSinastria
          : stato.diametri.diametroGrigliaTransiti) / 2,
    };

    // Skin-only backdrop. The wheel topology and all longitude positions
    // below are exactly the same for official and legacy skins.
    const skin = SkinManager.skins[opzioni.settaggi.skin_id] as {
        bgColor: string; sfondoRuota?: boolean;
    };
    if (skin?.sfondoRuota) {
        const background = OggettiSempliciRender.getAnello(0,
          stato.diametri.diametroAnelloSegni / 2, skin.bgColor);
        background.position.z = -0.012;
        background.name = 'skin-wheel-background';
        disegno.add(background);
    }


    // Aggiungi tutti i moduli principali
    const moduli = [
        creaStelle,
        creaTransiti,
        creaSegni,
        creaElementiCelesti,
        creaDirezioni,
        creaProiezioniZodiacali,
        creaCase,
        creaAspetti,
        creaChakra,
        creaApogeo,
        creaMarcatoriAssi,
        creaMarcatoriAssiTransiti,
        creaSinastria
        // puoi aggiungere altre funzioni come direzioni, lunazioni, ecc.
    ];

    try {
        await aggiornaModuli(disegno, stato, moduli);
        if(temaRender.australInversion && !opzioni.mostraSinastria)
          disegno.rotation.y = Math.PI;
        return disegno;
    } catch (error) {
        // A partial drawing is never returned to the service on failure.
        disegno.traverse(stopSceneAnimations);
        throw error;
    }
}
