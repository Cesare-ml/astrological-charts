import * as THREE from 'three';
import {GestoreImmagini} from './gestore-immagini';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';

export class OggettiSempliciRender {
  public static dimensioniCanvas:{x:number, y:number} = null;
  public static baseWidth = 1300;
  public static lineScaleFactorMultiplier = 1;
  // Protect synchronous Three.js scene construction from unbounded stroke loops.
  private static readonly MAX_STROKE_PRIMITIVES = 20_000;

  private static strokeSegmentCount(distance: number, step: number, strokesPerSegment: number): number {
    if (!Number.isFinite(distance) || distance < 0 || !Number.isFinite(step) || step <= 0) {
      throw new RangeError('Stroke distance must be finite and step must be positive and finite.');
    }
    const count = Math.trunc(distance / step);
    if (!Number.isFinite(count) || count * strokesPerSegment > this.MAX_STROKE_PRIMITIVES) {
      throw new RangeError('Stroke pattern exceeds the safe primitive limit.');
    }
    return count;
  }
  
  // RENDERER E SIZES
  public static setDimensioniCanvas({x,y}) {
    this.dimensioniCanvas = {x,y};
  }
  public static getLineScaleFactor() {
    let scale = this.dimensioniCanvas.x/*/window.devicePixelRatio*/ / this.baseWidth;
    //console.log(scale);
    return scale * this.lineScaleFactorMultiplier;
  }
  public static getMatLineResolutionSizes() {
    let sizes = this.dimensioniCanvas;/*
    sizes.x *= window.devicePixelRatio;
    sizes.y *= window.devicePixelRatio;*/
    return sizes;
  }

  // OGGETTI
  public static getCerchio(raggio: number, colore: any, spessore: number = 0.005) {
    const shape = new THREE.Shape();
    shape.absarc(0, 0, raggio, 0, Math.PI * 2, false);

    const geometry = new THREE.RingGeometry(raggio - spessore, raggio, 128);
    const material = new THREE.MeshBasicMaterial({ 
      color: colore,
      side: THREE.DoubleSide 
    });
    const mesh = new THREE.Mesh(geometry, material);
    return mesh;
  }


  // ✅ Crea un anello (riempito)
  public static getAnello(raggioInterno: number, raggioEsterno: number, colore: any, opzioni?: { trasparente?: boolean; opacity?: number; texture?: THREE.Texture }): any {
    const geometry = new THREE.RingGeometry(raggioInterno, raggioEsterno, 128);
    
    const materialOptions: THREE.MeshBasicMaterialParameters = {
      color: colore,
      side: THREE.DoubleSide,
      transparent: opzioni?.trasparente ?? true,
      opacity: opzioni?.opacity ?? 1.0,
      map: opzioni?.texture ?? null
    };

    const material = new THREE.MeshBasicMaterial(materialOptions);

    const mesh = new THREE.Mesh(geometry, material);
    //mesh.rotation.x = Math.PI / 2; // opzionale: orienta l’anello sul piano XY

    return mesh;
  }

  // Tiny arcs need at least two sampled divisions to form stable geometry.
  // Limit pathological input spans to prevent unbounded synchronous allocations.
  private static arcSubdivisionCount(startDeg: number, endDeg: number): number {
    if (!Number.isFinite(startDeg) || !Number.isFinite(endDeg) ||
        !Number.isFinite(endDeg - startDeg)) {
      throw new RangeError('Arc angles must be finite.');
    }
    return Math.min(720, Math.max(2, Math.trunc(Math.abs(endDeg - startDeg))));
  }

  public static getSemiArcoGrosso(a, b, yInterno, yEsterno, colore, textureUrl = null) {
    const subdivisions = this.arcSubdivisionCount(a, b);
    // Some valid radial fills (notably the aspect-center disc) intentionally
    // pass the outer radius as zero. Preserve radius order; reject only invalid
    // radii before Three.js constructs NaN/Infinity vertices.
    if (!Number.isFinite(yInterno) || !Number.isFinite(yEsterno) ||
        yInterno < 0 || yEsterno < 0 ||
        !Number.isFinite(Math.fround(yInterno)) ||
        !Number.isFinite(Math.fround(yEsterno))) {
      // ShapeGeometry stores position coordinates in Float32 arrays. Finite
      // JavaScript doubles may otherwise overflow to +/-Infinity on the GPU.
      throw new RangeError('Arc radii must be finite, non-negative and representable as Float32.');
    }
    // Three.js EllipseCurve.getPoint() normalizes angle differences with
    // repeated +/-2PI loops. Large raw angles would still freeze rendering
    // despite bounded getSpacedPoints() counts. Reduce to one turn first.
    const sweep = b - a;
    const startDeg = ((a % 360) + 360) % 360;
    const magnitude = Math.abs(sweep);
    const remainder = magnitude % 360;
    const boundedSweep = magnitude === 0 ? 0 : remainder === 0 ? 360 : remainder;
    const clockwise = sweep < 0;
    const endDeg = startDeg + (clockwise ? -boundedSweep : boundedSweep);

    //console.log(a,b,yEsterno,yInterno,colore, textureUrl);
    const arcoInterno = new THREE.EllipseCurve(
      0, 0, yInterno, yInterno,
      THREE.MathUtils.degToRad(startDeg), THREE.MathUtils.degToRad(endDeg), clockwise, 0
    );
    const puntiArcoInterno = arcoInterno.getSpacedPoints(subdivisions);

    const arcoEsterno = new THREE.EllipseCurve(
      0, 0, yEsterno, yEsterno,
      THREE.MathUtils.degToRad(startDeg), THREE.MathUtils.degToRad(endDeg), clockwise, 0
    );
    const puntiArcoEsterno = arcoEsterno.getSpacedPoints(subdivisions).reverse();

    const punti = puntiArcoInterno.concat(puntiArcoEsterno);
    const shape = new THREE.Shape(punti);
    const geometry = new THREE.ShapeGeometry(shape);

    // Geometry is already allocated here. Ensure that failed UV preparation
    // cannot leak a Three.js buffer, even when texture setup was never reached.
    try {
        geometry.computeBoundingBox();
      const max = geometry.boundingBox.max;
      const min = geometry.boundingBox.min;

      const uvAttr = [];
      const posAttr = geometry.attributes['position'];
      const uvWidth = max.x - min.x;
      const uvHeight = max.y - min.y;

      for (let i = 0; i < posAttr.count; i++) {
        const x = posAttr.getX(i);
        const y = posAttr.getY(i);

        const u = Number.isFinite(uvWidth) && uvWidth > 0 ? (x - min.x) / uvWidth : 0.5;
        const v = Number.isFinite(uvHeight) && uvHeight > 0 ? (y - min.y) / uvHeight : 0.5;

        uvAttr.push(u, v);
      }

      geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvAttr, 2));
    } catch (error) {
      geometry.dispose();
      throw error;
    }

    let material: THREE.MeshBasicMaterial | undefined;
    try {
      if (textureUrl) {
        const texture = GestoreImmagini.getImg(textureUrl);
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        texture.repeat.set(1, 1);
        texture.offset.set(0, 0);
        texture.center.set(0.5, 0.5);
        texture.rotation = 0;
  
        // Imposta i filtri per evitare sgranature o tiling
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
  
        material = new THREE.MeshBasicMaterial({
          map: texture,
          side: THREE.DoubleSide,
          transparent: true,
          color: colore
        });
      } else {
        material = new THREE.MeshBasicMaterial({ color: colore });
      }
  
      return new THREE.Mesh(geometry, material);
    } catch (error) {
      // The texture is host-owned/shared and must not be disposed here.
      // Release only the geometry/material constructed by this call when a
      // synchronous texture lookup or mesh construction throws.
      material?.dispose();
      geometry.dispose();
      throw error;
    }
  }





  //funzione su xy
  public static getLineaGrossaTratteggiata(da,a,colore,spessore,passo) {
    var group = new THREE.Group();

    var distanza = da.distanceTo(a);
    var segmenti = this.strokeSegmentCount(distanza, passo, 1);

    var xDelta = (a.x - da.x)/segmenti;
    var yDelta = (a.y - da.y)/segmenti;

    for(var i=0; i<segmenti; i+=2) {
      var daI = new THREE.Vector3(
        xDelta*i + da.x, yDelta*i + da.y, 0
      );
      var aI = new THREE.Vector3(
        xDelta*(i+1) + da.x, yDelta*(i+1) + da.y, 0
      );

      var segmento = OggettiSempliciRender.createFatLine(
        OggettiSempliciRender.createFatLineGeometry(
          [daI,aI],
          true,
          new THREE.Color(colore),
        ),
        spessore
      );
      group.add(segmento);
    }

    return group;
  }

  /*
      trattoLinea {
        passo:number
        rateoLineaSpazio:number,
        nLinee:number,
        nPunti:number
      }

  */
  public static getLineaGrossaPuntoLinea(da,a,colore,spessore,trattoLinea) {
    var group = new THREE.Group();

    if (!trattoLinea ||
        !Number.isSafeInteger(trattoLinea.nLinee) || trattoLinea.nLinee < 0 ||
        !Number.isSafeInteger(trattoLinea.nPunti) || trattoLinea.nPunti < 0 ||
        !Number.isFinite(trattoLinea.rateoLineaSpazio) || trattoLinea.rateoLineaSpazio < 0) {
      throw new RangeError('Stroke pattern counts must be non-negative integers and spacing must be non-negative and finite.');
    }

    const primitives = trattoLinea.nLinee + trattoLinea.nPunti;
    var distanza = da.distanceTo(a);
    var segmenti = this.strokeSegmentCount(distanza, trattoLinea.passo, primitives);
    if (primitives === 0 || segmenti === 0) return group;

    var xDelta = (a.x - da.x)/segmenti;
    var yDelta = (a.y - da.y)/segmenti;

    // Equivalent to the original formula when nLinee > 0, but also supports
    // dot-only patterns (nLinee === 0) without dividing by zero.
    var fract = trattoLinea.nLinee * (1 + trattoLinea.rateoLineaSpazio)
              + trattoLinea.rateoLineaSpazio * trattoLinea.nPunti;
    if (!Number.isFinite(fract) || fract <= 0) {
      throw new RangeError('Stroke pattern must have positive finite length.');
    }
    var lineaLenX = xDelta/fract;
    var spazioLenX = trattoLinea.rateoLineaSpazio * lineaLenX;

    var lineaLenY = yDelta/fract;
    var spazioLenY = trattoLinea.rateoLineaSpazio * lineaLenY;

    for(var i=0; i<segmenti; i++) {

      /* Aggiungo le linee */
      for(var nl=0; nl<trattoLinea.nLinee; nl++) {
        var dax = da.x + xDelta*i + lineaLenX*nl + spazioLenX*nl;
        var day = da.y + yDelta*i + lineaLenY*nl + spazioLenY*nl;
        var daI = new THREE.Vector3(
          dax,
          day,
          0
        );
        var aI = new THREE.Vector3(
          dax + lineaLenX,
          day + lineaLenY,
          0
        );

        var linea = OggettiSempliciRender.createFatLine(
          OggettiSempliciRender.createFatLineGeometry(
            [daI,aI],
            true,
            new THREE.Color(colore),
          ),
          spessore
        );
        group.add(linea);
      }

      /* Aggiungo i Punti */
      for(var np=0; np<trattoLinea.nPunti; np++) {
        var dax = da.x + xDelta*i + lineaLenX*trattoLinea.nLinee + spazioLenX*(trattoLinea.nLinee + np);
        var day = da.y + yDelta*i + lineaLenY*trattoLinea.nLinee + spazioLenY*(trattoLinea.nLinee + np);
        var daI = new THREE.Vector3(
          dax,
          day,
          0
        );
        var aI = new THREE.Vector3(
          dax + 0.001,
          day + 0.001,
          0
        );

        var punto = OggettiSempliciRender.createFatLine(
          OggettiSempliciRender.createFatLineGeometry(
            [daI,aI],
            true,
            new THREE.Color(colore),
          ),
          spessore
        );
        group.add(punto);
      }
    }

    return group;
  }
  public static getLineaGrossa(da,a,colore,spessore) {
    //console.log(da,a,colore,spessore);
    var linea = OggettiSempliciRender.createFatLine(
      OggettiSempliciRender.createFatLineGeometry(
        [da,a],
        true,
        new THREE.Color(colore),
      ),
      spessore
    );
    return linea;
  }

  public static createFatLineGeometry(positionsVectors,colorSolid,color) {
    var positions = [];
    // Position and Color Data
    var colors = [];
    var i = 0;
    var geo;

    // for each point
    while (i < positionsVectors.length) {
      positions.push(positionsVectors[i].x, positionsVectors[i].y, 0);
      // push color
      if (!colorSolid) {
        color.setHSL(i / positionsVectors.length, 1.0, 0.5);
      }
      colors.push(color.r, color.g, color.b);

      i += 1;
    }

    // return geo
    geo = new LineGeometry();
    geo.setPositions(positions);
    geo.setColors(colors);
    return geo;
  }

  public static createFatLine(geometry,width) {

    // LINE MATERIAL
    var matLine = new LineMaterial({
      linewidth: width * OggettiSempliciRender.getLineScaleFactor(), // in pixels
      vertexColors: true
    });
    
    const sizes = OggettiSempliciRender.getMatLineResolutionSizes();
    matLine.resolution.set(sizes.x, sizes.y);

    var line = new Line2(geometry, matLine);

    return line;
  }

  /*
  public static getLinea(da: any,a: any,colore: string): any {
    var material = new THREE.LineBasicMaterial( { color: colore } );
    var points = [];
    points.push( new THREE.Vector3( da.x, da.y, 0 ) );
    points.push( new THREE.Vector3( a.x, a.y, 0 ) );

    var geometry = new THREE.BufferGeometry().setFromPoints( points );
    var linea = new THREE.Line( geometry, material );
    return linea;
  }*/
  public static getLinea(da: any, a: any, colore: string): any {
    const spessoreDefault = 1.0;
    return OggettiSempliciRender.getLineaGrossa(da, a, colore, spessoreDefault);
  }

  /*
  public static addTestoXY(testo, fontFilename, posX, posY, colore, addToGroup) {
    var loader = new THREE.FontLoader();
    var mesh = null
    loader.load( 'assets/fonts/'+fontFilename, function ( font ) {

      var textGeo = new THREE.TextGeometry( testo, {
        font: font,
        size: 100,
        height: 0,
        curveSegments: 12
      } );

      var textMaterial = new THREE.MeshPhongMaterial( { color: colore } );
      mesh = new THREE.Mesh( textGeo, textMaterial );
      mesh.position.set( 0, 0, 0 );
      mesh.scale.set(1,1,1);
      mesh.translate(posX, posY);
      console.log(testo,mesh);
      addToGroup.add(mesh);
    });
  }
  */
  public static getTesto(testo, font, colore) {
    //create image
    var bitmap = document.createElement('canvas');
    var g = bitmap.getContext('2d');
    bitmap.width = 100;
    bitmap.height = 100;
    g.font = '20px ' +font;

    g.fillStyle = colore;
    g.fillText(testo, 0, 20);

    // canvas contents will be used for a texture
    var texture = new THREE.Texture(bitmap)
    //texture.needsUpdate = true;

    var img = new THREE.MeshBasicMaterial({ //CHANGED to MeshBasicMaterial
        map:texture,
        transparent: true
    });

    // plane
    var plane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1),img);
    return plane;
  }
/*
  public static addTesto(pos: any,zRotation: number,testo: any,fontFilename: string,colore: string,addTo: any): void {
    var loader = new THREE.FontLoader();
    var mesh = null
    loader.load( 'assets/fonts/'+fontFilename, function ( font ) {

      var textGeo = new THREE.TextGeometry( testo, {
          font: font,
          size: 100,
          height: 0,
          curveSegments: 12
      } );

      var textMaterial = new THREE.MeshPhongMaterial( { color: colore } );
      mesh = new THREE.Mesh( textGeo, textMaterial );
      mesh.position.set( 0, 0, 0 );
      mesh.scale.set(0.0005,0.0005,1);
      mesh.rotateZ(THREE.MathUtils.degToRad(zRotation));
      mesh.translateY(pos.y);
      addTo.add(mesh);
    });
  }
*/
  public static getQuadrilatero(w,h,colore) {
    const geometry = new THREE.PlaneGeometry( w, h );
    const material = new THREE.MeshBasicMaterial( {color: colore, side: THREE.DoubleSide} );
    const plane = new THREE.Mesh( geometry, material );
    return plane;
  }
  public static getTriangolo(colore: string) {
    // Definisci i vertici del triangolo
    const vertices = new Float32Array([
      0, 0, 0,    // v1
      1, 0, 0,    // v2
      0.5, 1, 0   // v3
    ]);

    // Crea la BufferGeometry e imposta i vertici
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(vertices, 3));

    // Opzionale: calcola la normale automaticamente
    geom.computeVertexNormals();

    // Crea il materiale
    const mat = new THREE.MeshBasicMaterial({ color: colore, side: THREE.DoubleSide });

    // Crea la mesh
    const mesh = new THREE.Mesh(geom, mat);

    return mesh;
  }


  public static getArco(raggio, angoloDegInizio, angoloDegFine, colore) {
    const curve = new THREE.EllipseCurve(
    	0,  0,            // ax, aY
    	raggio, raggio,           // xRadius, yRadius
    	THREE.MathUtils.degToRad(angoloDegInizio+90),  THREE.MathUtils.degToRad(angoloDegFine+90),  // aStartAngle, aEndAngle
    	false,            // aClockwise
    	0                 // aRotation
    );

    const points = curve.getPoints( 50 );
    const geometry = new THREE.BufferGeometry().setFromPoints( points );

    const material = new THREE.LineBasicMaterial( { color : colore } );

    // Create the final object to add to the scene
    const ellipse = new THREE.Line( geometry, material );

    return ellipse;
  }

  public static async getSfondoQuadrato(assetsImgRef,dim,flipY=false, color?:string) {
    var img = await OggettiSempliciRender.getMaterial(assetsImgRef,flipY, color);

    var plane = new THREE.Mesh(new THREE.PlaneGeometry(dim, dim),img);
    return plane;
  }

  public static async getImg(assetsImgRef: string, w: number, h: number, scale: number, flipY = false, color?:string) {
    const material = await OggettiSempliciRender.getMaterial(assetsImgRef, flipY, color);
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(w * scale, h * scale), material);
    return plane;
  }
/*
  public static loadTexture(path: string): Promise<THREE.Texture> {
    return new Promise((resolve, reject) => {
      const loader = new THREE.TextureLoader();
      loader.load(
        path,
        (texture) => resolve(texture),
        undefined,
        (err) => reject(err)
      );
    });
  }*/

  public static async getMaterial(assetsImgRef: string, flipY: boolean, color?: string) {
    const texture = await GestoreImmagini.loadAsync('../../../assets/img/' + assetsImgRef);

    if(flipY) {
      texture.center.set(0.5, 0.5);
      texture.rotation = Math.PI;
      texture.flipY = false;
    } else {
      texture.rotation = 0;
      texture.flipY = true;
    }

    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      color: color ?? 'white',
      side: THREE.DoubleSide,
    });

    return material;
  }


  public static lanciaFrecciaAdArco(daDeg,aDeg,colore,coloreLinea,diametroCerchioInterno,diametroCerchioEsterno) {
    var group = new THREE.Group();

    var arcoEndDeg = daDeg>aDeg ? aDeg+360 : aDeg;
    if(arcoEndDeg-daDeg >= 5) {
      arcoEndDeg -= 5;
    } else {
      arcoEndDeg = daDeg;
    }

    var raggioMediano = (diametroCerchioEsterno/2 - diametroCerchioInterno/2)/2 + diametroCerchioInterno/2;

    var arco = OggettiSempliciRender.getArco(
      raggioMediano,
      daDeg,
      arcoEndDeg,
      colore
    );
    arco.translateZ(0.01);

    var triangolo = OggettiSempliciRender.getTriangolo(colore);
    triangolo.scale.set(0.06,0.06,1);
    triangolo.rotateZ(THREE.MathUtils.degToRad(arcoEndDeg));
    triangolo.translateY(raggioMediano - 0.03);
    triangolo.rotateZ(THREE.MathUtils.degToRad(90));

    var linea = OggettiSempliciRender.getLinea({x:0,y:diametroCerchioInterno/2},{x:0,y:diametroCerchioEsterno/2},coloreLinea);
    linea.rotateZ(THREE.MathUtils.degToRad(aDeg));
    group.add(linea);

    group.add( arco );
    group.add( triangolo );
    group.add( linea );

    return group;
  }
}
