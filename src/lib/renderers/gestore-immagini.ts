import { SkinManager } from './@skin-manager';
import * as THREE from 'three';

export class GestoreImmagini {
  public static assetsBase = "";
  private static pool = new Map<string, THREE.Texture>();

  public static getImg(ref: string): THREE.Texture {/*
    if (!this.pool.has(ref)) {
      const texture = new THREE.TextureLoader().load(ref);
      this.pool.set(ref, texture);
    }
    return this.pool.get(ref)!;*/
    //console.log(this.assetsBase + ref);
    return new THREE.TextureLoader().load(this.assetsBase + ref);
  }

  public static async loadAsync(ref: string): Promise<THREE.Texture> {
    /*
    if (this.pool.has(ref)) return this.pool.get(ref)!;
    
    const loader = new THREE.TextureLoader();
    const texture = await new Promise<THREE.Texture>((resolve, reject) => {
      loader.load(ref, resolve, undefined, reject);
    });
    
    this.pool.set(ref, texture);
    return texture;*/
    
    const loader = new THREE.TextureLoader();
    const promise = new Promise<THREE.Texture>((resolve, reject) => {
      //console.log(this.assetsBase + ref);
      loader.load(this.assetsBase + ref, resolve, undefined, reject);
    });
    return promise;
  }


  public static preload(ref: string) {
    const ref_full = this.assetsBase + ref;

    if (!this.pool.has(ref_full)) {
      const texture = new THREE.TextureLoader().load(ref_full);
      this.pool.set(ref_full, texture);
    }
  }

  public static cleanCache() {
    for (const texture of this.pool.values()) texture.dispose();
    this.pool.clear();
  }

  public static preloadImages(urls: string[]): Promise<void[]> {
    const promises = urls.map(
      (url) =>
        new Promise<void>((resolve, reject) => {
          const img = new Image();
          const ref_full = this.assetsBase + url;
          img.src = ref_full;
          img.onload = () => resolve();
          img.onerror = () => reject(`Errore caricando immagine: ${ref_full}`);
        })
    );
    return Promise.all(promises);
  }

  public static preloadAssetsGrafico(): Promise<void[]> {
    
    //console.log("Preload Assets Grafico");
    return this.preloadImages(
      this.urlsAssetsGrafico()
    );
  }

  public static urlsAssetsGrafico(): string[] {
    const preloadArr = [
        "/assets/img/risuonatore-solare-vetro-satinato.png"
      ].concat(
        this.getPreloadArrayTextures().concat(this.preloadArraySimboli)
      )
    ;
    return preloadArr;
  }

  public static getPreloadArrayTextures(): string[] {
    function collectTextures(obj): string[] {
      let textures:string[] = [];

      for (const key in obj) {
        if (!obj.hasOwnProperty(key)) continue;
        const value = obj[key];

        if (typeof value === "object" && value !== null) {
          // Se ha una chiave 'texture', la aggiungiamo
          if ("texture" in value) {
            if(value.texture){
              textures.push(value.texture);
            }
          }
          // Cerchiamo ricorsivamente dentro l’oggetto
          textures = textures.concat(collectTextures(value));
        }
      }

      return textures;
    }
    return collectTextures(SkinManager.skins);
  }
  
  public static preloadArraySimboli: string[] = [
    "/assets/img/simboli-bianchi/case/01.png",
    "/assets/img/simboli-bianchi/case/02.png",
    "/assets/img/simboli-bianchi/case/03.png",
    "/assets/img/simboli-bianchi/case/04.png",
    "/assets/img/simboli-bianchi/case/05.png",
    "/assets/img/simboli-bianchi/case/06.png",
    "/assets/img/simboli-bianchi/case/07.png",
    "/assets/img/simboli-bianchi/case/08.png",
    "/assets/img/simboli-bianchi/case/09.png",
    "/assets/img/simboli-bianchi/case/10.png",
    "/assets/img/simboli-bianchi/case/11.png",
    "/assets/img/simboli-bianchi/case/12.png",
    "/assets/img/simboli-bianchi/elementi/0.png",
    "/assets/img/simboli-bianchi/elementi/1.png",
    "/assets/img/simboli-bianchi/elementi/2.png",
    "/assets/img/simboli-bianchi/elementi/3.png",
    "/assets/img/simboli-bianchi/elementi-celesti/Ananke.png",
    "/assets/img/simboli-bianchi/elementi-celesti/AS.png",
    "/assets/img/simboli-bianchi/elementi-celesti/Basis.png",
    "/assets/img/simboli-bianchi/elementi-celesti/Chiron-r.png",
    "/assets/img/simboli-bianchi/elementi-celesti/Chiron.png",
    "/assets/img/simboli-bianchi/elementi-celesti/Daimon.png",
    "/assets/img/simboli-bianchi/elementi-celesti/DS.png",
    "/assets/img/simboli-bianchi/elementi-celesti/Eros.png",
    "/assets/img/simboli-bianchi/elementi-celesti/Hermes.png",
    "/assets/img/simboli-bianchi/elementi-celesti/IC.png",
    "/assets/img/simboli-bianchi/elementi-celesti/Infrarosso.png",
    "/assets/img/simboli-bianchi/elementi-celesti/Jupiter-r.png",
    "/assets/img/simboli-bianchi/elementi-celesti/Jupiter.png",
    "/assets/img/simboli-bianchi/elementi-celesti/Mars-r.png",
    "/assets/img/simboli-bianchi/elementi-celesti/Mars.png",
    "/assets/img/simboli-bianchi/elementi-celesti/MC.png",
    "/assets/img/simboli-bianchi/elementi-celesti/mean Apogee.png",
    "/assets/img/simboli-bianchi/elementi-celesti/mean Node Sud-r.png",
    "/assets/img/simboli-bianchi/elementi-celesti/mean Node Sud.png",
    "/assets/img/simboli-bianchi/elementi-celesti/mean Node-r.png",
    "/assets/img/simboli-bianchi/elementi-celesti/mean Node.png",
    "/assets/img/simboli-bianchi/elementi-celesti/mean Perigee.png",
    "/assets/img/simboli-bianchi/elementi-celesti/Mercury-r.png",
    "/assets/img/simboli-bianchi/elementi-celesti/Mercury.png",
    "/assets/img/simboli-bianchi/elementi-celesti/Moon.png",
    "/assets/img/simboli-bianchi/elementi-celesti/Nemesi.png",
    "/assets/img/simboli-bianchi/elementi-celesti/Neptune-r.png",
    "/assets/img/simboli-bianchi/elementi-celesti/Neptune.png",
    "/assets/img/simboli-bianchi/elementi-celesti/Nike.png",
    "/assets/img/simboli-bianchi/elementi-celesti/osc. Apogee-r.png",
    "/assets/img/simboli-bianchi/elementi-celesti/osc. Apogee.png",
    "/assets/img/simboli-bianchi/elementi-celesti/osc. Perigee-r.png",
    "/assets/img/simboli-bianchi/elementi-celesti/osc. Perigee.png",
    "/assets/img/simboli-bianchi/elementi-celesti/Pluto-r.png",
    "/assets/img/simboli-bianchi/elementi-celesti/Pluto.png",
    "/assets/img/simboli-bianchi/elementi-celesti/Saturn-r.png",
    "/assets/img/simboli-bianchi/elementi-celesti/Saturn.png",
    "/assets/img/simboli-bianchi/elementi-celesti/Sun.png",
    "/assets/img/simboli-bianchi/elementi-celesti/Tolma.png",
    "/assets/img/simboli-bianchi/elementi-celesti/true Node Sud-r.png",
    "/assets/img/simboli-bianchi/elementi-celesti/true Node Sud.png",
    "/assets/img/simboli-bianchi/elementi-celesti/true Node-r.png",
    "/assets/img/simboli-bianchi/elementi-celesti/true Node.png",
    "/assets/img/simboli-bianchi/elementi-celesti/Tyche.png",
    "/assets/img/simboli-bianchi/elementi-celesti/Ultravioletto.png",
    "/assets/img/simboli-bianchi/elementi-celesti/Uranus-r.png",
    "/assets/img/simboli-bianchi/elementi-celesti/Uranus.png",
    "/assets/img/simboli-bianchi/elementi-celesti/Venus-r.png",
    "/assets/img/simboli-bianchi/elementi-celesti/Venus.png",
    "/assets/img/simboli-bianchi/elementi-celesti/VerdeNegativo.png",
    "/assets/img/simboli-bianchi/segni/01.png",
    "/assets/img/simboli-bianchi/segni/02.png",
    "/assets/img/simboli-bianchi/segni/03.png",
    "/assets/img/simboli-bianchi/segni/04.png",
    "/assets/img/simboli-bianchi/segni/05.png",
    "/assets/img/simboli-bianchi/segni/06.png",
    "/assets/img/simboli-bianchi/segni/07.png",
    "/assets/img/simboli-bianchi/segni/08.png",
    "/assets/img/simboli-bianchi/segni/09.png",
    "/assets/img/simboli-bianchi/segni/10.png",
    "/assets/img/simboli-bianchi/segni/11.png",
    "/assets/img/simboli-bianchi/segni/12.png"
  ]
}
