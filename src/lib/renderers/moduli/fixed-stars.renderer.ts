import * as THREE from 'three';
import {registerSceneAnimation} from '../scene-animations';

/** Coordinates and contact flags are supplied by the host's real star catalog. */
export interface FixedStarRingMarker {
  readonly id:number;
  readonly longitude:number;
  readonly magnitude:number;
  readonly axisContact:boolean;
}

/** Display already-computed fixed-star contacts. No astronomical values are inferred here. */
export function createFixedStarRing(
  markers:readonly FixedStarRingMarker[], innerRadius:number, outerRadius:number,
):THREE.Group {
  const group=new THREE.Group();
  if(!Number.isFinite(innerRadius)||!Number.isFinite(outerRadius)||
     outerRadius<=innerRadius||innerRadius<0) return group;
  const radius=(innerRadius+outerRadius)/2;
  const pulsing:THREE.MeshBasicMaterial[]=[];
  for(const marker of markers) {
    if(!Number.isSafeInteger(marker.id)||!Number.isFinite(marker.longitude)||
       !Number.isFinite(marker.magnitude))continue;
    const size=Math.max(.025,Math.min(.08,.075-Math.max(-1,marker.magnitude)*.006));
    const geometry=new THREE.CircleGeometry(size,18);
    const material=new THREE.MeshBasicMaterial({
      color:marker.axisContact?0xffca6a:0xabb4c6,
      transparent:true,opacity:1,depthTest:false,
    });
    const mesh=new THREE.Mesh(geometry,material);
    const angle=((marker.longitude%360+360)%360)*Math.PI/180;
    mesh.position.set(radius*Math.cos(angle),radius*Math.sin(angle),.02);
    mesh.userData={fixedStarId:marker.id,trueLongitude:marker.longitude,chartInteractionRole:'fixed-stars'};
    group.add(mesh);
    if(marker.axisContact)pulsing.push(material);
  }
  if(pulsing.length) {
    const started=Date.now();
    const animate=()=>{
      const opacity=.65+.32*Math.sin((Date.now()-started)/230);
      for(const material of pulsing)material.opacity=opacity;
    };
    animate();
    const interval=setInterval(animate,40);
    registerSceneAnimation(group,{kill:()=>clearInterval(interval)});
  }
  return group;
}
