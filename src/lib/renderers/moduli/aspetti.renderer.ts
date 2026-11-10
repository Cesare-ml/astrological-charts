import * as THREE from 'three';
import gsap from 'gsap';
import {OggettiSempliciRender} from '../oggetti-semplici.renderer';

import {ElementiCelestiRender} from './elementi-celesti.renderer';

import {Settaggi} from '../../models/settaggi.model';
import {Colori} from '../_colori.config';

import {SkinManager} from '../@skin-manager';

export class AspettiRender {

  public static tipoLinea = {
    congiunzione:             { tipo: 'linea' },
    semisestile:              { tipo: 'linea' },
    sestile:                  { tipo: 'linea' },
    quadrato:                 { tipo: 'linea' },
    trigono:                  { tipo: 'linea' },
    opposizione:              { tipo: 'linea' },
    quinconce:                { tipo: 'puntolinea', trattoLinea: {
                                                      passo: 0.18,
                                                      rateoLineaSpazio: 1,
                                                      nLinee: 1,
                                                      nPunti: 0
                                                    } },
    semiquadrato:             { tipo: 'tratteggio', passo: 0.02 },
    quintile:                 { tipo: 'puntolinea', trattoLinea: {
                                                      passo: 0.17,
                                                      rateoLineaSpazio: 1,
                                                      nLinee: 1,
                                                      nPunti: 1
                                                    } },
    biquintile:                 { tipo: 'puntolinea', trattoLinea: {
                                                      passo: 0.17,
                                                      rateoLineaSpazio: 1,
                                                      nLinee: 1,
                                                      nPunti: 1
                                                    } },
    semiquintile:                 { tipo: 'puntolinea', trattoLinea: {
                                                      passo: 0.17,
                                                      rateoLineaSpazio: 1,
                                                      nLinee: 1,
                                                      nPunti: 1
                                                    } },
    parallelodideclinazione:  { tipo: 'puntolinea', trattoLinea: {
                                                      passo: 0.1,
                                                      rateoLineaSpazio: 1,
                                                      nLinee: 1,
                                                      nPunti: 2
                                                    } },
    antiparallelo:            { tipo: 'puntolinea', trattoLinea: {
                                                      passo: 0.1,
                                                      rateoLineaSpazio: 1,
                                                      nLinee: 1,
                                                      nPunti: 2
                                                    } },
    phisolare:                { tipo: 'puntolinea', trattoLinea: {
                                                      passo: 0.2,
                                                      rateoLineaSpazio: 1/3,
                                                      nLinee: 1,
                                                      nPunti: 2
                                                    } },
    philunare:                { tipo: 'puntolinea', trattoLinea: {
                                                      passo: 0.2,
                                                      rateoLineaSpazio: 1/3,
                                                      nLinee: 1,
                                                      nPunti: 2
                                                    } },
    novile:                   { tipo: 'linea' },
    settile:                  { tipo: 'linea' },
  }


  public static getCerchioAspettiMultiTema(
    as,temiRenderPerAspetti,elementoCelestePerAspetti,opzioni,diametroCerchioAspetti,diametroAnelloTransiti,monocolore
  ) {
    var aspettiVerso = AspettiRender.getAspettiVerso(opzioni);
    var aspetti = AspettiRender.getTipiAspetti(opzioni);
    var spetti_orbite = opzioni.settaggi.aspetti_orbite;

    var retGroup = new THREE.Group();
    var retNodi = {};

    var nodi2 = {};
    nodi2[elementoCelestePerAspetti.nome] = elementoCelestePerAspetti.el;
    nodi2 = AspettiRender.getNodi(
      nodi2,
      opzioni,
      elementoCelestePerAspetti.rotateOffs,
      elementoCelestePerAspetti.y
    );

    for(var ti=0; ti<temiRenderPerAspetti.length; ti++) {
      var nodi = AspettiRender.getNodi(
        ElementiCelestiRender.getElementiCelesti(temiRenderPerAspetti[ti].temaRender,opzioni,true,'longitude',temiRenderPerAspetti[ti].calcolaPartiArabe,temiRenderPerAspetti[ti].offsDirezioniSemplificate),
        opzioni,
        temiRenderPerAspetti[ti].rotateOffs,
        temiRenderPerAspetti[ti].y
      );

      var nodiNomi = [];
      var archi = AspettiRender.getArchiDoppioTema(nodi,nodi2,aspetti,aspettiVerso,spetti_orbite);
      if(Object.keys(archi).length > 0) {
        for(let k=0; k<aspetti.length; k++) {
          let tipoAspetto = Settaggi.aspetti[aspetti[k]].g;
          if(archi[tipoAspetto]) {
            for(let i=0; i<archi[tipoAspetto].length; i++) {
              archi[tipoAspetto][i][1] += nodi.length;
              nodiNomi.push(nodi[archi[tipoAspetto][i][0]].name);
            }
          }
        }
      }

      var nodiConcat = nodi.concat(nodi2);

      var archiGroup = AspettiRender.renderArchi(
        as,
        nodiConcat,
        archi,
        aspetti,
        opzioni, //'estrapola','visualizza sorti'
        diametroCerchioAspetti,
        monocolore,
        'longitude'
      );
      retGroup.add(archiGroup);
      retNodi[temiRenderPerAspetti[ti].anello] = nodiNomi;
    }

    return {
      'group': retGroup,
      'nodiNomiPerAnello': retNodi
    };
  }

  public static async getCerchioAspetti(as,temaRender,opzioni,diametroCerchio,monocolore,calcolaPartiArabe=false,nomeElementoCelesteInEvidenza:any=false,australInversion=false): Promise<any> {
    var aspettiVerso = AspettiRender.getAspettiVerso(opzioni);
    var aspetti = AspettiRender.getTipiAspetti(opzioni);
    var spetti_orbite = opzioni.settaggi.aspetti_orbite;

    var nodi = AspettiRender.getNodi(
      ElementiCelestiRender.getElementiCelesti(temaRender,opzioni,true,'longitude',calcolaPartiArabe),
      opzioni,
      0, //rotateOffs,
      diametroCerchio/2, //y
    );

    for(var i=0; i<nodi.length; i++) {
      switch(nodi[i].name) {
        case "AS":
        case "DS":
        case "MC":
        case "IC": break;
        default:
          nodi[i].longitude = nodi[i].longitude;
      }
    }
   
    //aggiungo gli archi
    var archi = AspettiRender.getArchi(nodi,aspetti,aspettiVerso,spetti_orbite);
    var group = AspettiRender.renderArchi(
      as,
      nodi,archi,aspetti,
      opzioni, //'estrapola','visualizza sorti'
      diametroCerchio,monocolore,"longitude",
      nomeElementoCelesteInEvidenza
    );
    group.add(await this.getBackgroundAspetti(diametroCerchio,opzioni,australInversion));

    return group;
  }

  public static async getBackgroundAspetti(diametroCerchio,opzioni,australInversion) {
    var group = new THREE.Group();
  //risuonatore solare di sfondo
    
    const arco = OggettiSempliciRender.getSemiArcoGrosso(
      0 ,//+ 0.4,
      360 ,//- 0.4,
      diametroCerchio/2 ,//+ 0.02,
      0,
      SkinManager.skins[opzioni.settaggi.skin_id].cerchioAspetti.coloreTexture,
      SkinManager.skins[opzioni.settaggi.skin_id].cerchioAspetti.texture,
    );
    arco.position.z = -0.002 * (australInversion?-1:1);
    group.add(arco);

    //console.log(diametroCerchio);
    var imgScale = (diametroCerchio/2.4288)*SkinManager.skins[opzioni.settaggi.skin_id].cerchioAspetti.imgRisuonatoreScale;

    var risuonatoreSolare = await OggettiSempliciRender.getImg(
      SkinManager.skins[opzioni.settaggi.skin_id].cerchioAspetti.imgRisuonatoreSolare,
      SkinManager.skins[opzioni.settaggi.skin_id].cerchioAspetti.imgRisuonatoreSolareWidth,
      SkinManager.skins[opzioni.settaggi.skin_id].cerchioAspetti.imgRisuonatoreSolareHeight,
      1/SkinManager.skins[opzioni.settaggi.skin_id].cerchioAspetti.imgRisuonatoreSolareWidth,
      false,
      SkinManager.skins[opzioni.settaggi.skin_id].cerchioAspetti.imgRisuonatoreColore,
    );
    risuonatoreSolare.scale.set(1*imgScale,1*imgScale,1);
    risuonatoreSolare.rotateZ(THREE.MathUtils.degToRad(90));
    risuonatoreSolare.translateY(0);
    risuonatoreSolare.translateZ(-0.0009)
        
    risuonatoreSolare.material.transparent = true; // abilita trasparenza
    risuonatoreSolare.material.opacity = SkinManager.skins[opzioni.settaggi.skin_id].cerchioAspetti.imgRisuonatoreSolareOpacity;      // valore tra 0 (invisibile) e 1 (opaco)
    group.add(risuonatoreSolare);

    return group;
  }

  public static getAspettiVerso(opzioni) {
    var aspettiVerso = [];
    for (let nome in opzioni.settaggi.elementi_celesti) {
      let el = opzioni.settaggi.elementi_celesti[nome];
      if(el.aspVerso == true)
        aspettiVerso.push(nome);
    }
    return aspettiVerso;
  }

  public static getTipiAspetti(opzioni) {
    var aspetti = [];
    for (let nome in opzioni.settaggi.aspetti_attivi) {
      if(opzioni.settaggi.aspetti_attivi[nome] == true){
        aspetti.push(nome);
      }
    }
    return aspetti;
  }

  public static getArchiDoppioTema(nodi,nodi2,aspetti,aspettiVerso,spetti_orbite){
    var archi = {};
    //Calcolo gli archi
    if(nodi.length > 0) {
      for(let k=0; k<aspetti.length; k++) {
        let tipoAspetto = Settaggi.aspetti[aspetti[k]].g;
        for(let i=0; i<nodi.length; i++) {
          if(aspettiVerso.indexOf(nodi[i].name) != -1) {
            for(var j=0; j<nodi2.length; j++) {
              var orb = nodi2[j].orb;
              if(spetti_orbite[aspetti[k]] && spetti_orbite[aspetti[k]]<orb) {
                orb = spetti_orbite[aspetti[k]];
              }
              if(
                aspettiVerso.indexOf(nodi2[j].name) != -1
                &&(
                  !(aspetti[k] == 'phisolare' || aspetti[k] == "philunare")
                  &&(
                        nodi[i].longitude + tipoAspetto < nodi2[j].longitude + orb
                    &&  nodi[i].longitude + tipoAspetto > nodi2[j].longitude - orb
                    ||  nodi[i].longitude - (360-tipoAspetto) < nodi2[j].longitude + orb
                    &&  nodi[i].longitude - (360-tipoAspetto) > nodi2[j].longitude - orb
                    ||  nodi[i].longitude - tipoAspetto < nodi2[j].longitude + orb
                    &&  nodi[i].longitude - tipoAspetto > nodi2[j].longitude - orb
                    ||  nodi[i].longitude + (360-tipoAspetto) < nodi2[j].longitude + orb
                    &&  nodi[i].longitude + (360-tipoAspetto) > nodi2[j].longitude - orb
                  )
                  ||
                  (aspetti[k] == 'phisolare' || aspetti[k] == "philunare")
                  &&(
                        nodi[i].longitude + tipoAspetto < nodi2[j].longitude + orb
                    &&  nodi[i].longitude + tipoAspetto > nodi2[j].longitude - orb
                  )
                )
              ) {
                if(archi[tipoAspetto]==undefined)
                  archi[tipoAspetto]=[];
                if(
                  !(nodi[i].name=='AS' && nodi2[j].name=='DS')
                  && !(nodi[i].name=='MC' && nodi2[j].name=='IC')
                  && !(nodi[i].name=='AS' && nodi2[j].name=='MC')
                  && !(nodi[i].name=='AS' && nodi2[j].name=='IC')
                  && !(nodi[i].name=='DS' && nodi2[j].name=='MC')
                  && !(nodi[i].name=='DS' && nodi2[j].name=='IC')
                ) {
                  archi[tipoAspetto].push([i,j]);
                }
              }
            }
          }
        }
      }
    }
    return archi;
  }

  public static getArchi(nodi,aspetti,aspettiVerso,spetti_orbite){
    var archi = {};
    //Calcolo gli archi
    if(nodi.length > 0) {
      for(let k=0; k<aspetti.length; k++) {
        let tipoAspetto = Settaggi.aspetti[aspetti[k]].g;
        for(let i=0; i<nodi.length; i++) {
          if(aspettiVerso.indexOf(nodi[i].name) != -1 || nodi[i].name.indexOf('-dodecatemoria')>=0) {
            for(var j=i+1; j<nodi.length; j++) {
              var orb = nodi[j].orb;
              if(spetti_orbite[aspetti[k]] && spetti_orbite[aspetti[k]]<orb) {
                orb = spetti_orbite[aspetti[k]];
              }
              if(
                aspettiVerso.indexOf(nodi[j].name) != -1
                &&(
                  !(aspetti[k] == 'phisolare' || aspetti[k] == "philunare")
                  &&(
                        nodi[i].longitude + tipoAspetto < nodi[j].longitude + orb
                    &&  nodi[i].longitude + tipoAspetto > nodi[j].longitude - orb
                    ||  nodi[i].longitude - (360-tipoAspetto) < nodi[j].longitude + orb
                    &&  nodi[i].longitude - (360-tipoAspetto) > nodi[j].longitude - orb
                    ||  nodi[i].longitude - tipoAspetto < nodi[j].longitude + orb
                    &&  nodi[i].longitude - tipoAspetto > nodi[j].longitude - orb
                    ||  nodi[i].longitude + (360-tipoAspetto) < nodi[j].longitude + orb
                    &&  nodi[i].longitude + (360-tipoAspetto) > nodi[j].longitude - orb
                  )
                  ||
                  (aspetti[k] == 'phisolare' || aspetti[k] == "philunare")
                  &&(
                        nodi[i].longitude + tipoAspetto < nodi[j].longitude + orb
                    &&  nodi[i].longitude + tipoAspetto > nodi[j].longitude - orb
                  )
                  ||
                  aspetti[k] == 'parallelodideclinazione'
                  &&(
                    nodi[i].declinazione != undefined
                    && nodi[j].declinazione != undefined
                    && nodi[i].declinazione < nodi[j].declinazione + 1
                    && nodi[i].declinazione > nodi[j].declinazione - 1
                  )
                  ||
                  aspetti[k] == 'antiparallelo'
                  &&(
                    nodi[i].declinazione != undefined
                    && nodi[j].declinazione != undefined
                    && nodi[i].declinazione < -nodi[j].declinazione + 1
                    && nodi[i].declinazione > -nodi[j].declinazione - 1
                  )
                )
              ) {
                if(archi[tipoAspetto]==undefined)
                  archi[tipoAspetto]=[];
                if( // escludo gli aspetti sugli assi
                     !(nodi[i].name=='AS' && nodi[j].name=='DS')
                  && !(nodi[i].name=='AS' && nodi[j].name=='MC')
                  && !(nodi[i].name=='AS' && nodi[j].name=='IC')
                  && !(nodi[i].name=='MC' && nodi[j].name=='IC')
                  && !(nodi[i].name=='DS' && nodi[j].name=='AS')
                  && !(nodi[i].name=='DS' && nodi[j].name=='MC')
                  && !(nodi[i].name=='DS' && nodi[j].name=='IC')
                  && !(nodi[i].name=='osc. Apogee' && nodi[j].name=='osc. Perigee')
                  && !(nodi[i].name=='osc. Perigee' && nodi[j].name=='osc. Apogee')
                  && !(nodi[i].name=='mean Apogee' && nodi[j].name=='mean Perigee')
                  && !(nodi[i].name=='mean Perigee' && nodi[j].name=='mean Apogee')
                  && !(nodi[i].name=='true Node' && nodi[j].name=='true Node Sud')
                  && !(nodi[i].name=='true Node Sud' && nodi[j].name=='true Node')
                  && !(nodi[i].name=='mean Node' && nodi[j].name=='mean Node Sud')
                  && !(nodi[i].name=='mean Node Sud' && nodi[j].name=='mean Node')
                ) {
                  archi[tipoAspetto].push([i,j]);
                }
              }
            }
          }
        }
      }
    }
    return archi;
  }

  public static getNodi(elementiCelesti,opzioni,rotateOffs,y,parametroDiRender="longitude") {
    var nodi = [];

    //aggiungo i nodi
    for(let nome in elementiCelesti) {
      var n:any = {
        name: nome,
        longitude: (elementiCelesti[nome]['longitude'] + rotateOffs) % 360,
        orb: opzioni.settaggi.elementi_celesti[nome].orb,
        y: y
      };

      if(parametroDiRender!='longitude')
        n[parametroDiRender] = elementiCelesti[nome][parametroDiRender];

      if(elementiCelesti[nome].equatoriale) {
        n.declinazione = elementiCelesti[nome].equatoriale.declination;
      }
      nodi.push(n);

      if(opzioni.dodecatemore) {
        if(opzioni.dodecatemore == nome && elementiCelesti[nome]['dodecatemoria']) {
          nodi.push({
            name: nome+'-dodecatemoria',
            longitude: (elementiCelesti[nome]['dodecatemoria']['longitude'] + rotateOffs) % 360,
            orb: opzioni.settaggi.elementi_celesti[nome].orb,
            y: y
          });
        }
      }
    }

    return nodi;
  }


  public static renderArchi(as,nodi,archi,aspetti,opzioni,diametroCerchio,monocolore,parametroDiRender="longitude",nomeElementoCelesteInEvidenza=false) {
    var group = new THREE.Group();

    if(Object.keys(archi).length > 0) {
      for(let k=0; k<aspetti.length; k++) {
        let tipoAspetto = Settaggi.aspetti[aspetti[k]].g;
        if(archi[tipoAspetto]) {
          for(let i=0; i<archi[tipoAspetto].length; i++) {
            var a = new THREE.Vector2( 0, diametroCerchio/2);
            var a2 = new THREE.Vector2( 0, nodi[archi[tipoAspetto][i][0]].y);
            var b = new THREE.Vector2( 0, diametroCerchio/2);
            var b2 = new THREE.Vector2( 0, nodi[archi[tipoAspetto][i][1]].y);
            a.rotateAround(
              new THREE.Vector2(0,0),
              THREE.MathUtils.degToRad(
                90-as + nodi[archi[tipoAspetto][i][0]][parametroDiRender]
              )
            );
            a2.rotateAround(
              new THREE.Vector2(0,0),
              THREE.MathUtils.degToRad(
                90-as + nodi[archi[tipoAspetto][i][0]][parametroDiRender]
              )
            );
            b.rotateAround(
              new THREE.Vector2(0,0),
              THREE.MathUtils.degToRad(
                90-as + nodi[archi[tipoAspetto][i][1]][parametroDiRender]
              )
            );
            b2.rotateAround(
              new THREE.Vector2(0,0),
              THREE.MathUtils.degToRad(
                90-as + nodi[archi[tipoAspetto][i][1]][parametroDiRender]
              )
            );

            var coloreAspetto = Colori.aspetti[aspetti[k]];
            var colore = coloreAspetto;
            //console.log(opzioni,opzioni.kleros);
            if(monocolore){
              colore = monocolore;
            } else {
              //per esempio quando nel radix viene messo in evidenza un pianeta ed i suoi aspetti
              if(nomeElementoCelesteInEvidenza) {
                if(!(
                    nodi[archi[tipoAspetto][i][0]].name == nomeElementoCelesteInEvidenza
                  || nodi[archi[tipoAspetto][i][1]].name == nomeElementoCelesteInEvidenza
                )) {
                  colore = '#444444';
                }
              }
            }
            if(
              (
                opzioni.kleros == 'estrapola-tutto'
                || opzioni.kleros == 'estrapola-4luminarie'
                || opzioni.kleros == 'estrapola-5planetarie'
              )
              && (
                nodi[archi[tipoAspetto][i][0]].name != 'Tyche'
                && nodi[archi[tipoAspetto][i][0]].name != 'Daimon'
                && nodi[archi[tipoAspetto][i][0]].name != 'Basis'
                && nodi[archi[tipoAspetto][i][0]].name != 'Ananke'
                && nodi[archi[tipoAspetto][i][0]].name != 'Eros'
                && nodi[archi[tipoAspetto][i][0]].name != 'Hermes'
                && nodi[archi[tipoAspetto][i][0]].name != 'Tolma'
                && nodi[archi[tipoAspetto][i][0]].name != 'Nike'
                && nodi[archi[tipoAspetto][i][0]].name != 'Nemesi'
                &&
                   nodi[archi[tipoAspetto][i][1]].name != 'Tyche'
                && nodi[archi[tipoAspetto][i][1]].name != 'Daimon'
                && nodi[archi[tipoAspetto][i][1]].name != 'Basis'
                && nodi[archi[tipoAspetto][i][1]].name != 'Ananke'
                && nodi[archi[tipoAspetto][i][1]].name != 'Eros'
                && nodi[archi[tipoAspetto][i][1]].name != 'Hermes'
                && nodi[archi[tipoAspetto][i][1]].name != 'Tolma'
                && nodi[archi[tipoAspetto][i][1]].name != 'Nike'
                && nodi[archi[tipoAspetto][i][1]].name != 'Nemesi'
              )
            ) {
              colore = '#333333';
            }

            var linea;
            var tipoLinea = AspettiRender.tipoLinea[aspetti[k]];
            var spessore = 1.3;
            if(aspetti[k] == 'congiunzione')
              spessore = 0.8;
            switch(tipoLinea.tipo) {
              case 'tratteggio':
                linea = OggettiSempliciRender.getLineaGrossaTratteggiata(a,b,colore,spessore,tipoLinea.passo);
              break;
              case 'puntolinea':
                linea = OggettiSempliciRender.getLineaGrossaPuntoLinea(a,b,colore,spessore,tipoLinea.trattoLinea);
                break;
              case 'linea':
              default:
                linea = OggettiSempliciRender.getLineaGrossa(a,b,colore,spessore);
            }
            group.add(linea);

            if(nodi[archi[tipoAspetto][i][0]].y != diametroCerchio/2) {
              var linea2 = OggettiSempliciRender.getLineaGrossaTratteggiata(a,a2,colore,0.15,0.05);
              group.add(linea2);
            }
            if(nodi[archi[tipoAspetto][i][1]].y != diametroCerchio/2) {
              var linea3 = OggettiSempliciRender.getLineaGrossaTratteggiata(b,b2,colore,0.15,0.05);
              group.add(linea3);
            }
          }
        }
      }
    }
    return group;
  }
}
