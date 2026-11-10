/* In-process Node.js chart export serialization contract.
 * Copyright (c) 2026 Cesare-ml (VirgoStars project). CPAL-1.0.
 *
 * No Chromium or private assets required: a deterministic mock renderer
 * logs process start/end order and emits a tiny synthetic PNG fixture.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { renderChart, renderChartFile } from '../node/index.mjs';

const PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLefgAAAABJRU5ErkJggg==';
const natal = {
  datetime: '2000-01-01T12:00:00Z',
  ascendant: 20, midheaven: 290,
  houseCusps: Array.from({length:12}, (_,i) => (20+i*30)%360),
  planets: {Sun: {longitude:42.25, latitude:0}},
};

test('same-process exports do not overlap and one failure cannot poison the queue',
  { timeout: 15_000 }, async () => {
    const dir = await mkdtemp(join(tmpdir(), 'virgostars-export-serial-'));
    try {
      const log = join(dir, 'render-order.log');
      const mock = join(dir, 'mock-renderer.mjs');
      await writeFile(mock, `
        import {readFile,appendFile,writeFile} from 'node:fs/promises';
        const argv=process.argv.slice(2);
        const value=flag=>argv[argv.indexOf(flag)+1];
        const chart=JSON.parse(await readFile(value('--input'),'utf8'));
        const tag=chart.tag;
        await appendFile(${JSON.stringify(log)}, 'start:'+tag+'\\n');
        await new Promise(resolve=>setTimeout(resolve,100));
        if(tag==='B'){
          await appendFile(${JSON.stringify(log)}, 'failed:'+tag+'\\n');
          process.exitCode=23;
        }else{
          await writeFile(value('--output'),Buffer.from(${JSON.stringify(PNG_BASE64)},'base64'));
          await appendFile(${JSON.stringify(log)}, 'done:'+tag+'\\n');
        }
      `);
      const inputs = await Promise.all(['A','B','C'].map(async tag => {
        const path = join(dir, tag + '.json');
        await writeFile(path, JSON.stringify({ schemaVersion: 1, natal, tag }));
        return path;
      }));
      const promises = [
        renderChartFile(inputs[0],join(dir,'A.png'),{rendererScript:mock}),
        renderChartFile(inputs[1],join(dir,'B.png'),{rendererScript:mock}),
        // Call a second public API: renderChart must use the SAME queue.
        renderChart({schemaVersion:1,natal,tag:'C'},join(dir,'C.png'),{rendererScript:mock}),
      ];
      const results = await Promise.allSettled(promises);
      assert.deepEqual(results.map(result=>result.status),
        ['fulfilled','rejected','fulfilled']);
      assert.deepEqual((await readFile(log,'utf8')).trim().split('\n'),
        ['start:A','done:A','start:B','failed:B','start:C','done:C']);
      assert.equal((await readFile(join(dir,'A.png'))).subarray(0,8).toString('hex'),
        '89504e470d0a1a0a');
      assert.equal((await readFile(join(dir,'C.png'))).subarray(0,8).toString('hex'),
        '89504e470d0a1a0a');
      const remaining = await readdir(dir);
      assert.ok(!remaining.some(name=>name.startsWith('.virgostars-chart-')),
        'no staging directories should survive');
    } finally {
      await rm(dir,{recursive:true,force:true});
    }
  });


test('mixed object/file calls preserve submission order despite asynchronous file preparation',
  { timeout: 15_000 }, async () => {
    const dir = await mkdtemp(join(tmpdir(), 'virgostars-export-order-'));
    try {
      const log = join(dir, 'ordered.log');
      const mock = join(dir, 'render.mjs');
      await writeFile(mock, `
        import {readFile,appendFile,writeFile} from 'node:fs/promises';
        const args = process.argv.slice(2);
        const option = name => args[args.indexOf(name) + 1];
        const chart = JSON.parse(await readFile(option('--input'), 'utf8'));
        await appendFile(${JSON.stringify(log)}, chart.tag + '\\n');
        await writeFile(option('--output'), Buffer.from(${JSON.stringify(PNG_BASE64)}, 'base64'));
      `);
      const file = join(dir, 'B.json');
      await writeFile(file, JSON.stringify({ schemaVersion: 1, natal, tag: 'B' }));
      const jobs = [
        renderChart({ schemaVersion: 1, natal, tag: 'A' }, join(dir, 'A.png'), {rendererScript: mock}),
        renderChartFile(file, join(dir, 'B.png'), {rendererScript: mock}),
        renderChart({ schemaVersion: 1, natal, tag: 'C' }, join(dir, 'C.png'), {rendererScript: mock}),
      ];
      const images = await Promise.all(jobs);
      assert.equal(images.length, 3);
      assert.deepEqual((await readFile(log, 'utf8')).trim().split('\n'), ['A', 'B', 'C']);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
