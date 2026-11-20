import * as THREE from 'three';
import {mousePositionToNdc} from '../renderers/@gestore-eventi-mouse';

export type ChakraHover = Readonly<{chakra:string; sector:number}>;

/** Pick sectors in the chart's transformed coordinate system. */
export class ChakraHoverController {
  private readonly raycaster=new THREE.Raycaster();
  private readonly point=new THREE.Vector2();
  private last:{x:number;y:number}|null=null;
  private current:ChakraHover|null=null;
  private highlighted:THREE.Mesh|null=null;
  constructor(private readonly canvas:HTMLCanvasElement,private readonly getScene:()=>THREE.Scene|null,
    private readonly getCamera:()=>THREE.Camera|null,private readonly notify:(value:ChakraHover|null)=>void) {
    canvas.addEventListener('mousemove',this.move);canvas.addEventListener('mouseleave',this.leave);
    window.addEventListener('resize',this.refresh);
  }
  private move=(event:MouseEvent):void=>{this.last={x:event.clientX,y:event.clientY};this.refresh();};
  private leave=():void=>{this.last=null;this.set(null);};
  private set(value:ChakraHover|null,highlight:THREE.Mesh|null=null,subdivisions=0):void {
    if (this.current?.chakra===value?.chakra && this.current?.sector===value?.sector && this.highlighted===highlight) return;
    if (this.highlighted) this.highlighted.visible=false;
    this.highlighted=highlight;
    if (highlight && value) {
      highlight.geometry.setDrawRange((value.sector-1)*subdivisions*3,subdivisions*3);
      highlight.visible=true;
    }
    this.current=value;this.notify(value);
  }
  public refresh=():void=>{
    const scene=this.getScene(), camera=this.getCamera();
    const ndc=this.last && mousePositionToNdc(this.last.x,this.last.y,this.canvas.getBoundingClientRect());
    const sectors:THREE.Object3D[]=[];
    scene?.traverse(object=>{if(object.userData.chartInteractionRole==='chakra-sectors') sectors.push(object);});
    if(!ndc || !camera || !scene || !sectors.length) {this.set(null);return;}
    scene.updateMatrixWorld(true);camera.updateMatrixWorld(true);
    this.point.set(ndc.x,ndc.y);this.raycaster.setFromCamera(this.point,camera);
    const hit=this.raycaster.intersectObjects(sectors,false)[0];
    const data=hit?.object.userData;
    if (!hit || typeof data?.chakra!=='string' || !Number.isInteger(data.sectorCount) || data.sectorCount<1 ||
        !Number.isFinite(data.radius) || data.radius<=0 || !Number.isInteger(data.subdivisions) || data.subdivisions<1) {this.set(null);return;}
    const local=hit.object.worldToLocal(hit.point.clone());
    if (local.x*local.x+local.y*local.y>data.radius*data.radius) {this.set(null);return;}
    const step=2*Math.PI/data.sectorCount;
    const relative=((Math.atan2(local.y,local.x)-(Math.PI-step/2))%(2*Math.PI)+2*Math.PI)%(2*Math.PI);
    const index=Math.min(data.sectorCount-1,Math.floor(relative/step));
    const highlight=hit.object.parent?.getObjectByName('chakra-highlight');
    if (!(highlight instanceof THREE.Mesh)) {this.set(null);return;}
    this.set({chakra:data.chakra,sector:index+1},highlight,data.subdivisions);
  };
  public sceneChanged():void {this.set(null);this.refresh();}
  public dispose():void {
    this.canvas.removeEventListener('mousemove',this.move);this.canvas.removeEventListener('mouseleave',this.leave);
    window.removeEventListener('resize',this.refresh);this.last=null;this.set(null);
  }
}
