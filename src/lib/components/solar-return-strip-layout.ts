/** Display coordinate on the radix-anchored, left-to-right zodiac strip. */
export function solarReturnStripPosition(longitude:number, radixFirstCusp:number):number {
  return (((longitude - radixFirstCusp) % 360 + 360) % 360) / 3.6;
}

export function solarReturnAxisColor(name:string):string {
  return ({ASC:'#ed6e00', MC:'#6600a1', DS:'#1ea45e', IC:'#a59acf'} as Record<string,string>)[name] ?? 'transparent';
}

export function solarReturnSignColor(sign:number, axes:readonly {name:string; longitude:number}[]):string {
  // Match the website's CSS precedence when several axes share a sign.
  for (const name of ['IC','DS','MC','ASC']) {
    if (axes.some(axis => axis.name===name && Math.floor(((axis.longitude%360)+360)%360/30)===sign)) return solarReturnAxisColor(name);
  }
  return 'transparent';
}
