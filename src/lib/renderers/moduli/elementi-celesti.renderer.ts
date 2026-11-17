import * as THREE from 'three';
import gsap from 'gsap';
import {OggettiSempliciRender} from '../oggetti-semplici.renderer';

import {Colori} from '../_colori.config';
import { SkinManager } from '../@skin-manager';
import { registerSceneAnimation, stopSceneAnimations } from '../scene-animations';
import { normalizeDegree, layoutPlanetSymbols } from './planet-symbol-layout';


export class ElementiCelestiRender {

  private static pointOnRing(degrees: number, radius: number): THREE.Vector2 {
    const angle = THREE.MathUtils.degToRad(degrees);
    return new THREE.Vector2(-Math.sin(angle) * radius, Math.cos(angle) * radius);
  }

  private static makeDegreeLabel(longitude: number, color: string, size: number, compact: boolean): THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial> {
    const canvas = document.createElement('canvas');
    canvas.width = 180;
    canvas.height = 112;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Impossibile creare le etichette dei gradi');
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = color;
    const arcseconds = Math.round((normalizeDegree(longitude) % 30) * 3600) % (30 * 3600);
    const degree = Math.floor(arcseconds / 3600);
    const seconds = String(arcseconds % 60).padStart(2, '0');
    context.font = 'bold 81px Arial, sans-serif';
    context.textAlign = 'right';
    context.textBaseline = 'middle';
    context.fillText(`${degree}`, 98, 58);
    // Two small arcsecond digits replace the degree sign. The label keeps the
    // exact, unshifted longitude even if its visual position was separated.
    context.font = 'bold 62px Arial, sans-serif';
    context.textAlign = 'left';
    context.fillText(seconds, 104, 51);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false });
    return new THREE.Mesh(new THREE.PlaneGeometry(
      (compact ? 0.12 : 0.17) * size, (compact ? 0.06 : 0.10) * size,
    ), material);
  }

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
    isElementiSinastria=false
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

    var raggioConfineAnelloPianeti = diametroCerchioEsterno/2;

    var raggioEclittica = (raggioConfineAnelloPianeti - diametroCerchioInterno/2)/2 + diametroCerchioInterno/2;
    const mostraGradi = opzioni.mostraGradiElementiCelesti !== false;
    const innerRingRadius = diametroCerchioInterno / 2;
    // Transit/synastry rings may be considerably thinner. Preserve their
    // compact tangential labels instead of squeezing symbols past the rim.
    const hasWidePlanetBand = raggioConfineAnelloPianeti - innerRingRadius >= 0.45;
    const elementiCelestiRenderPos = this.getRenderPosPianeti(
      elementiCelesti, parametroDiRender,
      // The wider celestial band offers many radial tracks near the houses;
      // planet symbols keep a separate quiet margin from the zodiac signs.
      hasWidePlanetBand ? innerRingRadius + 0.055 * simboliScale : innerRingRadius,
      hasWidePlanetBand ? raggioConfineAnelloPianeti - 0.085 * simboliScale : raggioConfineAnelloPianeti,
      simboliScale, mostraGradi, 90 - ascendente + degOffs, hasWidePlanetBand,
    );

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
      const glyphScale = elementiCelestiRenderPos[nome].scale ?? 1;
      el.scale.set(0.22 * simboliScale * glyphScale, 0.22 * simboliScale * glyphScale, 1);
      const trueDegree = elementiCelesti[nome][parametroDiRender];
      const elDegDiRender = 90 - ascendente + trueDegree + degOffs;
      const glyphDegree = 90 - ascendente + elementiCelestiRenderPos[nome][parametroDiRender] + degOffs;
      const glyphRadius = elementiCelestiRenderPos[nome].radius ?? raggioEclittica;
      const glyphPosition = this.pointOnRing(glyphDegree, glyphRadius);
      el.position.set(glyphPosition.x, glyphPosition.y, 0);

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
        cerchietto.position.set(glyphPosition.x, glyphPosition.y, 0);
        var lineaCerchietto = OggettiSempliciRender.getLinea(
          this.pointOnRing(elDegDiRender, diametroCerchioInterno / 2), glyphPosition, '#888');
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

      // Every connector starts on the *true* astronomical degree; only its
      // symbol end may move into another radial lane to avoid a conjunction.
      const glyphHalfHeight = 0.22 * simboliScale * glyphScale * 605 / 875 / 2;
      if(lineaSuCerchioEsterno) {
        const p2 = this.pointOnRing(elDegDiRender, raggioConfineAnelloPianeti);
        const p1 = this.pointOnRing(glyphDegree, glyphRadius + glyphHalfHeight + 0.012);
        var lineaB = OggettiSempliciRender.getLinea(p1,p2,coloreLinea);
        group.add(lineaB);
      }

      // The inward spoke to the houses is deliberately omitted. The outer
      // tick still anchors the symbol to its exact astronomical longitude.

      group.add( el );
      if (mostraGradi) {
        const label = this.makeDegreeLabel(trueDegree, coloreSimboli,
          simboliScale * glyphScale, !hasWidePlanetBand);
        const tangentAngle = THREE.MathUtils.degToRad(glyphDegree);
        const labelOffset = (hasWidePlanetBand ? 0.205 : 0.17) * simboliScale * glyphScale;
        label.position.set(
          glyphPosition.x - Math.cos(tangentAngle) * labelOffset,
          glyphPosition.y - Math.sin(tangentAngle) * labelOffset, 0.002,
        );
        label.material.opacity = el.material.opacity;
        group.add(label);
      }

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

  public static getRenderPosPianeti(
    elementiCelesti, parametroDiRender,
    raggioInterno = 1.4, raggioEsterno = 1.8,
    simboliScale = 1, mostraGradi = true, chartRotation = 0, largeDegreeLabels = false,
  ) {
    const longitudes: Record<string, number> = {};
    for (const nome in elementiCelesti) longitudes[nome] = elementiCelesti[nome][parametroDiRender];
    const positions = layoutPlanetSymbols(
      longitudes, raggioInterno, raggioEsterno,
      0.22 * simboliScale, 0.22 * simboliScale * 605 / 875, mostraGradi, chartRotation,
      raggioEsterno - raggioInterno > 0.06 ? {
        maxAngularDisplacement: 3,
        labelWidth: (largeDegreeLabels ? 0.17 : 0.12) * simboliScale,
        labelHeight: (largeDegreeLabels ? 0.10 : 0.06) * simboliScale,
        labelTangentOffset: (largeDegreeLabels ? 0.205 : 0.17) * simboliScale,
      } : undefined,
    );
    const result = {};
    for (const nome in positions) {
      result[nome] = {
        [parametroDiRender]: positions[nome].displayDegree,
        radius: positions[nome].radius,
        scale: positions[nome].scale,
      };
    }
    return result;
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
