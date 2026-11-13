import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

// Exercise the committed server's real route-selection block in isolation.
// This test requires only Node builtins (no sharp, Angular, private PNGs,
// rights metadata or network port). The full HTTP server is covered by
// tests/private-astro-overlay.test.mjs when npm dependencies are available.
const source=readFileSync(
  new URL('../scripts/serve-local-assets.mjs',import.meta.url),'utf8');
const marker="    const manifestPath=pathname.startsWith('/assets/')";
const start=source.indexOf(marker);
const end=source.indexOf("    try{",source.indexOf("    if(!requested||!expected){",start));
assert.ok(start>=0&&end>start,'Could not extract approved route handling from local asset server');
const router=new Function('pathname','overlay','pack','absolute','resolveAssetRequest','res',
  source.slice(start,end)+'\nreturn {status:200,root:usePrivate?overlay.root:absolute,path:requested.path};'
);
const mask='img/virgostars-astro/masks/aries.png';
const basePath='img/simboli-bianchi/segni/01.png';
const overlay={root:'/private',paths:new Map([[mask,{sha256:'mask-sha'}]])};
const pack={root:'/base',paths:new Map([[basePath,{sha256:'base-sha'}]])};

function check({path,missing=[],failRoot=null,status}) {
  const res={
    status:null,
    writeHead(code){this.status=code;},
    end(){},
  };
  const resolveMock=(root,pathname)=>{
    if(failRoot===root)throw new Error('ENOENT: root disappeared');
    if(!pathname.startsWith('/assets/'))return null;
    const name=pathname.slice('/assets/'.length);
    if(missing.includes(root+'/'+name))return null;
    if((root==='/private'&&name===mask)
      ||(root==='/base'&&name===basePath))return {path:name};
    return null;
  };
  const result=router(path,overlay,pack,'/base',resolveMock,res);
  assert.equal(result?.status??res.status,status,path);
}

test('both verified packs can serve approved paths without cross-manifest fallback',()=>{
  check({path:'/assets/'+mask,status:200});
  check({path:'/assets/'+basePath,status:200});
});
test('post-start deletion of either approved path gives conflict, never 404',()=>{
  check({path:'/assets/'+mask,missing:['/private/'+mask],status:409});
  check({path:'/assets/'+basePath,missing:['/base/'+basePath],status:409});
});
test('root disappearance is handled without throwing from HTTP callback',()=>{
  check({path:'/assets/'+mask,failRoot:'/private',status:409});
  check({path:'/assets/'+basePath,failRoot:'/base',status:409});
});
test('unknown/encoded paths still return 404, including after a root disappears',()=>{
  check({path:'/assets/img/virgostars-astro/masks/nope.png',status:404});
  check({path:'/assets/img/virgostars-astro/masks/nope.png',failRoot:'/base',status:404});
  check({path:'/assets/img/virgostars-astro/masks/%61ries.png',status:404});
  check({path:'/outside/aries.png',status:404});
});
