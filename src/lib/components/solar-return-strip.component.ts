import {CommonModule} from '@angular/common';
import {Component, Input} from '@angular/core';
import {solarReturnStripPosition, solarReturnAxisColor, solarReturnSignColor} from './solar-return-strip-layout';

/** Already-calculated chart positions; this component performs layout only. */
export interface SolarReturnStripPlanet {
  readonly name:string;
  readonly longitude:number;
  readonly glyphUrl:string;
}
export interface SolarReturnStripData {
  readonly radixCusps:readonly number[];
  readonly returnCusps:readonly number[];
  readonly axes:readonly {name:string; longitude:number}[];
  readonly planets:readonly SolarReturnStripPlanet[];
  readonly signs:readonly {name:string; glyphUrl:string}[];
}

@Component({
  selector:'vs-solar-return-strip', standalone:true, imports:[CommonModule],
  template:`<div class="strip" *ngIf="valid" role="img" [attr.aria-label]="label">
    <div class="labels"><span>{{radixLabel}}</span><span>{{returnLabel}}</span><span>{{planetsLabel}}</span><span>{{signsLabel}}</span></div>
    <div class="tracks">
      <div class="row"><span class="mark" *ngFor="let cusp of data!.radixCusps; let i=index" [style.left.%]="position(cusp)">{{i+1}}</span></div>
      <div class="row"><span class="mark" *ngFor="let cusp of data!.returnCusps; let i=index" [style.left.%]="position(cusp)">{{i+1}}</span></div>
      <div class="row"><span class="mark" *ngFor="let planet of data!.planets" [style.left.%]="position(planet.longitude)"><img [src]="planet.glyphUrl" [alt]="planet.name" [title]="planet.name"></span></div>
      <div class="row signs"><ng-container *ngFor="let sign of data!.signs; let i=index">
        <span class="sign-cell" [style.left.%]="position(i*30)" [style.background]="signColor(i)"><img [src]="sign.glyphUrl" [alt]="sign.name" [title]="sign.name"></span>
        <span class="sign-cell" aria-hidden="true" [style.left.%]="position(i*30)-100" [style.background]="signColor(i)"></span>
      </ng-container></div>
      <span class="axis" *ngFor="let axis of data!.axes" [style.left.%]="position(axis.longitude)" [style.border-color]="axisColor(axis.name)" [attr.title]="axis.name"></span>
    </div>
  </div>`,
  styles:[`.strip{display:grid;grid-template-columns:64px minmax(0,1fr);font-size:10px;line-height:1;color:var(--vs-text,#333)}
    .labels{display:grid;grid-template-rows:repeat(4,24px);align-items:center}
    .tracks{position:relative;min-width:0;overflow:hidden;border:1px solid var(--vs-border,#aaa)}
    .row{position:relative;height:24px;border-bottom:1px solid var(--vs-border,#ddd)}
    .row:last-of-type{border-bottom:0}.mark{position:absolute;top:50%;transform:translate(-50%,-50%);z-index:1}
    .mark img{display:block;width:15px;height:15px;object-fit:contain}.axis{position:absolute;top:0;bottom:0;border-left:3px solid;pointer-events:none;z-index:3}
    .sign-cell{position:absolute;top:0;height:100%;width:8.333333%;border-left:1px solid var(--vs-border,#ddd);display:flex;align-items:center;padding-left:4px}
    .sign-cell img{width:20px;height:20px;object-fit:contain}`],
})
export class SolarReturnStripComponent {
  @Input() data:SolarReturnStripData | null = null;
  @Input() label = 'Solar return comparison';
  @Input() radixLabel = 'Radix';
  @Input() returnLabel = 'Return';
  @Input() planetsLabel = 'Planets';
  @Input() signsLabel = 'Signs';
  get valid():boolean {
    const d=this.data;
    return !!d && d.radixCusps.length===12 && d.returnCusps.length===12 && d.signs.length===12 &&
      [...d.radixCusps,...d.returnCusps,...d.axes.map(a=>a.longitude),...d.planets.map(p=>p.longitude)].every(Number.isFinite);
  }
  position(longitude:number):number {
    return solarReturnStripPosition(longitude, this.data?.radixCusps[0] ?? 0);
  }
  axisColor(name:string):string { return solarReturnAxisColor(name); }
  signColor(sign:number):string { return solarReturnSignColor(sign, this.data?.axes ?? []); }
}
