import '@angular/compiler';
import * as THREE from 'three';
import { ElementRef } from '@angular/core';
import { GraficoRenderService } from '../../src/lib/services/grafico-render.service';

declare global {
  interface Window {
    runInteractiveFrameBatchProbe?: () => Promise<{
      coalescesFocusAspectsZoom: boolean;
      explicitDrawCancelsQueuedFrame: boolean;
      destroyCancelsQueuedFrame: boolean;
      noDeferredFrameAfterDestroy: boolean;
      countAfterBatch: number;
      countAfterExplicit: number;
      countAfterDestroy: number;
    }>;
  }
}

/** Runs against the actual service and a real WebGL canvas, not a mocked RAF. */
window.runInteractiveFrameBatchProbe = async () => {
  const canvas = document.createElement('canvas');
  Object.assign(canvas.style, {
    position:'fixed',left:'-2000px',top:'0',width:'200px',height:'200px'
  });
  document.body.appendChild(canvas);
  const service = new GraficoRenderService();
  let count = 0;
  let countAfterBatch = 0;
  let countAfterExplicit = 0;
  let countAfterDestroy = 0;
  const tick = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
  try {
    service.inizializzaGraficoRender(new ElementRef(canvas), {x:200,y:200});
    const renderer = (service as unknown as {renderer:THREE.WebGLRenderer}).renderer;
    const rawRender = renderer.render.bind(renderer);
    renderer.render = (scene,camera) => {
      count++;
      rawRender(scene,camera);
    };

    service.setZoom(1.05);
    service.highlightPlanet({layer:'natal',name:'Sun'});
    service.setCrossChartAspects([{
      from:{layer:'natal',name:'Sun'},
      to:{layer:'transit',name:'Saturn'},type:'quadrato',orb:1
    }]);
    service.setNatalAspectPresentation('muted');
    service.setZoom(1.12);
    const noImmediateFrame = count === 0;
    await tick();
    countAfterBatch = count;
    const coalescesFocusAspectsZoom = noImmediateFrame && countAfterBatch === 1;

    service.setZoom(1.2);
    service.highlightPlanet({layer:'transit',name:'Saturn'});
    service.render(); // A full-scene redraw must cancel the pending RAF.
    const afterExplicitRender = count;
    await tick();
    countAfterExplicit = count;
    const explicitDrawCancelsQueuedFrame =
      afterExplicitRender === 2 && countAfterExplicit === 2;

    service.setZoom(1.3);
    service.highlightPlanet(null);
    const beforeDestroy = count;
    service.ngOnDestroy();
    await tick();
    countAfterDestroy = count;
    const destroyCancelsQueuedFrame = countAfterDestroy === beforeDestroy;

    service.render(); // Must not enqueue work for an already retired canvas.
    const afterDisposedRender = (service as unknown as {renderRequestedBeforeInit:boolean}).renderRequestedBeforeInit;
    const noDeferredFrameAfterDestroy = !afterDisposedRender && count === countAfterDestroy;

    return {coalescesFocusAspectsZoom,explicitDrawCancelsQueuedFrame,
      destroyCancelsQueuedFrame,noDeferredFrameAfterDestroy,
      countAfterBatch,countAfterExplicit,countAfterDestroy};
  } finally {
    service.ngOnDestroy();
    canvas.remove();
  }
};
