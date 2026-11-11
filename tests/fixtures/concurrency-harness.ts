import '@angular/compiler';
import { ElementRef } from '@angular/core';
import { defaultOpzioniGrafico, GestoreImmagini, GraficoRenderService } from '../../src/public-api';
import { demoBodies, makeDemoTheme } from '../../demo/fixtures';
import gsap from 'gsap';

(globalThis as any).runChartConcurrencyProbe = async () => {
  GestoreImmagini.configurePublicAssetsBase('http://127.0.0.1:4177/assets/');
  const opts = structuredClone(defaultOpzioniGrafico) as any;
  opts.settaggi.skin_id = 'light';
  opts.temaGrafico = 'light';
  for (const body of demoBodies) opts.settaggi.elementi_celesti[body].att = true;
  const theme = makeDemoTheme(0);
  const a = new GraficoRenderService(), b = new GraficoRenderService();
  const canvas = document.createElement('canvas');
  Object.assign(canvas.style, {width:'400px', height:'400px', position:'fixed', left:'-1000px'});
  document.body.appendChild(canvas);
  const draw = () => a.disegnaScena(theme, null, null, 'latitudini', opts);
  const exportAt = (renderer: GraficoRenderService, size: number) =>
    renderer.generaImmagine(theme, null, null, 'latitudini', opts, {x:size, y:size}, 1);
  const resolutions = () => {
    const sizes: string[] = [];
    (a as any).scene.traverse((object: any) => {
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) if (material?.isLineMaterial) sizes.push(`${material.resolution.x}x${material.resolution.y}`);
    });
    return sizes;
  };
  try {
    const expectedSmall = await exportAt(a, 300);
    const expectedLarge = await exportAt(b, 700);
    const [actualSmall, actualLarge] = await Promise.all([exportAt(a, 300), exportAt(b, 700)]);
    a.inizializzaGraficoRender(new ElementRef(canvas), {x:400,y:400});
    await draw();
    const expectedResolutions = resolutions();
    await Promise.all([draw(), exportAt(b, 700)]);
    const concurrentResolutions = resolutions();
    const animatedTheme = makeDemoTheme(0);
    animatedTheme.planets.Sun.dodecatemoria = {longitude: 40};
    const animatedOpts = structuredClone(opts);
    animatedOpts.dodecatemore = 'Sun';
    const before = new Set(gsap.globalTimeline.getChildren(true, false, true));
    await a.disegnaScena(animatedTheme, null, null, 'carta-astrale', animatedOpts);
    const timelines = gsap.globalTimeline.getChildren(true, false, true).filter(timeline => !before.has(timeline) && timeline.repeat() === -1);
    await draw();
    const remaining = gsap.globalTimeline.getChildren(true, false, true);
    const beforeExport = new Set(remaining);
    await a.generaImmagine(animatedTheme, null, null, 'carta-astrale', animatedOpts, {x:300,y:300}, 1);
    const exportTimelineCleared = gsap.globalTimeline.getChildren(true, false, true)
      .every(timeline => beforeExport.has(timeline) || timeline.repeat() !== -1);
    const darkOpts = structuredClone(opts);
    darkOpts.settaggi.skin_id = 'dark'; darkOpts.temaGrafico = 'dark';
    await Promise.all([
      a.disegnaScena(theme, null, null, 'carta-astrale', opts),
      a.disegnaScena(theme, null, null, 'carta-astrale', darkOpts),
    ]);
    const finalBackground = (a as any).scene.background.getHexString();
    const invalidOpts = structuredClone(opts);
    invalidOpts.settaggi.skin_id = 'unknown-skin';
    const [failure, recovery] = await Promise.allSettled([
      a.generaImmagine(theme, null, null, 'carta-astrale', invalidOpts, {x:300,y:300}, 1),
      exportAt(b, 300),
    ]);
    const pending = a.disegnaScena(theme, null, null, 'carta-astrale', opts);
    a.ngOnDestroy();
    await pending;
    return {smallMatches: actualSmall === expectedSmall, largeMatches: actualLarge === expectedLarge,
      expectedResolutions, concurrentResolutions, timelineCount: timelines.length,
      timelineCleared: timelines.every(timeline => !remaining.includes(timeline)), exportTimelineCleared, finalBackground,
      queueRecovered: failure.status === 'rejected' && recovery.status === 'fulfilled',
      destroyedDrawSkipped: !(a as any).scene && !a.isInizializzato};
  } finally { a.ngOnDestroy(); b.ngOnDestroy(); canvas.remove(); }
};

(globalThis as any).runMissingTextureExport = async () => {
  GestoreImmagini.configurePublicAssetsBase('http://127.0.0.1:4177/assets/');
  const opts = structuredClone(defaultOpzioniGrafico) as any;
  opts.settaggi.skin_id = 'sun'; opts.temaGrafico = 'sun';
  for (const body of demoBodies) opts.settaggi.elementi_celesti[body].att = true;
  const renderer = new GraficoRenderService();
  try {
    await renderer.generaImmagine(makeDemoTheme(0), null, null, 'carta-astrale', opts, {x:300,y:300}, 1);
    return 'unexpected success';
  } catch (error) { return error instanceof Error ? error.message : String(error); }
  finally { renderer.ngOnDestroy(); }
};

(globalThis as any).runFailedSceneAnimationProbe = async (sinastria = false) => {
  GestoreImmagini.configurePublicAssetsBase('http://127.0.0.1:4177/assets/');
  const opts = structuredClone(defaultOpzioniGrafico) as any;
  opts.settaggi.skin_id = 'light'; opts.temaGrafico = 'light'; opts.dodecatemore = 'Sun';
  opts.mostraSinastria = sinastria;
  for (const body of demoBodies) opts.settaggi.elementi_celesti[body].att = true;
  const theme = makeDemoTheme(0); theme.planets.Sun.dodecatemoria = {longitude:40};
  const service = new GraficoRenderService();
  const canvas = document.createElement('canvas');
  Object.assign(canvas.style, {width:'400px',height:'400px'}); document.body.appendChild(canvas);
  service.inizializzaGraficoRender(new ElementRef(canvas), {x:400,y:400});
  const before = new Set(gsap.globalTimeline.getChildren(true,false,true));
  const originalLoad = GestoreImmagini.loadAsync;
  let signCount = 0;
  if (sinastria) GestoreImmagini.loadAsync = async ref => {
    if (ref.endsWith('/segni/06.png') && ++signCount === 2) throw new Error('Injected failure: segni/06.png');
    return originalLoad.call(GestoreImmagini, ref);
  };
  let message = '';
  try { await service.disegnaScena(theme, null, sinastria ? theme : null, 'carta-astrale', opts); }
  catch (error) { message = error instanceof Error ? error.message : String(error); }
  finally { GestoreImmagini.loadAsync = originalLoad; service.ngOnDestroy(); canvas.remove(); }
  const leaked = gsap.globalTimeline.getChildren(true,false,true)
    .filter(timeline => !before.has(timeline) && timeline.repeat() === -1);
  return {message, leaked:leaked.length};
};


/** A stale texture failure must never reject the superseded draw request. */
(globalThis as any).runSupersededTextureFailureProbe = async () => {
  GestoreImmagini.configurePublicAssetsBase('http://127.0.0.1:4177/assets/');
  const opts = structuredClone(defaultOpzioniGrafico) as any;
  opts.settaggi.skin_id = 'light'; opts.temaGrafico = 'light';
  for (const body of demoBodies) opts.settaggi.elementi_celesti[body].att = true;
  const theme = makeDemoTheme(0);
  const service = new GraficoRenderService();
  const canvas = document.createElement('canvas');
  Object.assign(canvas.style, {width:'360px',height:'360px'});
  document.body.appendChild(canvas);
  service.inizializzaGraficoRender(new ElementRef(canvas), {x:360,y:360});
  const original = GestoreImmagini.waitForTexture;
  let releaseFailure!: () => void;
  let sawWait!: () => void;
  const waiting = new Promise<void>(resolve => { sawWait = resolve; });
  let gateUsed = false;
  let oldOutcome: PromiseSettledResult<void> | null = null;
  let newOutcome: PromiseSettledResult<void> | null = null;
  try {
    GestoreImmagini.waitForTexture = (texture) => {
      if (!gateUsed) {
        gateUsed = true;
        sawWait();
        return new Promise<void>((_,reject) => {
          releaseFailure = () => reject(new Error('Injected obsolete texture failure'));
        });
      }
      return original.call(GestoreImmagini,texture);
    };
    const oldDraw = service.disegnaScena(theme,null,null,'carta-astrale',opts);
    await waiting; // first draw is suspended inside waitForSceneTextures
    const newDraw = service.disegnaScena(theme,null,null,'carta-astrale',opts);
    releaseFailure();
    [oldOutcome,newOutcome] = await Promise.allSettled([oldDraw,newDraw]) as [
      PromiseSettledResult<void>,PromiseSettledResult<void>
    ];
    return {
      oldRequestIgnored: oldOutcome.status === 'fulfilled',
      newestRequestRendered: newOutcome.status === 'fulfilled'
        && !!(service as any).scene?.children?.length && service.isInizializzato,
      queueStillUsable: (service as any).renderer !== null
    };
  } finally {
    if (releaseFailure) releaseFailure();
    GestoreImmagini.waitForTexture = original;
    service.ngOnDestroy();
    canvas.remove();
  }
};

/** A re-entrant host listener may retire the canvas while a redraw commits. */
(globalThis as any).runDestroyDuringSceneLeaveProbe = async () => {
  GestoreImmagini.configurePublicAssetsBase('http://127.0.0.1:4177/assets/');
  const opts = structuredClone(defaultOpzioniGrafico) as any;
  opts.settaggi.skin_id = 'light'; opts.temaGrafico = 'light';
  for (const body of demoBodies) opts.settaggi.elementi_celesti[body].att = true;
  const service = new GraficoRenderService();
  const canvas = document.createElement('canvas');
  Object.assign(canvas.style, {width:'360px',height:'360px'});
  document.body.appendChild(canvas);
  let receivedLeave = false;
  try {
    service.inizializzaGraficoRender(new ElementRef(canvas),{x:360,y:360});
    const theme = makeDemoTheme(0);
    await service.disegnaScena(theme,null,null,'carta-astrale',opts);
    // Synthesize the already-hovered state. setScene(null) emits leave before
    // disposing old scene; the callback destroys the service synchronously.
    (service as any).planetController.hovered = {layer:'natal',name:'Sun'};
    service.setPlanetInteractionListener(event => {
      if (event.type === 'leave') {
        receivedLeave = true;
        service.ngOnDestroy();
      }
    });
    await service.disegnaScena(theme,null,null,'carta-astrale',opts);
    service.render();
    return {
      leaveDelivered: receivedLeave,
      destroyedSceneNotResurrected: !(service as any).scene &&
        !(service as any).renderer && !service.isInizializzato,
      obsoleteFrameNotQueued: !(service as any).renderRequestedBeforeInit,
    };
  } finally {
    service.ngOnDestroy();
    canvas.remove();
  }
};
