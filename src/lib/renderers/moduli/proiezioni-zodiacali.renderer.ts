import * as THREE from 'three';
import {OggettiSempliciRender} from '../oggetti-semplici.renderer';
import {Colori} from '../_colori.config';
import {SkinManager} from '../@skin-manager';

/** Draws host-supplied reflection facts; never calculates astrological positions. */
export class ProiezioniZodiacaliRender {
  private static point(longitude:number, asc:number, radius:number): THREE.Vector3 {
    return new THREE.Vector3(0, radius, 0).applyAxisAngle(new THREE.Vector3(0,0,1), THREE.MathUtils.degToRad(90-asc+longitude));
  }
  private static dot(position:THREE.Vector3, color:string): THREE.Mesh {
    const dot = OggettiSempliciRender.getCerchio(0.025,color);
    dot.position.copy(position); dot.position.z = .045;
    return dot;
  }
  public static async getLayer(options:any, asc:number, zodiacDiameter:number, houseDiameter:number,
    planetInner:number, planetOuter:number, scale:number, australInversion:boolean): Promise<THREE.Group> {
    const group = new THREE.Group();
    group.userData.chartInteractionRole = 'zodiac-projections';
    const projection = options.proiezioneZodiacale;
    const axes:Record<string,number> = {Cardinale:270, Fissa:300, Mutevole:330};
    if (!projection || !['antisci','contrantisci'].includes(projection.tipo) ||
      !Object.prototype.hasOwnProperty.call(axes, projection.asse) || !Array.isArray(projection.punti)) return group;
    try {
    const bg = new THREE.Color(SkinManager.skins[options.settaggi.skin_id].bgColor);
    const light = bg.r*.2126 + bg.g*.7152 + bg.b*.0722 > .35;
    const axis = OggettiSempliciRender.getLineaGrossa({x:0,y:-zodiacDiameter/2,z:0},
      {x:0,y:zodiacDiameter/2,z:0}, light ? '#a26a00' : '#e5c143', .6);
    axis.rotateZ(THREE.MathUtils.degToRad(90-asc+axes[projection.asse]));
    axis.userData.projectionAxis = projection.asse;
    group.add(axis);
    for (const item of projection.punti) {
      if (!item || typeof item.name !== 'string' || ![item.longitude,item.antiscia,item.contraAntiscia].every(Number.isFinite) ||
        (projection.pianeta !== 'tutti' && projection.pianeta !== item.name)) continue;
      const target = projection.tipo === 'antisci' ? item.antiscia : item.contraAntiscia;
      const color = Colori.elementiCelesti[item.name] ?? '#777777';
      const radius = houseDiameter / 2;
      if (projection.pianeta === 'tutti') {
        const markerRadius = .034;
        const geometry = projection.tipo === 'antisci' ? new THREE.CircleGeometry(markerRadius,32) :
          new THREE.RingGeometry(markerRadius*.65,markerRadius,32);
        const marker = new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color,side:THREE.DoubleSide}));
        marker.position.copy(this.point(target,asc,planetOuter/2-markerRadius)); marker.position.z = .045;
        marker.userData.projectionPoint = item.name; marker.userData.trueLongitude = target;
        group.add(marker);
        continue;
      }
      const natal = this.point(item.longitude,asc,radius), projected = this.point(target,asc,radius), center = new THREE.Vector3();
      group.add(this.dot(natal,light ? '#000000':'#ffffff'), this.dot(projected,light ? '#000000':'#ffffff'));
      if (projection.tipo === 'antisci') {
        group.add(OggettiSempliciRender.getLineaGrossa(natal,projected,color,.6));
        group.add(OggettiSempliciRender.getLineaGrossa(projected,center,color,.6));
        group.add(OggettiSempliciRender.getLineaGrossa(center,natal,color,.6));
      } else group.add(OggettiSempliciRender.getLineaGrossaTratteggiata(center,projected,'#f60a09',.6,.05));
      const image = await OggettiSempliciRender.getImg(`simboli-bianchi/elementi-celesti/${item.name}${item.retrograde ? '-r' : ''}.png`,
        875,605,1/875,australInversion,color);
      image.scale.set(.23*scale,.23*scale,1);
      image.position.copy(this.point(target,asc,(planetInner+planetOuter)/4)); image.position.z = .055;
      image.userData.projectionPoint = item.name; image.userData.trueLongitude = target;
      group.add(image);
    }
    return group;
    } catch (error) {
      // A failed async image load never returns the partial group to the scene owner.
      const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>();
      group.traverse(object => {
        const mesh = object as THREE.Mesh;
        if (mesh.geometry) geometries.add(mesh.geometry);
        for (const material of mesh.material ? (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) : []) {
          materials.add(material);
          const map = (material as THREE.MeshBasicMaterial).map;
          if (map) textures.add(map);
        }
      });
      textures.forEach(texture => texture.dispose());
      materials.forEach(material => material.dispose());
      geometries.forEach(geometry => geometry.dispose());
      throw error;
    }
  }
}
