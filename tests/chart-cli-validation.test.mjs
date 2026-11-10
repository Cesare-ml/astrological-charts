/* Local chart CLI rejects malformed input before installing/launching Chromium.
 * Copyright (c) 2026 Cesare-ml (VirgoStars project); CPAL-1.0.
 *
 * No node_modules, browser, WebGL, or original artwork needed.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cli = join(root, 'scripts', 'render-chart.mjs');

const natal = {
  datetime: '2000-01-01T12:00:00Z',
  ascendant: 20, midheaven: 290,
  houseCusps: Array.from({ length: 12 }, (_,i)=>(20+i*30)%360),
  planets: {Sun: {longitude: 42, latitude: 0}},
};

test('CLI help works without starting npm dependencies or browser',async()=>{
  const result=await execFileAsync(process.execPath,[cli,'--help'],{cwd:root});
  assert.match(result.stdout,/Usage: node scripts\/render-chart.mjs/);
});

test('CLI rejects malformed precomputed JSON before starting local web services',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'virgostars-cli-validation-'));
  try{
    const cases=[
      ['missing-natal',JSON.stringify({schemaVersion:1}),/natal must be a JSON object/],
      ['missing-transits',JSON.stringify({schemaVersion:1,natal,mode:'transits'}),/transits data is required/],
      ['override-transits',JSON.stringify({schemaVersion:1,natal}),/transits data is required/,'transits'],
      ['invalid-latitude',JSON.stringify({schemaVersion:1,natal:{...natal,planets:{Sun:{longitude:15,latitude:95}}}}),/latitude must be between -90 and 90/],
      ['bad-json','{ malformed',/Invalid chart JSON file/],
      ['too-large',' '.repeat(1_000_001),/exceeds the 1 MB/],
    ];
    for(const [name,raw,message,mode] of cases){
      const input=join(dir,name+'.json');
      await writeFile(input,raw);
      const args=[cli,'--input',input,'--output',join(dir,name+'.png')];
      if(mode)args.push('--mode',mode);
      await assert.rejects(
        execFileAsync(process.execPath,args,{cwd:root}),
        error=>message.test(String(error.stderr||error.message)),
        name+': expected a useful validation error before browser setup');
    }
  }finally{await rm(dir,{recursive:true,force:true});}
});

test('validate-only accepts complete charts without npm, browser or output image', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'virgostars-valid-chart-'));
  try {
    const input = join(dir, 'chart.json');
    const output = join(dir, 'should-not-exist.png');
    await writeFile(input, JSON.stringify({schemaVersion: 1, natal}));
    const {stdout} = await execFileAsync(process.execPath, [
      cli, '--input', input, '--validate-only', '--output', output,
    ], {cwd: root});
    assert.match(stdout, /Valid chart JSON v1/);
    assert.match(stdout, /No browser started/);
    await assert.rejects(
      execFileAsync(process.execPath, [
        cli, '--input', input, '--validate-only', '--mode', 'transits',
      ], {cwd: root}), /transits data is required/);
    const {access} = await import('node:fs/promises');
    await assert.rejects(access(output), /ENOENT/,
      'validate-only must never generate or overwrite a chart image');
  } finally {
    await rm(dir, {recursive: true, force: true});
  }
});

test('CLI rejects missing option values and duplicate flags without attempting rendering', async () => {
  const options = [
    ['--input', '--validate-only'],
    ['--input', 'x.json', '--mode', '--validate-only'],
    ['--input', 'x.json', '--input', 'y.json', '--validate-only'],
    ['--input', 'x.json', '--validate-only', '--validate-only'],
    ['--validate-only', '--output', '--mode'],
  ];
  for (const args of options) {
    await assert.rejects(
      execFileAsync(process.execPath, [cli, ...args], {cwd: root}),
      /Unknown, duplicate or missing argument|Duplicate --validate-only/,
      'invalid command-line options must fail before checking filesystem');
  }
});
