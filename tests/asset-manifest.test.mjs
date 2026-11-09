import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generate, verify, compare, validateManifest } from '../scripts/asset-manifest.mjs';

async function fixture(fn) {
  const root=mkdtempSync(join(tmpdir(),'charts-asset-test-'));
  try {
    mkdirSync(join(root,'img','zodiac'),{recursive:true});
    mkdirSync(join(root,'fonts'));
    writeFileSync(join(root,'img','zodiac','Sun.png'),'sun');
    writeFileSync(join(root,'img','zodiac','Moon.png'),'moon');
    writeFileSync(join(root,'fonts','font.woff2'),'font');
    return await fn(root);
  } finally { rmSync(root,{recursive:true,force:true}); }
}

test('stable manifest, canonical paths and file-level integrity',async()=>{
  await fixture(async root=>{
    const a=await generate(root),b=await generate(root);
    assert.deepEqual(a,b);
    assert.deepEqual(a.files.map(f=>f.path),[
      'fonts/font.woff2','img/zodiac/Moon.png','img/zodiac/Sun.png'
    ]);
    assert.equal(a.files[2].bytes,3);
    assert.equal(await verify(root,a),true);
    assert.equal(a.publicRoot,'assets/');
  });
});

test('select only required images and compare changed versions',async()=>{
  await fixture(async root=>{
    const first=await generate(root,['img/zodiac/Sun.png']);
    const second=await generate(root,['fonts/font.woff2','img/zodiac/Sun.png']);
    assert.deepEqual(compare(first,second),{
      added:['fonts/font.woff2'],changed:[],removed:[]
    });
    writeFileSync(join(root,'img','zodiac','Sun.png'),'changed');
    await assert.rejects(()=>verify(root,first),/Asset mismatch/);
    const third=await generate(root,['img/zodiac/Sun.png']);
    assert.deepEqual(compare(first,third),{
      added:[],changed:['img/zodiac/Sun.png'],removed:[]
    });
  });
});

test('reject traversal, duplicate names and case collisions',async()=>{
  await fixture(async root=>{
    await assert.rejects(()=>generate(root,['../.env']),/relative path/);
    await assert.rejects(()=>generate(root,['img/zodiac/Sun.png','img/zodiac/Sun.png']),/Duplicate/);
    await assert.rejects(()=>generate(root,['img/zodiac/Sun.png','img/zodiac/sun.png']),/collision/);
  });
});

test('reject symlinks and tampered manifests',async()=>{
  await fixture(async root=>{
    const m=await generate(root);
    m.files[0].bytes=100;
    assert.throws(()=>validateManifest(m),/fingerprint mismatch/);
    symlinkSync(join(root,'img','zodiac','Sun.png'),join(root,'img','zodiac','linked.png'));
    await assert.rejects(()=>generate(root),/Symlink forbidden/);
  });
});
