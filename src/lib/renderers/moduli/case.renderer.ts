import { unwrapHouseCusps } from './house-cusps';
import * as THREE from 'three';
import {OggettiSempliciRender} from '../oggetti-semplici.renderer';
import { SkinManager } from '../@skin-manager';

import { StatoCartaAstrale } from '../@carta-astrale/carta-astrale.renderer';

export class CaseRender {

  public static async getAnelloCaseLatitudini(casePos,opzioni,diametroInterno,diametroEsterno,australInversion) {
    var group = new THREE.Group();

    var caseRenderedGroup = await CaseRender.renderAnelloCaseLatitudini(
      casePos[opzioni.settaggi.domificazione_selezionata],
      diametroInterno,
      diametroEsterno,
      australInversion,
      opzioni
    );

    group.add(caseRenderedGroup);

    return group;
  }

  public static async getAnelloCaseCartaAstrale(
    casePos,
    degOffs,
    simboliScale,
    imgRef,
    opzioni,
    diametroInterno,
    diametroInternoMiniArcoCase,
    diametroEsterno,
    diametroCerchioInternoTermini,
    australInversion,
    isCaseSinastria=false,
    synastryRotationOverride: number | undefined = undefined
  ) {
    var group = new THREE.Group();
    var mostraTermini =
      opzioni.mostraTermini
      && (
        opzioni.settaggi.domificazione_selezionata=='egizia'
        || opzioni.settaggi.domificazione_selezionata=='egiziaplacido'
      )
      && diametroCerchioInternoTermini != false
    ;

    /*
    var caseImgRef = 'grafici/'+opzioni.settaggi.skin_id+'/'+imgRef+'.png';
    if(mostraTermini) {
      caseImgRef = 'grafici/'+opzioni.settaggi.skin_id+'/cartaastrale-case-termini.png';
    }
    var img = await OggettiSempliciRender.getSfondoQuadrato(caseImgRef,diametroEsterno);
    group.add(img);*/
    
    var coloreCerchio = SkinManager.skins[opzioni.settaggi.skin_id].anelloCase.coloreLinea;

    var cerchioInterno = OggettiSempliciRender.getCerchio(diametroInterno/2,coloreCerchio);
    group.add(cerchioInterno);

    var diametroConfineEsternoCase = diametroEsterno;
    var diametroConfineInternoCase = diametroInterno;
    if(mostraTermini) {
      diametroConfineEsternoCase = diametroCerchioInternoTermini;

    //EGIZA + PLACIDO
    } else if(
      opzioni.settaggi.domificazione_selezionata == 'egiziaplacido'
      && !opzioni.mostraSinastria
    ) {
      diametroConfineInternoCase = (diametroEsterno-diametroInterno)/2 + diametroInterno;

      simboliScale *= 0.7;
      var diametroEsternoPlacido = diametroConfineInternoCase;
      var diametroInternoPlacido = diametroInterno;

      //RENDER PLACIDO
      var casePlacidoRenderedGroup = await CaseRender.renderAnelloCase(
        casePos.placido,
        degOffs,
        0.13*simboliScale,
        diametroInternoPlacido,
        diametroInternoMiniArcoCase,
        diametroEsternoPlacido,
        /*
        (diametroEsternoPlacido/2 - diametroInternoPlacido/2)/2 //simboli case
          + diametroInternoPlacido/2
          - diametroEsternoPlacido/400,*/
        australInversion,
        opzioni
      );


      var cerchioDivisorioCase = OggettiSempliciRender.getCerchio(diametroEsternoPlacido/2,coloreCerchio);

      group.add(casePlacidoRenderedGroup);
      group.add(cerchioDivisorioCase);
    }

    //RENDER CASE
    let caseRenderedGroup;
    if(isCaseSinastria) {
      caseRenderedGroup = await CaseRender.renderAnelloCaseSinastria(
        casePos[opzioni.settaggi.domificazione_selezionata],
        degOffs,
        0.13*simboliScale,
        diametroConfineInternoCase,
        diametroInternoMiniArcoCase,
        diametroConfineEsternoCase,
        australInversion,
        opzioni,
        synastryRotationOverride
      );
    } else {
      caseRenderedGroup = await CaseRender.renderAnelloCase(
        casePos[opzioni.settaggi.domificazione_selezionata],
        degOffs,
        0.13*simboliScale,
        diametroConfineInternoCase,
        diametroInternoMiniArcoCase,
        diametroConfineEsternoCase,
        australInversion,
        opzioni
      );
    }

    if(mostraTermini) {
      var terminiRenderedGroup = await CaseRender.renderTermini(
        casePos,
        0.075*simboliScale,
        (diametroEsterno/2 - diametroCerchioInternoTermini/2)/2
        + diametroCerchioInternoTermini/2,
        degOffs,
        australInversion,
        opzioni
      );
      group.add(terminiRenderedGroup);
    }

    group.add(caseRenderedGroup);

    return group;
  }


  public static async renderTermini(casePos,simboliScale,ySimboli,degOffs,australInversion,opzioni) {
    var group = new THREE.Group();

    for(var i=0; i<12; i++) {
      for(var j=0; j<5; j++) {
        var el = await OggettiSempliciRender.getImg(
          'simboli/elementi/'+opzioni.settaggi.skin_id+'/875x605/'+((i+j)%4)+'.png',
          875,605,1/875,australInversion
        );

        el.scale.set(simboliScale,simboliScale,1);
        var offs = 30*j/5 + 3;
        el.rotateZ(THREE.MathUtils.degToRad(i*30+90-15 + offs + degOffs));
        el.translateY(ySimboli);
        el.rotation.z = 0;

        group.add(el);
      }
    }
    return group;
  }

  public static async renderAnelloCase(
    caseObj, 
    degOffs, 
    simboliScale, 
    diametroInterno, 
    diametroInternoMiniArco, 
    diametroEsterno,
    australInversion, 
    opzioni
  ) {
    var group = new THREE.Group();
    
    var coloreLinea = SkinManager.skins[opzioni.settaggi.skin_id].anelloCase.coloreLinea;
    var coloreCase = SkinManager.skins[opzioni.settaggi.skin_id].anelloCase.coloreSimboli;
    //var miniarcoOffs = 0.21;

    var offsetDegRotazione = -caseObj.ascendant + 90 + degOffs;
    //le texture hanno sistemi di render diversi, cerchio inizio 90 gradi dopo
    var offsetDegRotazioneTextures = -caseObj.ascendant + degOffs + 180;

    const casePos = unwrapHouseCusps(caseObj.house);
    // A missing or nonfinite Ascendant would make every rotation NaN.
    if (!Number.isFinite(caseObj.ascendant)) {
      throw new TypeError('House ascendant must be a finite longitude.');
    }
    if (!Number.isFinite(degOffs)) {
      throw new TypeError('House rotation offset must be a finite number.');
    }

    if ( !SkinManager.skins[opzioni.settaggi.skin_id].anelloCase.texture ) {
      group.add(OggettiSempliciRender.getCerchio(diametroEsterno/2, coloreLinea));
      group.add(OggettiSempliciRender.getCerchio(diametroInternoMiniArco / 2, coloreLinea));
    }

    for(var i=0; i<12; i++) {
      var linea = OggettiSempliciRender.getLinea(
        {x:0,y:diametroInterno/2},
        {x:0,y:diametroEsterno/2},
        coloreLinea
      );
      linea.rotateZ(THREE.MathUtils.degToRad(casePos[i] + offsetDegRotazione));

      if ( SkinManager.skins[opzioni.settaggi.skin_id].anelloCase.texture ) {
        var cbefore = casePos[i] + offsetDegRotazioneTextures;
        var cafter = casePos[(i+1)%12] + offsetDegRotazioneTextures;
        if(cbefore>cafter) cafter+=360;
        const arco = OggettiSempliciRender.getSemiArcoGrosso(
          cbefore,//+ 0.4,
          cafter,//- 0.4,
          diametroInterno / 2 ,//+ 0.02,
          diametroEsterno / 2,
          "white",
          SkinManager.skins[opzioni.settaggi.skin_id].anelloCase.texture
        );
        
        arco.position.z = -0.001 * (australInversion?-1:1);
        //if(i==1)
        group.add(arco);

        const miniarco = OggettiSempliciRender.getSemiArcoGrosso(
          cbefore,//+ 0.4,
          cafter,//- 0.4,
          diametroInterno / 2 ,//+ 0.02,
          diametroInternoMiniArco / 2,
          "white",
          SkinManager.skins[opzioni.settaggi.skin_id].anelloCase.texture
        );
        miniarco.position.z = -0.0009 * (australInversion?-1:1);
        group.add(miniarco);
      }
    

      let colore = coloreCase;
      if(coloreCase == 'elementi') {
          colore = SkinManager.skins[opzioni.settaggi.skin_id].elementi[i%4];
      }
      //var imgColorBase = SkinManager.skins[opzioni.settaggi.skin_id].anelloCase.coloreImgFolder;
      //if(imgColorBase) imgColorBase += '/';
      //else imgColorBase = "";
      var casa = await OggettiSempliciRender.getImg(
        'simboli-bianchi/case/'+String(i+1).padStart(2, '0')+'.png',
        725,460,1/725,australInversion,
        colore
      );
      casa.scale.set(simboliScale,simboliScale,1);

      var casaImgPos;
      if(i<11) {
          casaImgPos = (casePos[i+1] - casePos[i])/2 + casePos[i];
      } else if(i==11) {
        casaImgPos = (casePos[0] + 360 - casePos[11])/2 + casePos[11];
      }
      casa.rotateZ(THREE.MathUtils.degToRad(casaImgPos + offsetDegRotazione));
      //casa.translateY( ySimboli );
      casa.translateY( diametroInterno/2 + (diametroInternoMiniArco - diametroInterno)/4 );
      casa.rotation.z = 0;

      group.add(casa);
      group.add(linea);

    }

    return group;
  }

  public static async renderAnelloCaseSinastria(
    caseObj, 
    degOffs, 
    simboliScale, 
    diametroInterno, 
    diametroMiniArco, 
    diametroEsterno,
    australInversion, 
    opzioni,
    synastryRotationOverride: number | undefined = undefined,
  ) {
    var group = new THREE.Group();
    
    var coloreLinea = 
      SkinManager.skins[opzioni.settaggi.skin_id].anelloCase.sinastria?.coloreLinea ??
      SkinManager.skins[opzioni.settaggi.skin_id].anelloCase.coloreLinea; 
    var coloreCase =  
      SkinManager.skins[opzioni.settaggi.skin_id].anelloCase.sinastria?.coloreSimboli ??
      SkinManager.skins[opzioni.settaggi.skin_id].anelloCase.coloreSimboli;
    //var miniarcoOffs = 0.21;

    var offsetDegRotazione = synastryRotationOverride === undefined
      ? -caseObj.ascendant + 90 + degOffs
      : synastryRotationOverride + 90;
    // Textured arcs start at a different angular origin from the house lines.
    var offsetDegRotazioneTextures = synastryRotationOverride === undefined
      ? -caseObj.ascendant + degOffs + 180
      : synastryRotationOverride + 180;

    const casePos = unwrapHouseCusps(caseObj.house);
    // A missing or nonfinite Ascendant would make every rotation NaN.
    if (!Number.isFinite(caseObj.ascendant)) {
      throw new TypeError('House ascendant must be a finite longitude.');
    }
    if (!Number.isFinite(degOffs)) {
      throw new TypeError('House rotation offset must be a finite number.');
    }
    if (synastryRotationOverride !== undefined && !Number.isFinite(synastryRotationOverride)) {
      throw new TypeError('Synastry house rotation override must be finite.');
    }

    const texture = 
      SkinManager.skins[opzioni.settaggi.skin_id].anelloCase.sinastria?.texture ??
      SkinManager.skins[opzioni.settaggi.skin_id].anelloCase.texture;
    const coloreTexture = 
      SkinManager.skins[opzioni.settaggi.skin_id].anelloCase.sinastria?.coloreTexture ??
      SkinManager.skins[opzioni.settaggi.skin_id].anelloCase.coloreTexture ??
      'white';

    if ( !texture ) {
      group.add(OggettiSempliciRender.getCerchio(diametroEsterno/2, coloreLinea));
      group.add(OggettiSempliciRender.getCerchio(diametroMiniArco / 2, coloreLinea));
    }

    for(var i=0; i<12; i++) {
      var linea = OggettiSempliciRender.getLinea(
        {x:0,y:diametroInterno/2},
        {x:0,y:diametroEsterno/2},
        coloreLinea
      );
      linea.rotateZ(THREE.MathUtils.degToRad(casePos[i] + offsetDegRotazione));

      if ( texture ) {
        var cbefore = casePos[i] + offsetDegRotazioneTextures;
        var cafter = casePos[(i+1)%12] + offsetDegRotazioneTextures;
        if(cbefore>cafter) cafter+=360;
        const arco = OggettiSempliciRender.getSemiArcoGrosso(
          cbefore,//+ 0.4,
          cafter,//- 0.4,
          diametroInterno / 2 ,//+ 0.02,
          diametroEsterno / 2,
          coloreTexture,
          texture
        );
        
        arco.position.z = -0.001 * (australInversion?-1:1);
        //if(i==1)
        group.add(arco);

        const miniarco = OggettiSempliciRender.getSemiArcoGrosso(
          cbefore,//+ 0.4,
          cafter,//- 0.4,
          diametroInterno / 2 ,// Inner texture band, like renderAnelloCase
          diametroMiniArco / 2,
          coloreTexture,
          texture
        );
        miniarco.position.z = -0.0009 * (australInversion?-1:1);
        group.add(miniarco);
      }
    

      let colore = coloreCase;
      if(coloreCase == 'elementi') {
          colore = SkinManager.skins[opzioni.settaggi.skin_id].elementi[i%4];
      }/*
      let imgColorBase = 
        SkinManager.skins[opzioni.settaggi.skin_id].anelloCase.sinastria?.coloreImgFolder ??
        SkinManager.skins[opzioni.settaggi.skin_id].anelloCase.coloreImgFolder;*/

      var casa = await OggettiSempliciRender.getImg(
        'simboli-bianchi/case/'+String(i+1).padStart(2, '0')+'.png',
        725,460,1/725,australInversion,
        colore
      );
      casa.scale.set(simboliScale*0.9,simboliScale*0.95,1);

      var casaImgPos;
      if(i<11) {
          casaImgPos = (casePos[i+1] - casePos[i])/2 + casePos[i];
      } else if(i==11) {
        casaImgPos = (casePos[0] + 360 - casePos[11])/2 + casePos[11];
      }
      casa.rotateZ(THREE.MathUtils.degToRad(casaImgPos + offsetDegRotazione));
      //casa.translateY( ySimboli );
      casa.translateY( diametroMiniArco/2 + (diametroEsterno/2 - diametroMiniArco/2)/2 );
      casa.rotation.z = 0;

      group.add(casa);
      group.add(linea);

    }

    return group;
  }

  public static async renderAnelloCaseLatitudini(
    caseObj, 
    diametroInterno,
    diametroEsterno,
    australInversion, 
    opzioni
  ) {
    const degOffs = 0;
    var group = new THREE.Group();
    
    var coloreLinea = SkinManager.skins[opzioni.settaggi.skin_id].anelloCase.coloreLinea;
    var coloreCase = SkinManager.skins[opzioni.settaggi.skin_id].anelloCase.coloreSimboli;
    //var miniarcoOffs = 0.21;

    var offsetDegRotazione = -caseObj.ascendant + 90 + degOffs;
    //le texture hanno sistemi di render diversi, cerchio inizio 90 gradi dopo
    var offsetDegRotazioneTextures = -caseObj.ascendant + degOffs + 180;

    const casePos = unwrapHouseCusps(caseObj.house);
    // A missing or nonfinite Ascendant would make every rotation NaN.
    if (!Number.isFinite(caseObj.ascendant)) {
      throw new TypeError('House ascendant must be a finite longitude.');
    }
    if (!Number.isFinite(degOffs)) {
      throw new TypeError('House rotation offset must be a finite number.');
    }

    if ( !SkinManager.skins[opzioni.settaggi.skin_id].anelloCase.texture ) {
      group.add(OggettiSempliciRender.getCerchio(diametroEsterno/2, coloreLinea));
    }

    for(var i=0; i<12; i++) {
      var linea = OggettiSempliciRender.getLinea(
        {x:0,y:diametroInterno/2},
        {x:0,y:diametroEsterno/2},
        coloreLinea
      );
      linea.rotateZ(THREE.MathUtils.degToRad(casePos[i] + offsetDegRotazione));

      if ( SkinManager.skins[opzioni.settaggi.skin_id].anelloCase.texture ) {
        var cbefore = casePos[i] + offsetDegRotazioneTextures;
        var cafter = casePos[(i+1)%12] + offsetDegRotazioneTextures;
        if(cbefore>cafter) cafter+=360;
        const arco = OggettiSempliciRender.getSemiArcoGrosso(
          cbefore,//+ 0.4,
          cafter,//- 0.4,
          diametroInterno / 2 ,//+ 0.02,
          diametroEsterno / 2,
          "white",
          SkinManager.skins[opzioni.settaggi.skin_id].anelloCase.texture
        );
        
        arco.position.z = -0.001 * (australInversion?-1:1);
        //if(i==1)
        group.add(arco);
      }

      let colore = coloreCase;
      const simboliScale = 0.12;
      if(coloreCase == 'elementi') {
          colore = SkinManager.skins[opzioni.settaggi.skin_id].elementi[i%4];
      }
      var casa = await OggettiSempliciRender.getImg(
        'simboli-bianchi/case/'+String(i+1).padStart(2, '0')+'.png',
        725,460,1/725,australInversion,
        colore
      );
      casa.scale.set(simboliScale,simboliScale,1);

      var casaImgPos;
      if(i<11) {
          casaImgPos = (casePos[i+1] - casePos[i])/2 + casePos[i];
      } else if(i==11) {
        casaImgPos = (casePos[0] + 360 - casePos[11])/2 + casePos[11];
      }
      casa.rotateZ(THREE.MathUtils.degToRad(casaImgPos + offsetDegRotazione));
      //casa.translateY( ySimboli );
      casa.translateY( diametroEsterno/2 - 0.13 );
      casa.rotation.z = 0;

      group.add(casa);
      group.add(linea);

    }

    return group;
  }
}
