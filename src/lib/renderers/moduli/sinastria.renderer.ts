import * as THREE from 'three';
import gsap from 'gsap';
import {OggettiSempliciRender} from '../oggetti-semplici.renderer';

import {ElementiCelestiRender} from './elementi-celesti.renderer';
import {CaseRender} from './case.renderer';
import {SegniRender} from './segni.renderer';
import { SkinManager } from '../@skin-manager';
import {StatoCartaAstrale} from '../@carta-astrale/carta-astrale.renderer';
import { stopSceneAnimations } from '../scene-animations';

//import {AssiRender} from './assi.renderer';

export class SinastriaRender {

  public static async getAnelloSinastria(
    temaRender,
    ascendenteTemaDiRiferimento,
    pianetiDaColorare,
    stato:StatoCartaAstrale,
    diametroAssi,
    diametroCerchioAspetti,
    diametroAnelloSegni,
    diametroAnelloElementiCelesti,
    diametroInternoMiniArcoCase,
    diametroAnelloCase,
  ): Promise<any> {
    var group = new THREE.Group();
    try {

    var as = 0;
    var mc = 0;
    if(!temaRender) return null;
    const selectedHouses = temaRender.houses?.[stato.opzioni.settaggi.domificazione_selezionata];
    // Without the selected house system, suppress axes derived from other systems.
    const temaPerElementi = selectedHouses ? temaRender : { ...temaRender, houses: {} };
    if(selectedHouses) {
      as = selectedHouses.ascendant;
      mc = selectedHouses.mc;
      //diametroAnelloElementiCelesti = diametroAnelloCase;
    }

    var imgRefCase;
    var simboliScaleCase = 0.7;
    var offsSinastriaDeflettiva=0;
    /*
    if(opzioni.sinastria.sinastriaDeflettiva) {
      imgRefCase = 'sinastria-deflettiva-case-interno';
      simboliScaleCase = 0.7;
      offsSinastriaDeflettiva =
        (opzioni.sinastria.deflettiSuCasa-1)*30
        +(ascendenteTemaDiRiferimento-as)
      ;
    } else {
      imgRefCase = 'sinastria-case-interno';
      simboliScaleCase = 0.7
    }*/

    var anelloCase;
    if(selectedHouses) {
      anelloCase = await CaseRender.getAnelloCaseCartaAstrale(
        temaRender.houses,
        -(ascendenteTemaDiRiferimento-as) + offsSinastriaDeflettiva,//degOffs
        simboliScaleCase,//simboli scale
        imgRefCase,//img
        stato.opzioni,
        diametroAnelloSegni,
        diametroInternoMiniArcoCase,
        diametroAnelloCase,
        false,//termini
        false, //australInversion
        true
      );
    } else {
      const texture = 
        SkinManager.skins[stato.opzioni.settaggi.skin_id].anelloCase.sinastria?.texture ??
        SkinManager.skins[stato.opzioni.settaggi.skin_id].anelloCase.texture;
      const coloreTexture = 
        SkinManager.skins[stato.opzioni.settaggi.skin_id].anelloCase.sinastria?.coloreTexture ??
        SkinManager.skins[stato.opzioni.settaggi.skin_id].anelloCase.coloreTexture ??
        'white';

      if(texture) {
        const arco = OggettiSempliciRender.getSemiArcoGrosso(
            0,//+ 0.4,
            360,//- 0.4,
            diametroAnelloSegni/2,
            diametroAnelloCase/2,
            coloreTexture,
            texture
        );
        arco.position.z = -0.0009;
        group.add(arco);
      }
    }

    var anelloElementiCelesti = await ElementiCelestiRender.getAnelloElementiCelesti(
      temaPerElementi,
      as + (ascendenteTemaDiRiferimento-as) - offsSinastriaDeflettiva,
      pianetiDaColorare,
      0.8,
      stato.opzioni,
      ['aspetti-sinastria'],
      false,
      diametroAnelloSegni,
      diametroAnelloElementiCelesti,
      diametroAnelloElementiCelesti*94/100,
      true,
      false, //australInversion
      'longitude',
      true, //usaAssi
      false, //calcolaPartiArabe,
      0,//degOffs
      0,//offsDirezioniSemplificate
      0,//offsDirezioniSemplificateFasullo
      stato.opzioni.direzioniModalita == 'temaProgresso' && stato.opzioni.mostraDirezioni, //cerchia la luna
      true //isElementiSinastria
    );
    // Own the completed animated subscene before the next awaited operation.
    group.add(anelloElementiCelesti);

    var anelloSegni = await SegniRender.getAnelloSegniSinastria(
      as + (ascendenteTemaDiRiferimento-as) - offsSinastriaDeflettiva,
      diametroCerchioAspetti,
      diametroAnelloSegni,
      false, //australInversion
      stato
    );
/*
    if(
      !(opzioni.mostraSinastria && opzioni.sinastria.sinastriaDeflettiva) && !opzioni.mostraTransiti
      && (temaRender.houses && Object.keys(temaRender.houses).length)
    ){
      var assi = await AssiRender.getAssi(
        as,
        mc,
        diametroAssi,
        opzioni,
        false, //addTesto
        true, //piuLungo
        true, //imgTransiti
      );
      assi.rotateZ(THREE.MathUtils.degToRad(-(ascendenteTemaDiRiferimento-as) + offsSinastriaDeflettiva));

      group.add( assi );
    }*/

    group.add(anelloSegni);
    if(anelloCase) {
      group.add(anelloCase);
    }

/*
    function setOpacity( obj, opacity ) {
      obj.children.forEach((child)=>{
        setOpacity( child, opacity );
      });
      if ( obj.material && obj.geometry && obj.geometry.width == obj.geometry.height) {
        obj.material.opacity = opacity ;
      };
    };
    //setOpacity( group, 1 );
*/

    return group;
    } catch (error) {
      group.traverse(stopSceneAnimations);
      throw error;
    }
  }
}
