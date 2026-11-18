import * as THREE from 'three';
import {mousePositionToNdc} from '../renderers/@gestore-eventi-mouse';

export class FixedStarHoverController {
  private readonly raycaster = new THREE.Raycaster();
  private readonly point = new THREE.Vector2();
  private last:{x:number; y:number} | null = null;
  private current:number | null = null;
  constructor(private readonly canvas:HTMLCanvasElement, private readonly scene:()=>THREE.Scene | null,
    private readonly camera:()=>THREE.Camera | null, private readonly notify:(id:number | null)=>void) {
    canvas.addEventListener('mousemove', this.move); canvas.addEventListener('mouseleave', this.leave);
    window.addEventListener('resize', this.refresh);
  }
  private move = (e:MouseEvent):void => {this.last={x:e.clientX,y:e.clientY}; this.refresh();};
  private leave = ():void => {this.last=null; this.set(null);};
  private set(id:number | null):void {if (this.current !== id) {this.current=id; this.notify(id);}}
  public refresh = ():void => {
    const scene=this.scene(), camera=this.camera();
    const ndc=this.last && mousePositionToNdc(this.last.x,this.last.y,this.canvas.getBoundingClientRect());
    const groups:THREE.Object3D[]=[];
    scene?.traverse(item=>{if (item.userData.chartInteractionRole==='fixed-stars') groups.push(item);});
    if (!scene || !camera || !ndc || !groups.length) {this.set(null); return;}
    scene.updateMatrixWorld(true); camera.updateMatrixWorld(true);
    this.point.set(ndc.x,ndc.y); this.raycaster.setFromCamera(this.point,camera);
    const hit=this.raycaster.intersectObjects(groups,true).find(item=>Number.isSafeInteger(item.object.userData.fixedStarId));
    this.set(hit ? hit.object.userData.fixedStarId : null);
  };
  public sceneChanged():void {this.set(null); this.refresh();}
  public dispose():void {this.canvas.removeEventListener('mousemove',this.move); this.canvas.removeEventListener('mouseleave',this.leave);
    window.removeEventListener('resize',this.refresh); this.last=null; this.set(null);}
}
