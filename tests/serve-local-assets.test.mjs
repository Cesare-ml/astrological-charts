import assert from 'node:assert/strict';
import { test } from 'node:test';
import { once } from 'node:events';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createAssetServer, resolveAssetRequest } from '../scripts/serve-local-assets.mjs';

async function withAssetServer(fn) {
  const dir=mkdtempSync(join(tmpdir(),'chart-asset-server-'));
  const root=join(dir,'public','assets');
  const img=join(root,'img','simboli-bianchi','segni');
  mkdirSync(img,{recursive:true});
  mkdirSync(join(root,'fonts'),{recursive:true});
  writeFileSync(join(img,'01.png'),Buffer.from('test-image'));
  writeFileSync(join(root,'fonts','sample.woff2'),Buffer.from('fake-font'));
  writeFileSync(join(dir,'secret.txt'),'secret');
  const server=createAssetServer({root});
  server.listen(0,'127.0.0.1');
  await once(server,'listening');
  try { await fn({root,dir,url:'http://127.0.0.1:'+server.address().port}); }
  finally {
    await new Promise(resolve=>server.close(resolve));
    rmSync(dir,{recursive:true,force:true});
  }
}
test('local collaborator can load host-owned imagery without the VirgoStars repository',async()=>{
  await withAssetServer(async({url})=>{
    const r=await fetch(url+'/assets/img/simboli-bianchi/segni/01.png',{
      headers:{Origin:'http://localhost:4200'}
    });
    assert.equal(r.status,200);
    assert.equal(r.headers.get('content-type'),'image/png');
    assert.equal(r.headers.get('access-control-allow-origin'),'http://localhost:4200');
    assert.equal(Buffer.from(await r.arrayBuffer()).toString(),'test-image');
    const head=await fetch(url+'/assets/fonts/sample.woff2',{method:'HEAD'});
    assert.equal(head.status,200);
    assert.equal(head.headers.get('content-type'),'font/woff2');
  });
});
test('server refuses outside origins and methods; no file listings or traversal',async()=>{
  await withAssetServer(async({url,root})=>{
    const r=await fetch(url+'/assets/img/simboli-bianchi/segni/01.png',{
      headers:{Origin:'https://evil.example'}
    });
    assert.equal(r.status,403);
    assert.equal((await fetch(url+'/assets/')).status,404);
    assert.equal((await fetch(url+'/assets/img/../secret.txt')).status,404);
    assert.equal((await fetch(url+'/assets/img/simboli-bianchi/segni/01.png',{method:'POST'})).status,405);
    assert.equal(resolveAssetRequest(root,'/assets/img/../../secret.txt'),null);
    assert.equal(resolveAssetRequest(root,'/assets/img/foo.json'),null);
  });
});
test('server rejects symlinked files and invalid development roots',async t=>{
  await withAssetServer(async({root,dir})=>{
    assert.throws(()=>createAssetServer({root:join(dir,'missing')}),/does not exist/);
    assert.throws(()=>createAssetServer({root,origins:['https://anything.example']}),/Only local/);
    try {symlinkSync(join(dir,'secret.txt'),join(root,'img','secret.png')); }
    catch(err) {
      if(process.platform==='win32' && ['EPERM','EACCES','UNKNOWN'].includes(err.code)) {
        t.skip('No Windows symlink privileges');
        return;
      }
      throw err;
    }
    assert.equal(resolveAssetRequest(root,'/assets/img/secret.png'),null);
  });
});
