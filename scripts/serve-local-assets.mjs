#!/usr/bin/env node
/**
 * Read-only loopback server for the approved astrological-assets pack.
 * Explicit manifest required: unlisted and tampered files are never served.
 */
import { createServer } from 'node:http';
import { existsSync, lstatSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readSafeAsset, verifyApprovedAssetPack, verifyRequestBytes } from './verified-asset-pack.mjs';
import { verifyPrivateAstroOverlay } from './private-astro-overlay.mjs';

const MIME=Object.freeze({
  '.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg',
  '.gif':'image/gif','.webp':'image/webp','.svg':'image/svg+xml',
  '.avif':'image/avif','.bmp':'image/bmp','.ico':'image/x-icon',
  '.woff':'font/woff','.woff2':'font/woff2','.ttf':'font/ttf',
  '.otf':'font/otf','.json':'application/json; charset=utf-8',
});
export const DEFAULT_ORIGINS=['http://localhost:4200','http://127.0.0.1:4200'];
const escapeHtml=value=>String(value).replace(/[&<>"']/g,c=>({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
})[c]);

export function resolveAssetRequest(root,requestPath) {
  if(typeof requestPath!=='string'||!requestPath.startsWith('/assets/'))return null;
  let decoded;
  try { decoded=decodeURIComponent(requestPath); } catch{return null;}
  if(decoded.includes('\\')||decoded.includes('\0')||decoded.includes('%'))return null;
  const parts=decoded.slice('/assets/'.length).split('/');
  if(parts.length<2||!['img','fonts'].includes(parts[0])
    ||parts.some(p=>!p||p==='.'||p==='..'||p.includes(':')))return null;
  const extension=extname(parts.at(-1)).toLowerCase();
  if(!Object.hasOwn(MIME,extension)||(extension==='.json'&&parts[0]!=='fonts'))return null;
  const canonicalRoot=realpathSync(root);
  let current=canonicalRoot;
  for(const part of parts) {
    current=join(current,part);
    if(!existsSync(current)||lstatSync(current).isSymbolicLink())return null;
  }
  if(!current.startsWith(canonicalRoot+sep)||!lstatSync(current).isFile())return null;
  return {path:parts.join('/'),file:current,type:MIME[extension]};
}

function previewHtml(pack) {
  const items=[...pack.paths].slice(0,150).map(([path,meta])=>{
    const src='/assets/'+path.split('/').map(encodeURIComponent).join('/');
    const image=path.startsWith('img/')?
      '<img loading="lazy" src="'+escapeHtml(src)+'" alt="'+escapeHtml(path)+'">':
      '<div class="font">Font / metadata</div>';
    return '<article>'+image+'<p>'+escapeHtml(path)+'</p><small>'+meta.bytes+' bytes</small></article>';
  }).join('');
  return '<!doctype html><html lang="en"><head><meta charset="utf-8">'+
    '<meta name="viewport" content="width=device-width, initial-scale=1">'+
    '<title>Astrological Charts — approved asset preview</title>'+
    '<style>body{margin:0;background:#101826;color:#f4f6fa;font:14px system-ui;padding:24px}'+
    'header{max-width:1000px;margin:auto auto 24px}h1{font-size:26px}'+
    '.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(154px,1fr));gap:12px;max-width:1150px;margin:auto}'+
    'article{background:#202d3e;border:1px solid #3d4b5f;border-radius:10px;padding:12px;overflow-wrap:anywhere}'+
    'img,.font{height:110px;max-width:100%;object-fit:contain;display:block;margin:0 auto 8px}'+
    'p{min-height:42px}small{color:#afbdce}a{color:#b8d7ff}</style></head><body>'+
    '<header><h1>Approved astrology assets — local preview</h1>'+
    '<p>'+pack.count+' approved files, '+pack.totalBytes+' bytes verified by SHA-256.</p>'+
    '<p>This is an <b>asset smoke preview</b>, not yet a full natal-chart renderer. '+
    'Only approved-manifest files are served. No access to VirgoStars is needed.</p></header>'+
    '<div class="grid">'+items+'</div></body></html>';
}

export function createAssetServer({
  root, manifest, origins=DEFAULT_ORIGINS,
  astroOverlayRoot=null, astroOverlayManifest=null, astroOverlayApproval=null
}) {
  if(typeof root!=='string'||!root)throw new Error('Asset root directory is required.');
  if(!manifest)throw new Error('Approved asset manifest required.');
  const absolute=resolve(root);
  if(!existsSync(absolute)||!lstatSync(absolute).isDirectory()||lstatSync(absolute).isSymbolicLink())
    throw new Error('Invalid asset root: '+absolute);
  const pack=verifyApprovedAssetPack(absolute,manifest);
  const overlayArgs=[astroOverlayRoot,astroOverlayManifest,astroOverlayApproval];
  const overlayRequested=overlayArgs.some(value=>value!==null);
  if(overlayRequested && overlayArgs.some(value=>value===null))
    throw new Error('Private Astro overlay requires root, manifest and approval together');
  const overlay=overlayRequested
    ? verifyPrivateAstroOverlay(astroOverlayRoot,astroOverlayManifest,astroOverlayApproval)
    : null;
  const repositoryRoot=realpathSync(resolve(dirname(fileURLToPath(import.meta.url)),'..'));
  const inside=(path,parent)=>path===parent || path.startsWith(parent+sep);
  if(overlay && (inside(overlay.root,pack.root)
    || inside(pack.root,overlay.root)
    || inside(overlay.root,repositoryRoot)))
    throw new Error('Private Astro overlay must remain outside public asset and renderer checkouts');
  if(overlay && [...overlay.paths.keys()].some(path=>pack.paths.has(path)))
    throw new Error('Private Astro overlay collides with approved base asset paths');
  const allowed=new Set(origins);
  for(const origin of allowed) {
    const url=new URL(origin);
    if(url.origin!==origin||!['localhost','127.0.0.1'].includes(url.hostname))
      throw new Error('Only local development origins may be allowed: '+origin);
  }
  return createServer((req,res)=>{
    res.setHeader('Cache-Control','no-store');
    res.setHeader('X-Content-Type-Options','nosniff');
    const origin=req.headers.origin;
    if(origin&&!allowed.has(origin)){res.writeHead(403);res.end('Forbidden origin');return;}
    if(origin){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');}
    if(!['GET','HEAD','OPTIONS'].includes(req.method)){
      res.writeHead(405,{Allow:'GET, HEAD, OPTIONS'});res.end();return;
    }
    if(req.method==='OPTIONS'){
      res.writeHead(204,{'Access-Control-Allow-Methods':'GET, HEAD, OPTIONS'});res.end();return;
    }
    let pathname;
    try{pathname=new URL(req.url,'http://127.0.0.1').pathname;}
    catch{res.writeHead(400);res.end();return;}
    if(pathname==='/__preview'){
      const html=previewHtml(pack);
      res.writeHead(200,{'Content-Type':'text/html; charset=utf-8',
        'Content-Security-Policy':"default-src 'none'; img-src 'self'; style-src 'unsafe-inline';",
        'Content-Length':Buffer.byteLength(html)});
      res.end(req.method==='HEAD'?'':html);return;
    }
    // Select the authorized private manifest entry BEFORE checking filesystem
    // existence. Otherwise a mask deleted/replaced by a symlink after startup
    // falls through to a misleading 404 instead of a fail-closed 409.
    // Manifest keys are strict ASCII paths; encoded aliases are not accepted.
    const manifestPath=pathname.startsWith('/assets/')
      ? pathname.slice('/assets/'.length) : null;
    const privateExpected=manifestPath ? overlay?.paths.get(manifestPath) : null;
    const usePrivate=Boolean(privateExpected);
    const expected=usePrivate ? privateExpected
      : (manifestPath ? pack.paths.get(manifestPath) : null);
    let requested=null;
    try {
      // A directory or root can disappear AFTER startup verification. Treat
      // resolution failures as conflicts for authorized paths, never throw
      // from the HTTP handler or fall back to a different manifest.
      requested=resolveAssetRequest(usePrivate?overlay.root:absolute,pathname);
    } catch {
      res.writeHead(expected?409:404);
      res.end(expected?'Approved asset unavailable or changed':'Not in approved manifest');
      return;
    }
    if(expected && !requested){
      res.writeHead(409);res.end('Approved asset unavailable or changed');return;
    }
    if(!requested||!expected){
      res.writeHead(404);res.end('Not in approved manifest');return;
    }
    try{
      // Both manifests are pinned; recheck bytes on every request.
      const body=readSafeAsset(usePrivate?overlay.root:absolute,requested.path);
      if(!verifyRequestBytes(body,expected)){
        res.writeHead(409);res.end('Pack file changed since verification');return;
      }
      res.writeHead(200,{'Content-Type':requested.type,'Content-Length':body.length});
      res.end(req.method==='HEAD'?'':body);
    }catch{
      res.writeHead(409);res.end('Asset unavailable or changed');return;
    }
  });
}
function run(args){
  const flags={};
  for(let i=0;i<args.length;i+=2){
    if(!['--root','--manifest','--port','--origin',
      '--astro-overlay-root','--astro-overlay-manifest','--astro-overlay-approval'].includes(args[i])
      ||!args[i+1]||Object.hasOwn(flags,args[i]))
      throw new Error('Usage: --root ASSET_DIR --manifest BASE_APPROVED_MANIFEST.json [--astro-overlay-root PRIVATE_MASK_DIR --astro-overlay-manifest PRIVATE_MASK_MANIFEST.json --astro-overlay-approval PRIVATE_APPROVAL.json] [--port 4177] [--origin http://localhost:4200]');
    flags[args[i]]=args[i+1];
  }
  if(!flags['--root']||!flags['--manifest'])
    throw new Error('Both --root and --manifest are required.');
  const port=flags['--port']?Number(flags['--port']):4177;
  if(!Number.isInteger(port)||port<1024||port>65535)
    throw new Error('Port must be between 1024 and 65535');
  const manifest=JSON.parse(readFileSync(flags['--manifest'],'utf8'));
  const optionalJson=path=>path?JSON.parse(readFileSync(path,'utf8')):null;
  const server=createAssetServer({
    root:flags['--root'],manifest,
    origins:flags['--origin']?[flags['--origin']]:DEFAULT_ORIGINS,
    astroOverlayRoot:flags['--astro-overlay-root']??null,
    astroOverlayManifest:optionalJson(flags['--astro-overlay-manifest']),
    astroOverlayApproval:optionalJson(flags['--astro-overlay-approval'])
  });
  server.listen(port,'127.0.0.1',()=>{
    console.log('Approved assets (local only): http://127.0.0.1:'+port+'/assets/');
    console.log('Asset preview: http://127.0.0.1:'+port+'/__preview');
    console.log('Set GestoreImmagini.configurePublicAssetsBase("http://127.0.0.1:'+port+'/assets/") in the local Angular demo.');
    if(flags['--astro-overlay-root'])
      console.log('Private Astro preview overlay active: 22 SHA-256 verified masks (localhost only).');
  });
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(fileURLToPath(import.meta.url))){
  try{run(process.argv.slice(2));}
  catch(e){console.error('APPROVED PACK ERROR:',e.message);process.exitCode=1;}
}
