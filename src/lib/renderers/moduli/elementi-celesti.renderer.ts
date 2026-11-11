import * as THREE from 'three';
import type { ChartPlanetLayer } from '../planet-interaction.types';
import gsap from 'gsap';
import {OggettiSempliciRender} from '../oggetti-semplici.renderer';

import {Colori} from '../_colori.config';
import { SkinManager } from '../@skin-manager';
import { registerSceneAnimation, stopSceneAnimations } from '../scene-animations';


export class ElementiCelestiRender {

  private static offsetMinimoPianeti:number = 7;//6; //deg

  public static async getAnelloElementiCelesti(
    temaRender,
    ascendente,
    pianetiDaColorare,
    simboliScale,
    opzioni,
    eventiMouse, //array
    eventiMouseDodecatemori, //array
    diametroCerchioInterno,
    diametroCerchioEsterno,
    diametroCerchioDodecatemori,
    lineaSuCerchioEsterno,
    australInversion,
    parametroDiRender='longitude',
    usaAssi=true,
    calcolaPartiArabe=false,
    degOffs=0,
    offsDirezioniSemplificate=0,
    offsDirezioniSemplificateFasullo=0,
    isCerchiaLaLuna=false,
    isElementiSinastria=false,
    interactionLayer: ChartPlanetLayer = 'natal'
  ): Promise<any> {
    var group = new THREE.Group();
    try {
    var elementiCelesti = ElementiCelestiRender.getElementiCelesti(temaRender,opzioni,usaAssi,parametroDiRender,calcolaPartiArabe,offsDirezioniSemplificate);

    if(offsDirezioniSemplificateFasullo) {
      elementiCelesti['AS'][parametroDiRender] =
        ( elementiCelesti['AS'][parametroDiRender]
        - offsDirezioniSemplificateFasullo
        + 360
        )%360
      ;
      elementiCelesti['DS'][parametroDiRender] =
        ( elementiCelesti['DS'][parametroDiRender]
        - offsDirezioniSemplificateFasullo
        + 360
        )%360
      ;
    }


    let coloreLinea = SkinManager.skins[opzioni.settaggi.skin_id].anelloElementiCelesti.coloreLinea;
    let coloreSimboli =  SkinManager.skins[opzioni.settaggi.skin_id].anelloElementiCelesti.coloreSimboli;
    let coloreImgFolder = SkinManager.skins[opzioni.settaggi.skin_id].anelloElementiCelesti.coloreImgFolder;

    if(isElementiSinastria) {
      coloreLinea = SkinManager.skins[opzioni.settaggi.skin_id].anelloElementiCelesti.sinastria?.coloreLinea ??
        coloreLinea;

      coloreSimboli =  SkinManager.skins[opzioni.settaggi.skin_id].anelloElementiCelesti.sinastria?.coloreSimboli ??
        coloreSimboli;
        
      coloreImgFolder =  SkinManager.skins[opzioni.settaggi.skin_id].anelloElementiCelesti.sinastria?.coloreImgFolder ??
        coloreImgFolder;
    }

    var elementiCelestiRenderPos = this.getRenderPosPianeti(elementiCelesti,parametroDiRender);


    var raggioConfineAnelloPianeti = diametroCerchioEsterno/2;

    var raggioEclittica = (raggioConfineAnelloPianeti - diametroCerchioInterno/2)/2 + diametroCerchioInterno/2;

    //parti arabe render freccia+elemento in evidenza
    var partiArabeNomePianetaHighlight = undefined;
    if(calcolaPartiArabe) {
      //init
      var formula = undefined;
      if(
        opzioni.partiArabe.formulaSelezionataIndex != undefined
        && opzioni.partiArabe.modalita == 'essenziali'
      ) {
        formula = temaRender.partiArabe.essenziali[opzioni.partiArabe.formulaSelezionataIndex];
      } else if(
        opzioni.partiArabe.formulaSelezionataIndex != undefined
        &&  opzioni.partiArabe.formulaAbumasharCasaSelezionata != undefined
        && opzioni.partiArabe.modalita == 'abumashar'
      ) {
        formula = temaRender.partiArabe.abumashar
          [opzioni.partiArabe.formulaAbumasharCasaSelezionata]
          [opzioni.partiArabe.formulaSelezionataIndex]
        ;
      }
      //calcolo
      if( formula ) {
        var puntoZero = 90-temaRender.houses[opzioni.settaggi.domificazione_selezionata].ascendant;

        var daLng = temaRender.houses[opzioni.settaggi.domificazione_selezionata].ascendant;//ascendente
        var aLng;
        var frecciaAdArcoColore = '#f5bb2c';


        //da
        if(formula.nomePianetaCardinale.indexOf('CUSP-') == 0 ) {
          var nCasa = parseInt(formula.nomePianetaCardinale.substring(5));
          daLng = temaRender.houses[opzioni.settaggi.domificazione_selezionata].house[nCasa];
        }

        //a
        if(formula.nomePianetaHighlight.indexOf('LNG-') == 0 ) {
          aLng = parseFloat(formula.nomePianetaHighlight.substring(4));
          aLng += formula.lngOffs;
        } else if(formula.nomePianetaHighlight.indexOf('ASSE-') == 0 ) {
          var nomeAsse = formula.nomePianetaHighlight.substring(5);
          aLng = formula.lngOffs + temaRender.houses[opzioni.settaggi.domificazione_selezionata][nomeAsse];
        } else {
          aLng = formula.lngOffs + temaRender.planets[formula.nomePianetaHighlight].longitude;
          partiArabeNomePianetaHighlight = formula.nomePianetaHighlight;
          frecciaAdArcoColore = Colori.elementiCelesti[formula.nomePianetaHighlight];
        }


        //disegno
        var frecciaAdArco = OggettiSempliciRender.lanciaFrecciaAdArco(
          puntoZero+daLng, puntoZero+aLng,
          frecciaAdArcoColore,
          frecciaAdArcoColore,
          diametroCerchioInterno,diametroCerchioEsterno
        );

        group.add(frecciaAdArco);
      }
    }

    for(let nome in elementiCelesti) {
      var elGroup = new THREE.Group();

      var elRef = null;

      var colorePianeta = coloreImgFolder;
      if(colorePianeta) colorePianeta += '/';
      else colorePianeta = "";
      /*
      if(opzioni.settaggi.skin_id == 'light') {
        colorePianeta = 'nero/'
      }*/
      var lightThemeNomeAppendice='';
      if(
        pianetiDaColorare.indexOf(nome) != -1
        || nome == partiArabeNomePianetaHighlight
        || nome == 'Daimon'
        || nome == 'Tyche'
        || nome == 'Ananke'
        || nome == 'Basis'
      ) {
        colorePianeta = '';
      }

      if(elementiCelesti[nome]['longitudeSpeed'] < 0) {
        elRef = 'simboli-bianchi/elementi-celesti/'+nome+'-r.png';
      } else {
        elRef = 'simboli-bianchi/elementi-celesti/'+nome+'.png';
      }
      var el = await OggettiSempliciRender.getImg(elRef,875,605,1/875,australInversion,coloreSimboli);
      el.scale.set(0.22*simboliScale,0.22*simboliScale,1);
      el.rotateZ(THREE.MathUtils.degToRad(
        elementiCelestiRenderPos[nome][parametroDiRender] - elementiCelesti[nome][parametroDiRender]
      ));
      el.translateY(raggioEclittica);

      if(opzioni.dodecatemoriAttivi && opzioni.dodecatemore != 'tutti') {
        el.material.opacity = 0.3;
      }

      if(calcolaPartiArabe && opzioni.partiArabe.modalita != 'crea') {
        if(nome == partiArabeNomePianetaHighlight) {
          //animazione
          var tl = gsap.timeline({repeat: -1, repeatDelay: 0, yoyo: true});
          registerSceneAnimation(group, tl);
          tl.to(el.material, {opacity: 0});
        } else {
          el.material.opacity = 0.3;
        }
      }

      if(
        isCerchiaLaLuna
        && nome == "Moon"
      ) {
        var coloreCerchio = '#ffffff';
        if(opzioni.settaggi.skin_id == 'light'){
          coloreCerchio = '#000000'
        }

        var raggioCerchietto = (raggioConfineAnelloPianeti - diametroCerchioInterno/2)/2;
        var cerchietto = OggettiSempliciRender.getCerchio(raggioCerchietto,coloreCerchio);
        cerchietto.rotateZ(THREE.MathUtils.degToRad(
          75-ascendente+15
          + elementiCelesti[nome][parametroDiRender]
          + degOffs
        ));
        cerchietto.translateX(el.position.x);
        cerchietto.translateY(el.position.y);
        //cerchietto.translateY(el.position.y);
        var lineaCerchietto = OggettiSempliciRender.getLinea({x:0,y:0},el.position,"#888");
        lineaCerchietto.rotateZ(THREE.MathUtils.degToRad(
          75-ascendente+15
          + elementiCelesti[nome][parametroDiRender]
          + degOffs
        ));
        group.add(cerchietto);
        group.add(lineaCerchietto);
      }

      if(
        (
          opzioni.kleros == 'estrapola-tutto'
        || opzioni.kleros == 'estrapola-4luminarie'
        || opzioni.kleros == 'estrapola-5planetarie'
        )
        && nome != 'Tyche'
        && nome != 'Daimon'
        && nome != 'Basis'
        && nome != 'Ananke'
        && nome != 'Eros'
        && nome != 'Hermes'
        && nome != 'Tolma'
        && nome != 'Nike'
        && nome != 'Nemesi'
      ) {
        el.material.opacity = 0.3;
      }

      function accorciaLinea(da, a, valore = 0.9, usaPercentuale = true) {
        const daVec = new THREE.Vector2(da.x, da.y);
        const aVec = new THREE.Vector2(a.x, a.y);

        // direzione e lunghezza
        const dir = new THREE.Vector2().subVectors(aVec, daVec);
        const lunghezza = dir.length();

        // calcolo del nuovo fattore di accorciamento
        let nuovoFattore;
        if (usaPercentuale) {
          // valore = percentuale (es. 0.9 => linea lunga il 90%)
          nuovoFattore = valore;
        } else {
          // valore = lunghezza da accorciare
          const riduzione = Math.min(valore, lunghezza); // evita valori > lunghezza
          nuovoFattore = (lunghezza - riduzione) / lunghezza;
        }

        // nuovo punto finale accorciato
        dir.multiplyScalar(nuovoFattore);
        const p2Accorciato = new THREE.Vector2().copy(daVec).add(dir);

        return p2Accorciato;
      }



      
      const accorciamento = 0.09; // oppure calcolato dinamicamente
      if(lineaSuCerchioEsterno) {
        const p2 = { x: 0, y: raggioConfineAnelloPianeti };
        const p1 = accorciaLinea(p2, el.position, accorciamento, false);

        var lineaB = OggettiSempliciRender.getLinea(p1,p2,coloreLinea);
        lineaB.rotateZ(THREE.MathUtils.degToRad(
          75-ascendente+15
          + elementiCelesti[nome][parametroDiRender]
          + degOffs
        ));
        group.add(lineaB);
      }

      const p2 = {x:0,y:diametroCerchioInterno/2};
      const p1 = accorciaLinea(p2, el.position, accorciamento, false);

      var lineaA = OggettiSempliciRender.getLinea(p1,p2,coloreLinea);
      lineaA.rotateZ(THREE.MathUtils.degToRad(
        75-ascendente+15
        + elementiCelesti[nome][parametroDiRender]
        + degOffs
      ));
      group.add(lineaA);

      el.translateY(-raggioEclittica);
      var elDegDiRender = 75-ascendente+15 + elementiCelesti[nome][parametroDiRender] + degOffs;
      el.rotateZ(THREE.MathUtils.degToRad(elDegDiRender));
      el.translateY(raggioEclittica);
      el.rotation.z = 0;
      el.userData['chartPlanet'] = { layer: interactionLayer, name: nome };
      // Retain the true rendered longitude direction, not the collision-shifted
      // glyph center. An aspect focus can then use the inner aspect circle.
      if (parametroDiRender === 'longitude') {
        el.userData['chartAspectAngle'] = THREE.MathUtils.degToRad(elDegDiRender);
        if (interactionLayer === 'transit') {
          // Exact original radius of the transit glyph ring, before
          // collision separation shifts the displayed symbol. This is
          // rendering metadata only, never a new ephemeris calculation.
          el.userData['chartTransitRingRadius'] = raggioEclittica;
        }
      }
      group.add( el );

      /*
      if(eventiMouse) {
        GestoreEventiMouse.gem.aggiungiOggetto(
          eventiMouse,
          el,
          {'id': nome, 'nome': nome, "info": elementiCelesti[nome], "object": el}
        );
      }*/

      //Dodecatemoria tutti
      if(elementiCelesti[nome]['dodecatemoria'] && opzioni.dodecatemore == 'tutti' && !calcolaPartiArabe) {
        var raggioEclitticaDodecatemore =
          (diametroCerchioEsterno/2 - diametroCerchioDodecatemori/2)/2 + diametroCerchioDodecatemori/2;

        var eld = await OggettiSempliciRender.getImg('simboli/elementi-celesti/'+opzioni.settaggi.skin_id+'/cerchio/'+nome+'.png',1,1,0.6);
        eld.scale.set(0.1,0.1,1);
        var dodecatemoreDegDiRender = 75-ascendente+15 + elementiCelesti[nome]['dodecatemoria']['longitude'] + degOffs;
        eld.rotateZ(THREE.MathUtils.degToRad(dodecatemoreDegDiRender));
        eld.translateY(raggioEclitticaDodecatemore);
        eld.rotation.z = 0;

        group.add(eld);
/*
        if(eventiMouseDodecatemori) {
          GestoreEventiMouse.gem.aggiungiOggetto(
            eventiMouseDodecatemori[k],
            eld,
            {'id': nome+'-dodecatemore', 'nome': nome, "info": elementiCelesti[nome].dodecatemoria, "object": el}
          );
        }*/

      }
      // Dodecatemoria singola
      else if(elementiCelesti[nome]['dodecatemoria'] && opzioni.dodecatemore == nome && !calcolaPartiArabe) {
        var eld = await OggettiSempliciRender.getImg(elRef,875,605,1/875,australInversion);
        var dodecatemoreDegDiRender = 75-ascendente+15 + elementiCelesti[nome]['dodecatemoria']['longitude'];

        eld.scale.set(0.23*simboliScale,0.23*simboliScale,1);
        eld.rotateZ(THREE.MathUtils.degToRad(
          dodecatemoreDegDiRender + degOffs
        ));
        eld.translateY(raggioEclittica);
        eld.rotation.z = 0;

        group.add(eld);
/*
        if(eventiMouseDodecatemori) {
          GestoreEventiMouse.gem.aggiungiOggetto(
            eventiMouseDodecatemori[k],
            eld,
            {'id': nome+'-dodecatemore', 'nome': nome, "info": elementiCelesti[nome].dodecatemoria, "object": el}
          );
        }*/

        //animazione
        var tl = gsap.timeline({repeat: -1, repeatDelay: 0, yoyo: true});
        registerSceneAnimation(group, tl);
        tl.to(eld.material, {opacity: 0});

        var frecciaAdArco = OggettiSempliciRender.lanciaFrecciaAdArco(
          elDegDiRender,dodecatemoreDegDiRender,
          Colori.elementiCelesti[nome],"#aaa",
          diametroCerchioInterno,diametroCerchioEsterno
        );
        group.add(frecciaAdArco);
      }
    };
/*
    if(eventiMouse) {
      var eventiConcat = eventiMouse.concat(eventiMouseDodecatemori);
      for(var k in eventiConcat) {
        GestoreEventiMouse.gem.getObjectMovedEventEmitter(eventiConcat[k]).emit();
      }
    }*/

    return group;
    } catch (error) {
      // The group is not returned to the service when construction fails, so
      // its animations must be stopped here rather than during scene disposal.
      stopSceneAnimations(group);
      throw error;
    }
  }

  public static ciclo(pianeti) {
    pianeti.sort(function (a, b) {
      return a.deg - b.deg;
    });
    for(var i=1; i<pianeti.length; i++) {
      var a = pianeti[i-1].deg;
      var b = pianeti[i].deg;

      if(b-a < ElementiCelestiRender.offsetMinimoPianeti) {
        b += ElementiCelestiRender.offsetMinimoPianeti - (b-a);
      }
      pianeti[i].deg = b;
    }

    for(var i=0; i<pianeti.length; i++) {
      pianeti[i].deg = (pianeti[i].deg + 180) %360;
    }

    return pianeti;
  }

  public static getRenderPosPianeti(elementiCelesti,parametroDiRender) {

    //serve un array, elementiCelesti è un oggetto
    var pianetiOrdineDiRiferimento = [];
    for(var nome in elementiCelesti) {
      var p = {
        'key': nome,
        'deg': elementiCelesti[nome][parametroDiRender]%360
      };
      pianetiOrdineDiRiferimento.push(p);
    }
    var pianeti = JSON.parse(JSON.stringify(pianetiOrdineDiRiferimento));

    pianeti = this.ciclo(pianeti);
    pianeti = this.ciclo(pianeti);
/*
    pianetiOrdineDiRiferimento.forEach(p => p.deg = ((Number(p.deg) % 360) + 360) % 360);
    pianetiOrdineDiRiferimento.sort(function (a, b) {
      return Number(a.deg) - Number(b.deg);
    });

    console.log("inizio",pianeti);
    pianeti.forEach(p => p.deg = ((Number(p.deg) % 360) + 360) % 360);

    pianeti.sort((a, b) => a.deg - b.deg);

    console.log("ordinati", pianeti.map(p => `${p.key}: ${p.deg.toFixed(2)}`));

    //  pianetiOrdineDiRiferimento e pianeti dovrebbero avere la stessa sequenza di pianeti,
    
    var inizioJ=0;
    while(pianeti[inizioJ].key != pianetiOrdineDiRiferimento[0].key) {
      inizioJ++;
    }
    console.log('inizioJ',inizioJ);
    for(let i=0; i<pianetiOrdineDiRiferimento.length; i++) {
      let j = (inizioJ+i)%pianeti.length;
      let pi = pianetiOrdineDiRiferimento[i];
      let pj = pianeti[j];
      //console.log(pianeti,pi,pj);
      if(pi.key != pj.key){
        let jk = j;
        do {
          jk = (jk+1)%pianeti.length;
        } while(pianeti[jk].key != pi.key);
        
        //console.log('sostituzione', pianeti[jk],pianeti[j]);
        let tmp = pianeti[jk].key;
        pianeti[jk].key = pianeti[j].key;
        pianeti[j].key = tmp;

        tmp = pianeti[jk].deg;
        pianeti[jk].deg = pianeti[j].deg;
        pianeti[j].deg = tmp;
      }
    }
    console.log(pianeti,pianetiOrdineDiRiferimento);
*/
    var pianetiRet = {};
    for(var i=0; i<pianeti.length; i++) {
      pianetiRet[pianeti[i]['key']]={};
      pianetiRet[pianeti[i]['key']][parametroDiRender] = pianeti[i].deg;
    }

    return pianetiRet;
  }

  public static initElementoCeleste(nome,parametroDiRender,deg) {
    var el = {
      "name": nome,
      "longitudeSpeed":0,
      "longitudeSign": Math.trunc(deg/30),
      "longitude30": deg%30
    };
    el[parametroDiRender] = deg;
    return el;
  }

  public static getElementiCelesti(temaRender, opzioni, usaAssi, parametroDiRender='longitude',calcolaPartiArabe=false,offsDirezioniSemplificate=0) {
    var elementiCelesti = {};

    var planets = JSON.parse(JSON.stringify(temaRender.planets));

    var as = 0;
    var mc = 0;
    if(
      !(opzioni.mostraEffemeridi && opzioni.effemeridiGrafiche)
      && temaRender.houses && temaRender.houses[opzioni.settaggi.domificazione_selezionata]
    ) {
      as = temaRender.houses[opzioni.settaggi.domificazione_selezionata].ascendant;
      mc = temaRender.houses[opzioni.settaggi.domificazione_selezionata].mc;
    } else {
      //usaAssi = false;
    }
    var ds = (as+180)%360;
    var ic = (mc+180)%360;

    // Calcolo Parti Arabe
    if(calcolaPartiArabe) {
      if(opzioni.partiArabe.modalita=='crea') {
        var lngDestinazione;

        //se non è una casa (è un asse)
        if(!isFinite(parseInt(opzioni.partiArabe.elDestinazione))) {
          //asse
          lngDestinazione =
            temaRender.houses[opzioni.settaggi.domificazione_selezionata][opzioni.partiArabe.elDestinazione]
          ;
        } else {
          //casa
          lngDestinazione =
            temaRender.houses[opzioni.settaggi.domificazione_selezionata].house[opzioni.partiArabe.elDestinazione]
          ;
        }

        var degOffsPartiArabe = lngDestinazione - planets[opzioni.partiArabe.nomeElCeleste].longitude;
        for(var p in planets){
          planets[p].longitude = (planets[p].longitude+degOffsPartiArabe)%360;
        }
      } else {
        //da formula abumashar o essenziali
        var formula = undefined;
        if(
          opzioni.partiArabe.formulaSelezionataIndex != undefined
          && opzioni.partiArabe.modalita == 'essenziali'
        ) {
          formula = temaRender.partiArabe.essenziali[opzioni.partiArabe.formulaSelezionataIndex];
        } else if(
          opzioni.partiArabe.formulaSelezionataIndex != undefined
          &&  opzioni.partiArabe.formulaAbumasharCasaSelezionata != undefined
          && opzioni.partiArabe.modalita == 'abumashar'
        ) {
          formula = temaRender.partiArabe.abumashar
            [opzioni.partiArabe.formulaAbumasharCasaSelezionata]
            [opzioni.partiArabe.formulaSelezionataIndex]
          ;
        }
        //render
        if(formula) {
          formula.lngOffs;
          formula.nomePianetaHighlight;

          //ad ogni pianeta applico l'offset in lng
          for(var p in planets){
            planets[p].longitude = (planets[p].longitude+formula.lngOffs)%360;
          }
        }
      }
    }

    // Selezione Elementi Celesti
    for(let nome in opzioni.settaggi.elementi_celesti) {
      var elOptAtt;

      if(opzioni.mostraEffemeridi && opzioni.effemeridiGrafiche) {
        elOptAtt = opzioni.effemeridiGrafichePianetiAttivi[nome];
      } else {
        elOptAtt = opzioni.settaggi.elementi_celesti[nome].att;
      }

      var el = undefined;
      if(
        elOptAtt
        ||
        (
          (
            opzioni.kleros == 'estrapola-tutto'
          || opzioni.kleros == 'estrapola-4luminarie'
          || opzioni.kleros == 'visualizza sorti'
          )
          && (
             nome == "Tyche"
          || nome == "Daimon"
          || nome == "Basis"
          || nome == "Ananke"
          )
          ||
          (
            opzioni.kleros == 'estrapola-tutto'
          || opzioni.kleros == 'estrapola-5planetarie'
          || opzioni.kleros == 'visualizza sorti'
          )
          && (
            nome == "Eros"
          || nome == "Hermes"
          || nome == "Tolma"
          || nome == "Nike"
          || nome == "Nemesi"
          )
        )
        ||
        // se assi esclusi vengono rimossi seguentementi, utili ora per trans-saturnini
        nome == "AS" || nome == "DS" || nome == "MC" || nome == "IC"
      ) {
        switch(nome) {
          case 'AS':
            if(temaRender.houses && Object.keys(temaRender.houses).length)
              el = ElementiCelestiRender.initElementoCeleste('AS',parametroDiRender,as);
            break;
          case 'DS':
            if(temaRender.houses && Object.keys(temaRender.houses).length)
              el = ElementiCelestiRender.initElementoCeleste('DS',parametroDiRender,ds);
            break;
          case 'MC':
            if(temaRender.houses && Object.keys(temaRender.houses).length)
              el = ElementiCelestiRender.initElementoCeleste('MC',parametroDiRender,mc);
            break;
          case 'IC':
            if(temaRender.houses && Object.keys(temaRender.houses).length)
              el = ElementiCelestiRender.initElementoCeleste('IC',parametroDiRender,ic);
            break;
          case 'vertex':
            if(temaRender.houses && Object.keys(temaRender.houses).length)
              el = ElementiCelestiRender.initElementoCeleste('vertex',parametroDiRender,temaRender.houses[opzioni.settaggi.domificazione_selezionata].vertex);
            break;
          default:
            el = planets[nome];
        }
        if(el)
          elementiCelesti[nome]=el;
      }
    }

    if(
      opzioni.settaggi.transaturniniSeCongiunti
      && !(opzioni.mostraEffemeridi && opzioni.effemeridiGrafiche)
      && !calcolaPartiArabe
    ) {
      var ts = ['Uranus','Neptune','Pluto'];
      for(let i in ts) {
        var nome = ts[i];
        var elOptAtt = opzioni.settaggi.elementi_celesti[nome].att;
        if(
          !elOptAtt
          && (
            nome == "Uranus"
            || nome == "Neptune"
            || nome == 'Pluto'
          )
        ) {
          for(let p in elementiCelesti) {
            if(nome != p && elementiCelesti[p] && planets[nome]) {
              if(
                    elementiCelesti[p].longitude < planets[nome].longitude + opzioni.settaggi.elementi_celesti[nome].orb
                &&  elementiCelesti[p].longitude > planets[nome].longitude - opzioni.settaggi.elementi_celesti[nome].orb
                ||  elementiCelesti[p].longitude - 360 < planets[nome].longitude + opzioni.settaggi.elementi_celesti[nome].orb
                &&  elementiCelesti[p].longitude - 360 > planets[nome].longitude - opzioni.settaggi.elementi_celesti[nome].orb
                ||  elementiCelesti[p].longitude + 360 < planets[nome].longitude + opzioni.settaggi.elementi_celesti[nome].orb
                &&  elementiCelesti[p].longitude + 360 > planets[nome].longitude - opzioni.settaggi.elementi_celesti[nome].orb
              ) {
                elementiCelesti[nome]=planets[nome];
                break;
              }
            }
          }
        }
      }
    }

    if((!usaAssi || opzioni.mostraEffemeridi && opzioni.effemeridiGrafiche) && !opzioni.mostraMonomeri) {
      var assi = ['AS','DS','MC','IC'];
      for(var i=0; i<assi.length; i++) {
        var asse = assi[i];
        if(!opzioni.settaggi.elementi_celesti[asse].att || opzioni.mostraEffemeridi && opzioni.effemeridiGrafiche) {
          delete elementiCelesti[asse];
        }
      }
    }

    if(offsDirezioniSemplificate) {
      for(var nomeElemento in elementiCelesti) {
        var deg = elementiCelesti[nomeElemento][parametroDiRender];
        switch(nomeElemento) {
          case 'AS':
          case 'DS':
          case 'MC':
          case 'IC': //deg += offsDirezioniSemplificate*2; break;
          default: deg += offsDirezioniSemplificate;

        }
        elementiCelesti[nomeElemento] =
          ElementiCelestiRender.initElementoCeleste(
            nomeElemento,
            parametroDiRender,
            deg
          )
        ;
      }
    }

    return elementiCelesti;
  }
}
