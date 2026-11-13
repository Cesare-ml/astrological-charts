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

export function createAssetServer({root,manifest,origins=DEFAULT_ORIGINS}) {
  if(typeof root!=='string'||!root)throw new Error('Asset root directory is required.');
  if(!manifest)throw new Error('Approved asset manifest required.');
  const absolute=resolve(root);
  if(!existsSync(absolute)||!lstatSync(absolute).isDirectory()||lstatSync(absolute).isSymbolicLink())
    throw new Error('Invalid asset root: '+absolute);
  const pack=verifyApprovedAssetPack(absolute,manifest);
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
      const requestedMethod=req.headers['access-control-request-method'];
      if(requestedMethod&&!['GET','HEAD','OPTIONS'].includes(requestedMethod)){
        res.writeHead(405,{Allow:'GET, HEAD, OPTIONS'});res.end();return;
      }
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
    const requested=resolveAssetRequest(absolute,pathname);
    if(!requested||!pack.paths.has(requested.path)){
      res.writeHead(404);res.end('Not in approved manifest');return;
    }
    try{
      // Recheck integrity on each request to avoid accidentally serving a changed asset.
      const body=readSafeAsset(absolute,requested.path);
      if(!verifyRequestBytes(body,pack.paths.get(requested.path))){
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
    if(!['--root','--manifest','--port','--origin'].includes(args[i])
      ||!args[i+1]||Object.hasOwn(flags,args[i]))
      throw new Error('Usage: --root ../astrological-assets/public/assets --manifest ../astrological-assets/manifests/approved-assets.json [--port 4177] [--origin http://localhost:4200]');
    flags[args[i]]=args[i+1];
  }
  if(!flags['--root']||!flags['--manifest'])
    throw new Error('Both --root and --manifest are required.');
  const port=flags['--port']?Number(flags['--port']):4177;
  if(!Number.isInteger(port)||port<1024||port>65535)
    throw new Error('Port must be between 1024 and 65535');
  const manifest=JSON.parse(readFileSync(flags['--manifest'],'utf8'));
  const server=createAssetServer({
    root:flags['--root'],manifest,
    origins:flags['--origin']?[flags['--origin']]:DEFAULT_ORIGINS
  });
  server.listen(port,'127.0.0.1',()=>{
    console.log('Approved assets (local only): http://127.0.0.1:'+port+'/assets/');
    console.log('Asset preview: http://127.0.0.1:'+port+'/__preview');
    console.log('Set GestoreImmagini.configurePublicAssetsBase("http://127.0.0.1:'+port+'/assets/") in the local Angular demo.');
  });
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(fileURLToPath(import.meta.url))){
  try{run(process.argv.slice(2));}
  catch(e){console.error('APPROVED PACK ERROR:',e.message);process.exitCode=1;}
}
