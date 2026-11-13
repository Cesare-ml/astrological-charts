import assert from 'node:assert/strict';
import { test } from 'node:test';
import { once } from 'node:events';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createAssetServer, resolveAssetRequest } from '../scripts/serve-local-assets.mjs';
import { validatePackPath } from '../scripts/verified-asset-pack.mjs';
import { generateSyntheticPack, sourcePreloadPaths, makeSyntheticPng } from '../scripts/generate-synthetic-pack.mjs';

async function withAssetServer(fn) {
  const dir=mkdtempSync(join(tmpdir(),'chart-asset-preview-'));
  const fixture=generateSyntheticPack(join(dir,'synthetic'));
  const {root,manifest}=fixture;
  const file='img/simboli-bianchi/segni/01.png';
  const server=createAssetServer({root,manifest});
  server.listen(0,'127.0.0.1');
  await once(server,'listening');
  try {await fn({root,dir,file,manifest,url:'http://127.0.0.1:'+server.address().port});}
  finally {
    await new Promise(resolve=>server.close(resolve));
    rmSync(dir,{recursive:true,force:true});
  }
}

test('generates 78 original valid PNG fixtures with the same legacy filenames',()=>{
  const dir=mkdtempSync(join(tmpdir(),'chart-synthetic-'));
  try {
    const pack=generateSyntheticPack(join(dir,'new'));
    assert.equal(pack.manifest.assets.length,78);
    assert.equal(new Set(pack.manifest.assets.map(x=>x.path)).size,78);
    assert.ok(pack.manifest.assets.every(x=>x.path.endsWith('.png')&&x.permissionBasis.includes('synthetic')));
    const png=makeSyntheticPng('img/simboli-bianchi/segni/01.png');
    assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
    assert.equal(png.readUInt32BE(16),48);
    assert.throws(()=>generateSyntheticPack(join(dir,'new')),/already exists/);
  } finally{rmSync(dir,{recursive:true,force:true});}
});

test('synthetic source extraction fails on accidental changes to preload coverage',()=>{
  assert.throws(()=>sourcePreloadPaths('public static preloadArraySimboli = ["/assets/img/abc.png"];'),/exactly 78/);
  assert.throws(()=>sourcePreloadPaths('no preload here'),/Preload list missing/);
});

test('independent localhost server serves verified PNG files without VirgoStars access',async()=>{
  await withAssetServer(async({url})=>{
    const r=await fetch(url+'/assets/img/simboli-bianchi/segni/01.png',{
      headers:{Origin:'http://localhost:4200'}
    });
    assert.equal(r.status,200);
    assert.equal(r.headers.get('content-type'),'image/png');
    assert.equal(r.headers.get('access-control-allow-origin'),'http://localhost:4200');
    assert.equal(Buffer.from(await r.arrayBuffer()).subarray(0,8).toString('hex'),'89504e470d0a1a0a');
    const head=await fetch(url+'/assets/img/simboli-bianchi/segni/01.png',{method:'HEAD'});
    assert.equal(head.status,200);
    const preview=await fetch(url+'/__preview');
    assert.equal(preview.status,200);
    const html=await preview.text();
    assert.ok(html.includes('78 approved files'));
    assert.ok(html.includes('img/simboli-bianchi/segni/01.png'));
  });
});

test('refuses unapproved assets, outside origins, traversal and writing',async()=>{
  await withAssetServer(async({url,root})=>{
    writeFileSync(join(root,'img','unapproved.png'),makeSyntheticPng('unapproved'));
    assert.equal((await fetch(url+'/assets/img/unapproved.png')).status,404);
    assert.equal((await fetch(url+'/assets/img/unapproved.json')).status,404);
    assert.equal((await fetch(url+'/assets/')).status,404);
    assert.equal((await fetch(url+'/assets/img/../secret.txt')).status,404);
    assert.equal((await fetch(url+'/assets/img/simboli-bianchi/segni/01.png',{method:'POST'})).status,405);
    assert.equal((await fetch(url+'/assets/img/simboli-bianchi/segni/01.png',{
      headers:{Origin:'https://evil.example'}
    })).status,403);
    assert.equal(resolveAssetRequest(root,'/assets/img/../../secret.txt'),null);
  });
});

test('rejects an altered approved file even after the server has started',async()=>{
  await withAssetServer(async({url,root,file})=>{
    writeFileSync(join(root,...file.split('/')),'changed');
    const r=await fetch(url+'/assets/'+file);
    assert.equal(r.status,409);
  });
});

test('CORS preflight and HEAD never bypass local origin or asset integrity checks',async()=>{
  await withAssetServer(async({url,root,file})=>{
    const path='/assets/'+file;
    const options=await fetch(url+path,{
      method:'OPTIONS',headers:{Origin:'http://127.0.0.1:4200'}
    });
    assert.equal(options.status,204);
    assert.equal(options.headers.get('access-control-allow-origin'),'http://127.0.0.1:4200');
    assert.match(options.headers.get('access-control-allow-methods'),/HEAD/);
    const rejected=await fetch(url+path,{
      method:'OPTIONS',headers:{Origin:'https://evil.example'}
    });
    assert.equal(rejected.status,403);
    writeFileSync(join(root,...file.split('/')),'tampered after startup');
    const head=await fetch(url+path,{method:'HEAD'});
    assert.equal(head.status,409);
    assert.equal((await head.arrayBuffer()).byteLength,0);
  });
});

test('OPTIONS rejects unknown paths and files modified after startup',async()=>{
  await withAssetServer(async({url,root,file})=>{
    const headers={Origin:'http://localhost:4200','Access-Control-Request-Method':'GET'};
    const unknown=await fetch(url+'/assets/img/not-approved.png',{method:'OPTIONS',headers});
    assert.equal(unknown.status,404);
    const valid=await fetch(url+'/assets/'+file,{method:'OPTIONS',headers});
    assert.equal(valid.status,204);
    writeFileSync(join(root,...file.split('/')),'tampered after preflight');
    const changed=await fetch(url+'/assets/'+file,{method:'OPTIONS',headers});
    assert.equal(changed.status,409);
    assert.equal(changed.headers.get('cache-control'),'no-store');
  });
});

test('preflight rejects unsupported requested methods without exposing assets',async()=>{
  await withAssetServer(async({url,file})=>{
    const path='/assets/'+file;
    const headers={Origin:'http://localhost:4200','Access-Control-Request-Method':'POST'};
    const denied=await fetch(url+path,{method:'OPTIONS',headers});
    assert.equal(denied.status,405);
    assert.equal(denied.headers.get('allow'),'GET, HEAD, OPTIONS');
    assert.equal(denied.headers.get('cache-control'),'no-store');
    const allowed=await fetch(url+path,{method:'OPTIONS',headers:{...headers,'Access-Control-Request-Method':'HEAD'}});
    assert.equal(allowed.status,204);
    const get=await fetch(url+path,{method:'GET'});
    assert.equal(get.status,200);
  });
});

test('preflight responses remain origin-specific and non-cacheable',async()=>{
  await withAssetServer(async({url,file})=>{
    const path='/assets/'+file;
    for(const origin of ['http://localhost:4200','http://127.0.0.1:4200']){
      const response=await fetch(url+path,{
        method:'OPTIONS',
        headers:{Origin:origin,'Access-Control-Request-Method':'GET'}
      });
      assert.equal(response.status,204);
      assert.equal(response.headers.get('access-control-allow-origin'),origin);
      assert.match(response.headers.get('vary')??'',/(^|,\\s*)Origin(,|$)/i);
      assert.equal(response.headers.get('cache-control'),'no-store');
      assert.equal((await response.arrayBuffer()).byteLength,0);
    }
    const denied=await fetch(url+path,{
      method:'OPTIONS',headers:{Origin:'https://outside.example','Access-Control-Request-Method':'GET'}
    });
    assert.equal(denied.status,403);
    assert.equal(denied.headers.get('access-control-allow-origin'),null);
    assert.equal(denied.headers.get('cache-control'),'no-store');
  });
});

test('asset checkout removal fails closed for GET and OPTIONS without crashing server',async()=>{
  await withAssetServer(async({url,root,file})=>{
    rmSync(root,{recursive:true,force:true});
    const path='/assets/'+file;
    const headers={Origin:'http://localhost:4200'};
    const preflight=await fetch(url+path,{method:'OPTIONS',headers});
    assert.equal(preflight.status,404);
    const get=await fetch(url+path,{headers});
    assert.equal(get.status,404);
    const preview=await fetch(url+'/__preview');
    assert.equal(preview.status,200);
  });
});

test('requires an approved manifest with valid SHA-256 and safe local origins',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'chart-verified-'));
  try {
    const {root,manifest}=generateSyntheticPack(join(dir,'pack'));
    assert.throws(()=>createAssetServer({root}),/manifest required/);
    assert.throws(()=>createAssetServer({root,manifest,origins:['https://other.example']}),/Only local/);
    const altered=structuredClone(manifest);
    altered.assets[0].sha256='a'.repeat(64);
    assert.throws(()=>createAssetServer({root,manifest:altered}),/differs from approved manifest/);
    const unlicensed=structuredClone(manifest);
    unlicensed.assets[0].permissionBasis='';
    assert.throws(()=>createAssetServer({root,manifest:unlicensed}),/Missing explicit approval metadata/);
    const pending=structuredClone(manifest);
    pending.assets[0].status='pending';
    assert.throws(()=>createAssetServer({root,manifest:pending}),/not approved/);
  }finally{rmSync(dir,{recursive:true,force:true});}
});

test('server rejects symlinked approved assets (where supported)',async t=>{
  await withAssetServer(async({root,dir,file})=>{
    const path=join(root,...file.split('/'));
    const other=join(dir,'other.png');
    writeFileSync(other,makeSyntheticPng('other'));
    rmSync(path);
    try{symlinkSync(other,path);}
    catch(err){
      if(process.platform==='win32'&&['EPERM','EACCES','UNKNOWN'].includes(err.code)){
        t.skip('This Windows account cannot create symlinks');
        return;
      }
      throw err;
    }
    assert.equal(resolveAssetRequest(root,'/assets/'+file),null);
  });
});

test('approved-pack path validation rejects control bytes and ambiguous URLs', () => {
  for (const path of [
    'img/planet%2e.png',
    'img/planet?.png',
    'img/planet#.png',
    'img/planet:alt.png',
    'img/planet\n.png',
    'img/planet\u007f.png',
  ]) assert.throws(() => validatePackPath(path), /Unsafe asset path/);
  assert.equal(validatePackPath('img/mean Apogee.png'), 'img/mean Apogee.png');
});
