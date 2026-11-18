import * as THREE from 'three';
import { OggettiSempliciRender } from '../oggetti-semplici.renderer';
import { SkinManager } from '../@skin-manager';
import { Colori } from '../_colori.config';

import {StatoCartaAstrale} from '../@carta-astrale/carta-astrale.renderer'

export class SegniRender {

  /** One real-degree tick per degree, at the outside rim of the zodiac.
   * This is drawn only while transits are enabled; geometry is skin-independent. */
  public static creaScalaGradi(degOffsAscendente: number, raggioEsterno: number, colore: string): THREE.LineSegments {
    const points: THREE.Vector3[] = [];
    for (let degree = 0; degree < 360; degree++) {
      const angle = THREE.MathUtils.degToRad(degree + degOffsAscendente);
      const length = degree % 10 === 0 ? 0.080 : degree % 5 === 0 ? 0.053 : 0.024;
      for (const radius of [raggioEsterno + 0.006, raggioEsterno + length]) {
        points.push(new THREE.Vector3(-Math.sin(angle) * radius, Math.cos(angle) * radius, 0.009));
      }
    }
    const ticks = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(points),
      new THREE.LineBasicMaterial({ color: colore, transparent: true, opacity: 0.88 }));
    ticks.name = 'zodiac-degree-scale';
    ticks.userData.tickCount = 360;
    return ticks;
  }

  public static sequenzaDecani = [
    'Mars', 'Sun', 'Venus', 'Mercury', 'Moon', 'Saturn', 'Jupiter'
  ];

  private static calcolaDegOffsAscendente(asc: number) {
    return 75 - asc + 15;
  }

    // -------------------------
    // Decani
    // -------------------------
    public static async getDecadi(degOffsAscendente,simboliScale,diametroCerchioInterno,diametroCerchioEsterno,australInversion,opzioni): Promise<any> {
        var group = new THREE.Group();
        
        const coloreSimboli = SkinManager.skins[opzioni.settaggi.skin_id].anelloSegni.coloreSimboli;

        for(var i=0; i<12; i++) {
          for(var j=0; j<3; j++) {
            let colore = coloreSimboli;
            if(coloreSimboli == 'elementi') {
                colore = SkinManager.skins[opzioni.settaggi.skin_id].elementi[i%4];
            }
            //let imgFolder = coloreImgFolder ? coloreImgFolder + '/' : '';
            const segno = await OggettiSempliciRender.getImg(
                `simboli-bianchi/segni/${String((i + 4*j)%12 + 1).padStart(2, '0')}.png`,
                100, 69, 1 / 69, australInversion, colore
            );
    
            segno.scale.set(0.14*simboliScale,0.14*simboliScale,1);
            segno.rotateZ(THREE.MathUtils.degToRad(i*30+j*10+5 + degOffsAscendente));
            segno.translateY(
              diametroCerchioInterno/2
              + (diametroCerchioEsterno/2 - diametroCerchioInterno/2)/2,
            );
            segno.rotation.z = 0;
            segno.userData.decadeSign = (i + 4*j)%12;
            segno.userData.decadeIndex = i*3+j;
    
            group.add(segno);
          }
        }
    
        return group;
      }

    // -------------------------
    // Decadi
    // -------------------------
    public static async getDecani(degOffsAscendente,simboliScale,diametroCerchioInterno,diametroCerchioEsterno,australInversion,opzioni): Promise<any> {
        var group = new THREE.Group();

        for(var i=0; i<36; i++) {
            var semiArco = OggettiSempliciRender.getSemiArcoGrosso(
                i*10 + degOffsAscendente + 90, (i+1)*10 + degOffsAscendente + 90,
                diametroCerchioInterno/2,
                diametroCerchioEsterno/2,
                Colori.elementiCelesti[SegniRender.sequenzaDecani[i % SegniRender.sequenzaDecani.length]]
            );


            group.add(semiArco);
        }
        
        for(var i=0; i<12; i++) {
            for(var j=0; j<3; j++) {
                var colore = 'nero';
                //if((i*3+j)%7 == 3 || (i*3+j)%7 == 4)
                //  colore = 'nero';
                var pianeta = await OggettiSempliciRender.getImg(
                    'simboli-bianchi/elementi-celesti/'
                    +SegniRender.sequenzaDecani[(i*3+j)%7]+'.png',
                    875,605,1/875,
                    australInversion, 'black'
                );

                pianeta.scale.set(0.14*simboliScale,0.14*simboliScale,1);
                pianeta.rotateZ(THREE.MathUtils.degToRad(i*30+j*10+5 + degOffsAscendente));
                pianeta.translateY(
                diametroCerchioInterno/2
                + (diametroCerchioEsterno/2 - diametroCerchioInterno/2)/2,
                );
                pianeta.rotation.z = 0;

                group.add(pianeta);
            }
        }


        return group;
    }



  // -------------------------
  // Anello Segni principale
  // -------------------------
    public static async getAnelloSegni(asc: number, simboliScale, diametroCerchioInterno, diametroCerchioEsterno, australInversion, mostraDecani, mostraDecadi, opzioni): Promise<THREE.Group> {
        const group = new THREE.Group();
        

        const degOffsAscendente = 75 - asc + 15;

        const { coloreLinea, coloreSimboli, coloreTexture, texture, coloreImgFolder } =
            SkinManager.skins[opzioni.settaggi.skin_id].anelloSegni;
        const coloriSettori = (SkinManager.skins[opzioni.settaggi.skin_id].anelloSegni as {
          coloriSettori?: readonly string[];
        }).coloriSettori;

        // Semi archi dei segni
        if (coloriSettori?.length === 4) {
            for (let i = 0; i < 12; i++) {
                // EllipseCurve measures angles from +X, while the natal
                // wheel's zodiac positions measure them from +Y.
                const settore = OggettiSempliciRender.getSemiArcoGrosso(
                    i * 30 + degOffsAscendente + 90,
                    (i + 1) * 30 + degOffsAscendente + 90,
                    diametroCerchioInterno / 2,
                    diametroCerchioEsterno / 2,
                    coloriSettori[i % 4],
                );
                settore.position.z = -0.003 * (australInversion ? -1 : 1);
                settore.userData.zodiacSector = i;
                group.add(settore);
            }
            group.add(OggettiSempliciRender.getCerchio(diametroCerchioEsterno / 2, coloreLinea));
        } else if(texture) {
            for (let i = 0; i < 12; i++) {
                const arco = OggettiSempliciRender.getSemiArcoGrosso(
                    i * 30 + degOffsAscendente,
                    i * 30 + 30 + degOffsAscendente,
                    diametroCerchioInterno / 2,
                    diametroCerchioEsterno / 2,
                    coloreTexture,
                    texture
                );
                arco.position.z = -0.001 * (australInversion?-1:1);
                group.add(arco);
            }
        } else {
            group.add(OggettiSempliciRender.getCerchio(diametroCerchioEsterno / 2, coloreLinea));
        }

        // A clean natal wheel has no external degree ruler. The outer scale
        // belongs to the transit layout and is shared by every skin.
        if (opzioni.mostraTransiti === true) {
            group.add(SegniRender.creaScalaGradi(degOffsAscendente,
              diametroCerchioEsterno / 2, coloreLinea));
        }
        
        // Linee principali e secondarie
        // Linee principali (ogni 30°), secondarie (ogni 10°) e terziarie (ogni 5°)
        
        for (let i = 0; i < 72; i++) {
            // The intermediate five-degree marks clutter the decade divisions.
            if (opzioni.mostraDecadi && i % 2 !== 0) continue;
            const angolo = i * 5 + degOffsAscendente;
            let lunghezza = 0;

            // Se è una linea principale (ogni 30°)
            if (i % 6 === 0) {
                lunghezza = diametroCerchioEsterno / 2 - diametroCerchioInterno / 2;
            }
            // Se è una linea secondaria (ogni 10°)
            else if (i % 2 === 0) {
                lunghezza = 0.1;
            }
            // Altrimenti è una terziaria (ogni 5°)
            else {
                lunghezza = 0.05;
            }

            const linea = OggettiSempliciRender.getLinea(
                { x: 0, y: diametroCerchioInterno / 2 },
                { x: 0, y: diametroCerchioInterno / 2 + lunghezza },
                coloreLinea
            );

            linea.rotateZ(THREE.MathUtils.degToRad(angolo));
            linea.userData.zodiacTickDegree = i * 5;
            group.add(linea);
        }

        
        // Simboli dei segni
        for (let i = 0; i < 12; i++) {
            let colore = coloreSimboli;
            if(coloreSimboli == 'elementi') {
                colore = SkinManager.skins[opzioni.settaggi.skin_id].elementi[i%4];
            }
            //let imgFolder = coloreImgFolder ? coloreImgFolder + '/' : '';
            const segno = await OggettiSempliciRender.getImg(
                `simboli-bianchi/segni/${String(i + 1).padStart(2, '0')}.png`,
                100, 69, 1 / 69, australInversion, colore
            );
            const subdivisions = !!opzioni.mostraDecani || !!opzioni.mostraDecadi;
            const both = !!opzioni.mostraDecani && !!opzioni.mostraDecadi;
            const size = subdivisions ? (both ? 0.105 : 0.12) : 0.16;
            segno.scale.set(size, size, 1);
            segno.rotateZ(THREE.MathUtils.degToRad(i * 30 + 15 + degOffsAscendente));
            // Centre the glyph within the actual zodiac band. Previously a
            // fixed fraction of the outer diameter pulled it toward planets.
            const innerSignBand = diametroCerchioInterno + (diametroCerchioEsterno - diametroCerchioInterno) *
                (subdivisions ? (both ? 0.5 : 0.25) : 0);
            segno.translateY((innerSignBand + diametroCerchioEsterno) / 4);
            segno.rotation.z = 0;
            segno.userData.zodiacMainSign = i;
            group.add(segno);
        }

        if (opzioni.mostraDecani) {
            const decani = await SegniRender.getDecani(
                degOffsAscendente,
                simboliScale * 0.55,
                diametroCerchioInterno,
                diametroCerchioInterno + (diametroCerchioEsterno-diametroCerchioInterno)/4,
                australInversion,
                opzioni
            );
            group.add(decani);
        }

        if (opzioni.mostraDecadi) {
            const decadi = await SegniRender.getDecadi(
                degOffsAscendente,
                simboliScale * (opzioni.mostraDecani ? 0.42 : 0.55),
                diametroCerchioInterno + (opzioni.mostraDecani ? (diametroCerchioEsterno-diametroCerchioInterno)/4 : 0),
                diametroCerchioInterno + (opzioni.mostraDecani ? (diametroCerchioEsterno-diametroCerchioInterno)/2 : (diametroCerchioEsterno-diametroCerchioInterno)/4),
                australInversion,
                opzioni
            );
            group.add(decadi);
        }

        return group;
    }

    // -------------------------
    // Anello Segni Sinastria
    // -------------------------
    public static async getAnelloSegniSinastria(ascendente: number, diametroCerchioInterno, diametroCerchioEsterno, australInversion, stato:StatoCartaAstrale): Promise<THREE.Group> {
        const group = new THREE.Group();

        const degOffsAscendente = 75 - ascendente + 15;

        // Sfondo interno
        /*
        const img = await OggettiSempliciRender.getSfondoQuadrato(
            `grafici/${stato.opzioni.settaggi.skin_id}/sinastria-segni-interno.png`,
            diametroCerchioEsterno
        );
        img.rotateZ(THREE.MathUtils.degToRad(degOffsAscendente));
        group.add(img);*/

        // Divisioni dei segni
        /*
        const simboliScale = stato.diametri.simboliScaleAnelloSegni || 0.1;
        for (let i = 0; i < 12; i++) {
            const segno = await OggettiSempliciRender.getImg(
                `simboli/segni/${stato.opzioni.settaggi.skin_id}/785x610/${String(i + 1).padStart(2, '0')}.png`,
                785, 610, 1 / 785, false // australInversion opzionale
            );
            segno.scale.set(simboliScale, simboliScale, 1);
            segno.rotateZ(THREE.MathUtils.degToRad(i * 30 + 15 + degOffsAscendente));
            segno.translateY(diametroCerchioEsterno / 2 - diametroCerchioEsterno / 16);
            segno.rotation.z = 0;

            group.add(segno);
        }*/

        
        const { coloreLinea, coloreSimboli, coloreTexture, texture, coloreImgFolder } =
            SkinManager.skins[stato.opzioni.settaggi.skin_id].anelloSegni;
        const coloriSettori = (SkinManager.skins[stato.opzioni.settaggi.skin_id].anelloSegni as {
          coloriSettori?: readonly string[];
        }).coloriSettori;

        // Semi archi dei segni
        if (coloriSettori?.length === 4) {
            for (let i = 0; i < 12; i++) {
                const settore = OggettiSempliciRender.getSemiArcoGrosso(
                    i * 30 + degOffsAscendente + 90,
                    (i + 1) * 30 + degOffsAscendente + 90,
                    diametroCerchioInterno / 2,
                    diametroCerchioEsterno / 2,
                    coloriSettori[i % 4],
                );
                settore.position.z = -0.003 * (australInversion ? -1 : 1);
                settore.userData.zodiacSector = i;
                group.add(settore);
            }
            group.add(OggettiSempliciRender.getCerchio(diametroCerchioEsterno / 2, coloreLinea));
        } else if(texture) {
            for (let i = 0; i < 12; i++) {
                const arco = OggettiSempliciRender.getSemiArcoGrosso(
                    i * 30 + degOffsAscendente,
                    i * 30 + 30 + degOffsAscendente,
                    diametroCerchioInterno / 2,
                    diametroCerchioEsterno / 2,
                    coloreTexture,
                    texture
                );
                arco.position.z = -0.001 * (australInversion?-1:1);
                group.add(arco);
            }
        } else {
            group.add(OggettiSempliciRender.getCerchio(diametroCerchioEsterno / 2, coloreLinea));
        }

        // Sinastry by itself never enables the transit degree ruler.
        if (stato.opzioni.mostraTransiti === true) {
            group.add(SegniRender.creaScalaGradi(degOffsAscendente,
              diametroCerchioEsterno / 2, coloreLinea));
        }
        
        // Linee principali e secondarie
        // Linee principali (ogni 30°), secondarie (ogni 10°) e terziarie (ogni 5°)
        
        for (let i = 0; i < 72; i++) {
            const angolo = i * 5 + degOffsAscendente;
            let lunghezza = 0;

            // Se è una linea principale (ogni 30°)
            if (i % 6 === 0) {
                lunghezza = diametroCerchioEsterno / 2 - diametroCerchioInterno / 2;
            }

            const linea = OggettiSempliciRender.getLinea(
                { x: 0, y: diametroCerchioInterno / 2 },
                { x: 0, y: diametroCerchioInterno / 2 + lunghezza },
                coloreLinea
            );

            linea.rotateZ(THREE.MathUtils.degToRad(angolo));
            group.add(linea);
        }

        
        // Simboli dei segni
        for (let i = 0; i < 12; i++) {
            let colore = coloreSimboli;
            if(coloreSimboli == 'elementi') {
                colore = SkinManager.skins[stato.opzioni.settaggi.skin_id].elementi[i%4];
            }
            //let imgFolder = coloreImgFolder ? coloreImgFolder + '/' : '';
            const segno = await OggettiSempliciRender.getImg(
                `simboli-bianchi/segni/${String(i + 1).padStart(2, '0')}.png`,
                100, 69, 1 / 69, false, colore
            );
            segno.scale.set(0.08, 0.08, 1);
            segno.rotateZ(THREE.MathUtils.degToRad(i * 30 + 15 + degOffsAscendente));
            segno.translateY(diametroCerchioEsterno / 2 - diametroCerchioEsterno / 21);
            segno.rotation.z = 0;
            group.add(segno);
        }

        return group;
    }

}
