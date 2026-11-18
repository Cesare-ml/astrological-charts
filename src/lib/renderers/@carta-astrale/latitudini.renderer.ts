import * as THREE from 'three';
//import gsap from 'gsap';
import {OggettiSempliciRender} from '../oggetti-semplici.renderer';
//import {AssiRender} from '../moduli/assi.renderer';
import {CaseRender} from '../moduli/case.renderer';
import {SegniRender} from '../moduli/segni.renderer';
import {TransitiRender} from '../moduli/transiti.renderer';
import { SkinManager } from '../@skin-manager';
import { AspettiRender } from '../moduli/aspetti.renderer';
import { latitudePlanetAsset } from './latitude-asset-paths';
import { disposeSceneResources } from '../scene-resources';


export class LatitudiniRender {
  public static lr:LatitudiniRender = null;
/*
  public static coloriElementiCelesti = {
    "Saturn": '#9d637c',
    "Jupiter": '#1ca0ed',
    "Mars": '#df632a',
    "Sun": '#d42817',
    "Venus": '#01933c',
    "Mercury": '#e7db0e',
    "Moon": '#bdbdbc'
  };*/

  //public static coloriElementi = ["#cc0000","#390","#f90","#06c"]; //fuoco,terra,aria,acqua

  public constructor() {}

  // Ritorna un threejs group con la scena renderizzata
  public static async creaScena(temaRender, temaRenderTransiti, temaRenderSinastria, opzioni) {
    if(LatitudiniRender.lr == null) {
      LatitudiniRender.lr = new LatitudiniRender();
    }

    var diametroAnelloSegni           = 4.6; // 120
    /*if(opzioni.mostraTransiti){
      diametroAnelloSegni             = 4.2;
    }*/
    //var diametroAnelloTransiti        = diametroAnelloSegni*146.64/120;
    var diametroAssi                  = diametroAnelloSegni*138/120;
    var diametroAnelloElementiCelesti = diametroAnelloSegni*95.82/120;
    var diametroEclittica             = diametroAnelloSegni*52.62/120; //157.86
    //var diametroCerchioCase         = diametroAnelloSegni*9.42/120; //28.26
    var diametroRisuonatoreSolare     = diametroAnelloSegni*9.42/120; //28.26

    // A nonempty houses collection does not guarantee the requested system
    // exists. Only explicitly supplied systems count: inherited house data
    // must not create an accidental ring or rotate the chart.
    const candidateHouses = !(opzioni.mostraEffemeridi && opzioni.effemeridiGrafiche)
      && temaRender.houses != null
      && Object.prototype.hasOwnProperty.call(temaRender.houses, opzioni.settaggi.domificazione_selezionata)
      ? temaRender.houses[opzioni.settaggi.domificazione_selezionata]
      : undefined;
    // Only a complete numeric house ring can safely drive rotation and
    // geometry. Check own indices: inherited numeric values cannot fill holes.
    const selectedHouses = candidateHouses
      && Number.isFinite(candidateHouses.ascendant)
      && Array.isArray(candidateHouses.house)
      && candidateHouses.house.length === 12
      && Array.from({length: 12}, (_, i) =>
        Object.prototype.hasOwnProperty.call(candidateHouses.house, i)
        && Number.isFinite(candidateHouses.house[i])
      ).every(Boolean)
      ? candidateHouses
      : undefined;
    const as = selectedHouses?.ascendant ?? 0;

    var disegno = new THREE.Group();
    // Sign and natal groups are built before being attached, to preserve the
    // existing paint order (transits, signs, natal planets). Track them until
    // ownership transfers to the final scene so errors cannot orphan them.
    const detachedGroups = new Set<THREE.Object3D>();
    try {

    if (selectedHouses) {
      //var assi = await AssiRender.getAssi(as,mc,diametroAssi,opzioni);

      var anelloCase = await CaseRender.getAnelloCaseLatitudini(
        temaRender.houses,
        opzioni,
        diametroRisuonatoreSolare,
        diametroAnelloElementiCelesti,
        temaRender.australInversion
      );

      //disegno.add( assi );
      disegno.add( anelloCase );
    }

    var risuonatoreSolare = await AspettiRender.getBackgroundAspetti(
      diametroRisuonatoreSolare,
      opzioni,
      temaRender.australInversion && !opzioni.mostraSinastria
    );
    disegno.add(risuonatoreSolare);

    var anelloSegni = await SegniRender.getAnelloSegni(
      as,
      1,
      diametroAnelloElementiCelesti,
      diametroAnelloSegni,
      temaRender.australInversion,
      opzioni.mostraDecani,
      opzioni.mostraDecadi,
      opzioni
    );
    detachedGroups.add(anelloSegni);
    var anelloElementiCelesti = await LatitudiniRender.lr.getAnelloElementiCelesti(
      temaRender,
      as,
      opzioni,
      diametroRisuonatoreSolare,
      diametroAnelloElementiCelesti,
      diametroEclittica,
      false
    );
    detachedGroups.add(anelloElementiCelesti);

    if(opzioni.mostraTransiti && temaRenderTransiti) {
      var transiti = await LatitudiniRender.lr.getAnelloElementiCelesti(
        temaRenderTransiti,
        as,
        opzioni,
        diametroRisuonatoreSolare,
        diametroAnelloElementiCelesti,
        diametroEclittica,
        true
      );

      disegno.add( transiti );
    }

    disegno.add( anelloSegni );
    disegno.add( anelloElementiCelesti );
    detachedGroups.clear();

    if(temaRender.australInversion)
      disegno.rotation.y = Math.PI;

    return disegno;
    } catch (error) {
      // Add only unattached groups to the same disposal tree, so shared
      // textures/geometries are released once even when a later module fails.
      for (const group of detachedGroups) {
        if (!group.parent) disegno.add(group);
      }
      disposeSceneResources(disegno);
      throw error;
    }
  }

  public async getElementiCelesti(temaRender, opzioni) {
    var elementiCelesti = {};

    for(let nome in opzioni.settaggi.elementi_celesti) {
      var elOpt = opzioni.settaggi.elementi_celesti[nome];

      if(
        temaRender.planets[nome]
        // Latitude 0° is a valid position on the ecliptic (normally the Sun).
        // Exclude missing/invalid coordinates, not legitimate zero values.
        && Number.isFinite(temaRender.planets[nome].latitude)
        && elOpt.att
      ) {
        elementiCelesti[nome]=temaRender.planets[nome];
      }
    }

    return elementiCelesti;
  }


  // ###########
  // # PIANETI #
  // ###########
  public async getAnelloElementiCelesti(temaRender, ascendente: number, opzioni: any, diametroInterno, diametroEsterno, diametroEclittica, usaImgAnello): Promise<any> {
    var group = new THREE.Group();
    try {

    var elementiCelesti = await LatitudiniRender.lr.getElementiCelesti(temaRender,opzioni);

    var elPianeti = {};

    //disegno la griglia delle latitudini
    //console.log(opzioni.settaggi.skin_id,SkinManager.skins);
    const coloreCerchiGriglia = SkinManager.skins[opzioni.settaggi.skin_id].latitudini.elementiCelesti.coloreGriglia;
    const coloreCerchioEclittica =  SkinManager.skins[opzioni.settaggi.skin_id].latitudini.elementiCelesti.coloreEclittica;
    const spessoreCerchiGriglia = 0.008;

    group.add(OggettiSempliciRender.getCerchio(
      diametroEclittica/2,
      coloreCerchioEclittica,
      spessoreCerchiGriglia
    ));
    const passoGriglia = (diametroEsterno/2 - diametroEclittica/2) / 9;
    for(let i=1; i<9; i++) {
      group.add(OggettiSempliciRender.getCerchio(
        diametroEclittica/2 + passoGriglia*i, 
        coloreCerchiGriglia, spessoreCerchiGriglia)); 
    }
    for(let i=1; i<10; i++) {
      group.add(OggettiSempliciRender.getCerchio(
        diametroEclittica/2 - passoGriglia*i, 
        coloreCerchiGriglia, spessoreCerchiGriglia)); 
    }

    for(let nome in elementiCelesti) {

      var elRef = latitudePlanetAsset(opzioni.temaGrafico, nome, usaImgAnello);
      var el = await OggettiSempliciRender.getImg(elRef,0.1,0.1,1);
      // Take ownership immediately: positioning or line creation can throw
      // before the glyph would otherwise be attached to the result group.
      group.add(el);

      var elLongDiRender = 75-ascendente+15 + elementiCelesti[nome]['longitude'];
      el.rotateZ(THREE.MathUtils.degToRad(elLongDiRender));

      var yPos =
        diametroEclittica/2 +
        + Math.max(-9,Math.min(elementiCelesti[nome].latitude,9))
        * (diametroEsterno/2 - diametroInterno/2)/18
      ;
      el.translateY(yPos);
      el.rotation.z = 0;

      /*
      GestoreEventiMouse.gem.aggiungiOggetto(
        ['info-pianeta'],
        el,
        {'id': nome, 'nome': nome, "info": elementiCelesti[nome]}
      );*/

      elPianeti[nome] = el;

      var colore = '#fafafa';
      if(usaImgAnello && opzioni.temaGrafico == 'light') {
        colore = '#333';
      }
      if(nome == 'Mercury' || nome == 'Moon')
        colore = '#555';
      var speedSign = Math.sign(elementiCelesti[nome].latitudeSpeed);
      var linea = OggettiSempliciRender.getLineaGrossa(new THREE.Vector2(0,speedSign*0.01),new THREE.Vector2(0,speedSign*0.04),colore,2);
      group.add(linea);
      linea.rotateZ(THREE.MathUtils.degToRad(elLongDiRender));
      linea.translateY(yPos);
      linea.translateZ(0.00001);

    }

    //Fasi Sinodiche Latitudinali
    /*
    if(
      temaRender.fasiSinodicheLatitudinali && opzioni.latitudiniPianetaSelezionato
      && (
        opzioni.latitudiniPianetaSelezionato == 'Moon'
        || opzioni.latitudiniPianetaSelezionato == 'Mercury'
        || opzioni.latitudiniPianetaSelezionato == 'Venus'
        || opzioni.latitudiniPianetaSelezionato == 'Mars'
        || opzioni.latitudiniPianetaSelezionato == 'Jupiter'
        || opzioni.latitudiniPianetaSelezionato == 'Saturn'
      )
    ) {
      var pianetaNome = opzioni.latitudiniPianetaSelezionato;

      var nomeFasi = ['d1','r2','r3','d4'];
      var elFasi = [];
      for(var faseI in nomeFasi) {
        var fase = nomeFasi[faseI];
        console.log(fase,temaRender.fasiSinodicheLatitudinali[pianetaNome][fase]);
        var p = temaRender.fasiSinodicheLatitudinali[pianetaNome][fase].render.planets[pianetaNome];
        var elRef = 'simboli/elementi-celesti/'+opzioni.temaGrafico+'/cerchio/'+pianetaNome+'.png';
        var el = await OggettiSempliciRender.getImg(elRef,0.05,0.05,1);

        var elLongDiRender = 75-ascendente+15 + p.longitude;
        el.rotateZ(THREE.MathUtils.degToRad(elLongDiRender));

        var yPos =
          diametroEclittica/2 +
          + Math.max(-9,Math.min(p.latitude,9))
          * (diametroEsterno/2 - diametroInterno/2)/18
        ;
        el.translateY(yPos);
        el.rotation.z = 0;

        elFasi.push(el);
        group.add(el);
      }

      var punti = [];
      for(var i=0; i<nomeFasi.length; i++) {
        if(punti.length == i && temaRender.dataora < temaRender.fasiSinodicheLatitudinali[pianetaNome][nomeFasi[i]].dataora){
          punti.push(elPianeti[pianetaNome].position);
        }
        punti.push(elFasi[i].position);
      }
      if(punti.length == 4)
        punti.push(elPianeti[pianetaNome].position);
      */
      //disegno la curva che passa tra i 5 punti
      /*
      var definizioneCurva = 30;
      const curve = new THREE.CatmullRomCurve3(punti);
      const points = curve.getPoints( punti.length*definizioneCurva );
      const geometry = new THREE.BufferGeometry().setFromPoints( points );
      const material = new THREE.LineBasicMaterial( { color: '#aaaaaa' } );
      const curveObject = new THREE.Line( geometry, material );
      group.add(curveObject);
      */
      /*
      var coloreLineaTraccia = '#aaaaaa';
      if(opzioni.temaGrafico == 'light') {
        coloreLineaTraccia = '#777777';
      }
      for(var i=1; i<punti.length; i++){
        linea = OggettiSempliciRender.getLinea(punti[i-1],punti[i],coloreLineaTraccia);
        group.add(linea);
      }
    }*/

    return group;
    } catch (error) {
      disposeSceneResources(group);
      throw error;
    }
  }
}
