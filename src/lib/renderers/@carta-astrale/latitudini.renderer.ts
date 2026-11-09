import * as THREE from 'three';
//import gsap from 'gsap';
import {OggettiSempliciRender} from '../oggetti-semplici.renderer';
//import {AssiRender} from '../moduli/assi.renderer';
import {CaseRender} from '../moduli/case.renderer';
import {SegniRender} from '../moduli/segni.renderer';
import {TransitiRender} from '../moduli/transiti.renderer';
import { SkinManager } from '../@skin-manager';
import { AspettiRender } from '../moduli/aspetti.renderer';


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

    var as = 0;
    var mc = 0;
    if(
      !(opzioni.mostraEffemeridi && opzioni.effemeridiGrafiche)
      && temaRender.houses && Object.keys(temaRender.houses).length
    ) {
      as = temaRender.houses[opzioni.settaggi.domificazione_selezionata].ascendant;
      mc = temaRender.houses[opzioni.settaggi.domificazione_selezionata].mc;
    }

    var disegno = new THREE.Group();

    if(
      !(opzioni.mostraEffemeridi && opzioni.effemeridiGrafiche)
      && temaRender.houses && Object.keys(temaRender.houses).length
    ) {
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
    var anelloElementiCelesti = await LatitudiniRender.lr.getAnelloElementiCelesti(
      temaRender,
      as,
      opzioni,
      diametroRisuonatoreSolare,
      diametroAnelloElementiCelesti,
      diametroEclittica,
      false
    );

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

    if(temaRender.australInversion)
      disegno.rotation.y = Math.PI;

    return disegno;
  }

  public async getElementiCelesti(temaRender, opzioni) {
    var elementiCelesti = {};

    for(let nome in opzioni.settaggi.elementi_celesti) {
      var elOpt = opzioni.settaggi.elementi_celesti[nome];

      if(
        temaRender.planets[nome]
        && temaRender.planets[nome].latitude
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

      if(usaImgAnello)
        var elRef = 'simboli/elementi-celesti/'+opzioni.temaGrafico+'/cerchio/anello/'+nome+'.png';
      else
        var elRef = 'simboli/elementi-celesti/'+opzioni.temaGrafico+'/cerchio/'+nome+'.png';
      var el = await OggettiSempliciRender.getImg(elRef,0.1,0.1,1);

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
      linea.rotateZ(THREE.MathUtils.degToRad(elLongDiRender));
      linea.translateY(yPos);
      linea.translateZ(0.00001);

      group.add( el );
      group.add(linea);
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
  }
}
