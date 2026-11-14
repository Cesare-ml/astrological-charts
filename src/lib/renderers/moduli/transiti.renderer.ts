import * as THREE from 'three';
import {OggettiSempliciRender} from '../oggetti-semplici.renderer';

//import {AssiRender} from './assi.renderer';
import {ElementiCelestiRender} from './elementi-celesti.renderer';

import {Colori} from '../_colori.config';
import {SkinManager} from '../@skin-manager';
import {getAntisciMarkerColor} from '../antisci-marker-color';

function isEmpty(obj) {
    return Object.keys(obj).length === 0;
}

export class TransitiRender {

  public static async getAnelloTransiti(temaRender, ascendente, pianetiDaColorare, opzioni: any, diametroCerchioInterno, diametroCerchioEsterno, diametroAssi, renderDodecatemori): Promise<any> {
    var group = new THREE.Group();

    //var img = OggettiSempliciRender.getSfondoQuadrato('grafici/'+opzioni.settaggi.skin_id+'/cartaastrale-transiti.png',diametroCerchioEsterno);

    const { coloreLinea, coloreTexture, texture } =
        SkinManager.skins[opzioni.settaggi.skin_id].anelloTransiti;

    if(texture) {
      const anello = OggettiSempliciRender.getSemiArcoGrosso(
          0,360,
          diametroCerchioInterno / 2,
          diametroCerchioEsterno / 2,
          coloreTexture,
          texture
      );
      anello.position.z = -0.001;
      group.add(anello);
    }
    
    var anelloElementiCelesti = await ElementiCelestiRender.getAnelloElementiCelesti(
      temaRender,
      ascendente,
      pianetiDaColorare,
      1,
      opzioni,
      ['aspetti-transiti','monomeri-transiti','antisci-transiti'],
      false,//eventiMouseDodecatemori
      diametroCerchioInterno,
      diametroCerchioEsterno,
      diametroCerchioInterno - (diametroCerchioEsterno - diametroCerchioInterno)*8.5/10,
      false,//lineaSuCerchioEsterno
      temaRender.australInversion,
      'longitude',
      true,//usaAssi
      false//calcolaPartiArabe
    );
    
    
    //group.add(img);
    group.add(anelloElementiCelesti);
    /*
    if(temaRender.houses && Object.keys(temaRender.houses).length) {
      var assi = await AssiRender.getAssi(
        temaRender.houses[opzioni.settaggi.domificazione_selezionata].ascendant,
        temaRender.houses[opzioni.settaggi.domificazione_selezionata].mc,
        diametroAssi,
        opzioni,
        false, //addTesto
        true, //piuLungo
        true, //imgTransiti
      );
      assi.rotateZ(THREE.MathUtils.degToRad(temaRender.houses[opzioni.settaggi.domificazione_selezionata].ascendant - ascendente));
      assi.translateZ(-0.015);
      group.add( assi );
    }*/

    if(opzioni.mostraAntisci) {
      var diametroInternoAnelloAntisci = diametroCerchioEsterno;
      var diametroEsternoAnelloAntisci = diametroCerchioEsterno+0.2;
      var antisci = await TransitiRender.getAntisci(
        temaRender, ascendente, opzioni,
        diametroCerchioInterno, diametroCerchioInterno,
        diametroInternoAnelloAntisci, diametroEsternoAnelloAntisci
      );
      group.add(antisci);
    }

    return group;
  }

  public static async getAntisci(temaRender, ascRef, opzioni, diametroAnelloCase, diametroAnelloSegni, diametroInternoAnelloAntisci, diametroEsternoAnelloAntisci) {
    var group = new THREE.Group();
    var assi = {
      'Cardinale': 270, // Capricorno-Cancro
      'Fissa':     300, // Acquario-Leone
      'Mutevole':  330 // Pesci-Vergine
    };
    var ascendente = ascRef;
    // Resolving planets clones the theme data; do it only when a drawable
    // antiscia axis is enabled AND a planet hover relation is requested.
    const assiAttivi = Object.keys(assi).filter(
      c => Object.hasOwn(opzioni.antisci ?? {}, c) && opzioni.antisci[c]
    );
    const nomeHover = opzioni.antisciTransitiHover?.nome;
    const elementiCelesti = assiAttivi.length > 0 && nomeHover
      ? await ElementiCelestiRender.getElementiCelesti(temaRender,opzioni,false)
      : null;

    const coloreCerchio = getAntisciMarkerColor(SkinManager.skins[opzioni.settaggi.skin_id].bgColor);
    const hoverLongitude = elementiCelesti?.[nomeHover]?.longitude;

    //Disegno gli assi
    // Iterate the supported axes only: legacy option payloads may contain unknown keys.
    for(const c of assiAttivi) {
      {
        var asse = await OggettiSempliciRender.getLineaGrossa({x:0,y:-diametroAnelloSegni/2,z:0},{x:0,y:diametroAnelloSegni/2,z:0},"yellow",0.6);
        asse.rotateZ(THREE.MathUtils.degToRad(
          75-ascendente+15 + assi[c]
        ));
        group.add(asse);
      }
    }

    // Se antisciTransitiHover allora traccio le linee
    for (const c of assiAttivi) {
      if(Number.isFinite(hoverLongitude)) {
        var lngantisci = 2*assi[c] - hoverLongitude;

        var pianeta = OggettiSempliciRender.getCerchio(0.025,coloreCerchio);
        pianeta.rotateZ(THREE.MathUtils.degToRad(
          75-ascendente+15 + hoverLongitude
        ));
        pianeta.translateY(diametroAnelloCase/2);

        var antisci = OggettiSempliciRender.getCerchio(0.025,coloreCerchio);
        antisci.rotateZ(THREE.MathUtils.degToRad(
          75-ascendente+15 + lngantisci
        ));
        antisci.translateY(diametroAnelloCase/2);

        var lngContrAntisci = lngantisci+180;
        var contrAntisci = OggettiSempliciRender.getCerchio(0.025,coloreCerchio);
        contrAntisci.rotateZ(THREE.MathUtils.degToRad(
          75-ascendente+15 + lngContrAntisci
        ));
        contrAntisci.translateY(diametroAnelloCase/2);

        var lineaA1 = OggettiSempliciRender.getLineaGrossa(
          pianeta.position,
          antisci.position,
          Colori.elementiCelesti[opzioni.antisciTransitiHover.nome],
          0.6
        );
        var lineaA2 = OggettiSempliciRender.getLineaGrossa(
          antisci.position,
          new THREE.Vector3(0,0,0),
          Colori.elementiCelesti[opzioni.antisciTransitiHover.nome],
          0.6
        );
        var lineaA3 = OggettiSempliciRender.getLineaGrossa(
          new THREE.Vector3(0,0,0),
          pianeta.position,
          Colori.elementiCelesti[opzioni.antisciTransitiHover.nome],
          0.6
        );
        var lineaB = OggettiSempliciRender.getLineaGrossaTratteggiata(
          new THREE.Vector3(0,0,0),
          contrAntisci.position,
          "#f60a09",
          0.6,
          0.05,
        );

        group.add(pianeta);
        group.add(antisci);
        group.add(contrAntisci);
        group.add(lineaA1);
        group.add(lineaA2);
        group.add(lineaA3);
        group.add(lineaB);
      }
    }

    return group;
  }
}
