#!/usr/bin/env node
/**
 * Read-only loopback HTTP server for a separately checked-out chart asset pack.
 * No access to the private VirgoStars source tree is required.
 * No uploads, directory listings, remote bind, or file copies.
 */
import { createServer } from 'node:http';
import { createReadStream, existsSync, lstatSync, realpathSync, statSync } from 'node:fs';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const MIME = Object.freeze({
  '.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg',
  '.gif':'image/gif','.webp':'image/webp','.svg':'image/svg+xml',
  '.avif':'image/avif','.bmp':'image/bmp','.ico':'image/x-icon',
  '.woff':'font/woff','.woff2':'font/woff2','.ttf':'font/ttf',
  '.otf':'font/otf','.json':'application/json; charset=utf-8',
});
export const DEFAULT_ORIGINS = ['http://localhost:4200','http://127.0.0.1:4200'];

export function resolveAssetRequest(root, requestPath) {
  if (typeof requestPath !== 'string' || !requestPath.startsWith('/assets/')) return null;
  let decoded;
  try { decoded = decodeURIComponent(requestPath); } catch { return null; }
  if (decoded.includes('\\') || decoded.includes('\0') || decoded.includes('%')) return null;
  const parts = decoded.slice('/assets/'.length).split('/');
  if (parts.length < 2 || !['img','fonts'].includes(parts[0])
    || parts.some(part => !part || part === '.' || part === '..')) return null;
  const extension = extname(parts.at(-1)).toLowerCase();
  if (!Object.hasOwn(MIME,extension)) return null;
  if (extension === '.json' && parts[0] !== 'fonts') return null;
  const canonicalRoot = realpathSync(root);
  let current = canonicalRoot;
  for (const part of parts) {
    current = join(current,part);
    if (!existsSync(current)) return null;
    if (lstatSync(current).isSymbolicLink()) return null;
  }
  if (!current.startsWith(canonicalRoot + sep) || !statSync(current).isFile()) return null;
  return { file:current, type:MIME[extension], bytes:statSync(current).size };
}

export function createAssetServer({ root, origins = DEFAULT_ORIGINS }) {
  if (!root || typeof root !== 'string') throw new Error('An asset root directory is required.');
  const absolute = resolve(root);
  if (!existsSync(absolute) || !lstatSync(absolute).isDirectory())
    throw new Error('Asset root does not exist: ' + absolute);
  if (lstatSync(absolute).isSymbolicLink()) throw new Error('Asset root symlink is forbidden.');
  const allowed = new Set(origins);
  for (const origin of allowed) {
    const url = new URL(origin);
    if (url.origin !== origin || !['localhost','127.0.0.1'].includes(url.hostname))
      throw new Error('Only local development origins may be allowed: ' + origin);
  }
  return createServer((req,res) => {
    res.setHeader('Cache-Control','no-store');
    res.setHeader('X-Content-Type-Options','nosniff');
    const origin = req.headers.origin;
    if (origin && !allowed.has(origin)) {
      res.writeHead(403);res.end('Forbidden origin');return;
    }
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin',origin);
      res.setHeader('Vary','Origin');
    }
    if (!['GET','HEAD','OPTIONS'].includes(req.method)) {
      res.writeHead(405,{Allow:'GET, HEAD, OPTIONS'});res.end();return;
    }
    if (req.method==='OPTIONS') {
      res.writeHead(204,{'Access-Control-Allow-Methods':'GET, HEAD, OPTIONS'});
      res.end();return;
    }
    let pathname;
    try { pathname = new URL(req.url,'http://127.0.0.1').pathname; }
    catch { res.writeHead(400);res.end();return; }
    const asset = resolveAssetRequest(absolute, pathname);
    if (!asset) {res.writeHead(404);res.end('Not found');return;}
    res.writeHead(200,{'Content-Type':asset.type,'Content-Length':asset.bytes});
    if(req.method==='HEAD'){res.end();return;}
    const stream=createReadStream(asset.file);
    stream.on('error',()=>res.destroy());
    stream.pipe(res);
  });
}
function run(args) {
  const flags={};
  for(let i=0;i<args.length;i+=2) {
    if(!args[i]?.startsWith('--') || !args[i+1] || Object.hasOwn(flags,args[i]))
      throw new Error('Usage: --root ../astrological-assets/public/assets [--port 4177] [--origin http://localhost:4200]');
    flags[args[i]]=args[i+1];
  }
  const port=flags['--port']?Number(flags['--port']):4177;
  if(!Number.isInteger(port) || port<1024 || port>65535) throw new Error('Port must be between 1024 and 65535');
  const origins=flags['--origin']?[flags['--origin']]:DEFAULT_ORIGINS;
  const server=createAssetServer({root:flags['--root'],origins});
  server.listen(port,'127.0.0.1',()=>{
    console.log('Read-only local assets: http://127.0.0.1:'+port+'/assets/');
    console.log('Allowed browser origins: '+origins.join(', '));
    console.log('Configure GestoreImmagini.configurePublicAssetsBase("http://127.0.0.1:'+port+'/assets/") in the local demo only.');
    console.log('Never point this server to confidential user folders. Press Ctrl+C to stop.');
  });
}
if(process.argv[1] && resolve(process.argv[1])===resolve(fileURLToPath(import.meta.url))) {
  try { run(process.argv.slice(2)); }
  catch(err){console.error(err.message);process.exitCode=1;}
}
