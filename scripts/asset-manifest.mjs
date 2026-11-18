#!/usr/bin/env node
// Host-owned asset inventory: no PNG, fonts, or other binaries are copied into this package.
import { createHash } from 'node:crypto';
import { createReadStream, lstatSync, readdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const TYPES=new Set(['.png','.jpg','.jpeg','.webp','.svg','.gif','.avif','.bmp','.ico','.woff','.woff2','.ttf','.otf','.json']);
const ROOTS=new Set(['img','fonts']);

export function validatePath(ref) {
  // Match the renderer URL resolver and approved-pack checks: never encode URI
  // delimiters or control bytes in a manifest's literal host-owned file path.
  if(typeof ref!=='string' || !ref || ref.includes('\\') || ref.startsWith('/')
    || /[%?#:\u0000-\u001f\u007f]/.test(ref))
    throw new Error('Invalid asset path: '+String(ref));
  const parts=ref.split('/');
  if(parts.length<2 || !ROOTS.has(parts[0]) || parts.some(p=>!p || p==='.' || p==='..'))
    throw new Error('Expected an img/ or fonts/ relative path: '+ref);
  const ext=extname(ref).toLowerCase();
  if(!TYPES.has(ext) || (ext==='.json' && parts[0]!=='fonts'))
    throw new Error('Unsupported asset file: '+ref);
  return ref;
}

function sortedUnique(refs) {
  const seen=new Set(), folded=new Map();
  for(const ref of refs) {
    validatePath(ref);
    if(seen.has(ref)) throw new Error('Duplicate asset: '+ref);
    seen.add(ref);
    const key=ref.normalize('NFC').toLowerCase();
    if(folded.has(key)) throw new Error('Case-insensitive collision: '+folded.get(key)+' / '+ref);
    folded.set(key,ref);
  }
  return [...refs].sort((a,b)=>a<b?-1:(a>b?1:0));
}

function fromDisk(root) {
  const refs=[];
  function visit(dir,prefix) {
    for(const entry of readdirSync(dir,{withFileTypes:true})) {
      const ref=prefix+'/'+entry.name;
      if(entry.isSymbolicLink()) throw new Error('Symlink forbidden: '+ref);
      if(entry.isDirectory()) visit(join(dir,entry.name),ref);
      else if(entry.isFile() && TYPES.has(extname(ref).toLowerCase())
        && (extname(ref).toLowerCase()!=='.json' || prefix.startsWith('fonts')))
        refs.push(ref);
    }
  }
  for(const folder of ROOTS) {
    let status;
    try { status=lstatSync(join(root,folder)); } catch(err) {
      if(err.code==='ENOENT') continue;
      throw err;
    }
    if(!status.isDirectory()) throw new Error('Invalid asset folder: '+folder);
    visit(join(root,folder),folder);
  }
  return refs;
}

function actualPath(root,ref) {
  validatePath(ref);
  let current=root;
  for(const part of ref.split('/')) {
    current=join(current,part);
    if(lstatSync(current).isSymbolicLink()) throw new Error('Symlink forbidden: '+ref);
  }
  if(!lstatSync(current).isFile()) throw new Error('Asset is not a regular file: '+ref);
  return current;
}

async function hashFile(file) {
  const hash=createHash('sha256');
  let bytes=0;
  for await(const chunk of createReadStream(file)) {
    hash.update(chunk);
    bytes+=chunk.length;
  }
  return {bytes,sha256:hash.digest('hex')};
}

export function fingerprint(files) {
  return createHash('sha256').update(JSON.stringify(files)).digest('hex');
}

export async function generate(rootPath,selected=null) {
  const root=realpathSync(rootPath);
  const paths=sortedUnique(selected===null?fromDisk(root):selected);
  const files=[];
  for(const path of paths) files.push({path,...await hashFile(actualPath(root,path))});
  return {schemaVersion:1,publicRoot:'assets/',algorithm:'sha256',fingerprint:fingerprint(files),files};
}

export function validateManifest(manifest) {
  if(!manifest || manifest.schemaVersion!==1 || manifest.publicRoot!=='assets/'
    || manifest.algorithm!=='sha256' || !Array.isArray(manifest.files))
    throw new Error('Invalid manifest schema');
  // Generated manifests have a canonical order. Reject a reshuffled external
  // manifest even if someone recalculates its fingerprint: compare() and
  // verify() must agree on file ordering on every host/platform.
  const orderedPaths=sortedUnique(manifest.files.map(f=>f.path));
  for(let i=0;i<orderedPaths.length;i++) {
    if(manifest.files[i].path!==orderedPaths[i])
      throw new Error('Manifest files must be in canonical path order: '+manifest.files[i].path);
  }
  for(const f of manifest.files)
    if(!Number.isSafeInteger(f.bytes) || f.bytes<0 || !/^[a-f0-9]{64}$/.test(f.sha256))
      throw new Error('Invalid metadata for '+f.path);
  if(manifest.fingerprint!==fingerprint(manifest.files)) throw new Error('Manifest fingerprint mismatch');
}

export async function verify(root,manifest) {
  validateManifest(manifest);
  const actual=await generate(root,manifest.files.map(f=>f.path));
  for(let i=0;i<actual.files.length;i++) {
    const expected=manifest.files[i],found=actual.files[i];
    if(expected.path!==found.path || expected.bytes!==found.bytes || expected.sha256!==found.sha256)
      throw new Error('Asset mismatch: '+expected.path);
  }
  return true;
}

export function compare(before,after) {
  validateManifest(before);validateManifest(after);
  const a=new Map(before.files.map(f=>[f.path,f]));
  const b=new Map(after.files.map(f=>[f.path,f]));
  const added=[],changed=[],removed=[];
  for(const [path,file] of b) {
    if(!a.has(path)) added.push(path);
    else if(a.get(path).sha256!==file.sha256 || a.get(path).bytes!==file.bytes) changed.push(path);
  }
  for(const path of a.keys()) if(!b.has(path)) removed.push(path);
  return {added,changed,removed};
}

async function cli(argv) {
  const [command,...rest]=argv;
  if(!['generate','verify','diff'].includes(command))
    throw new Error('Usage: generate --root DIR --out FILE --selection FILE.json | verify --root DIR --manifest FILE | diff --before FILE --after FILE');
  const flags={};
  for(let i=0;i<rest.length;i+=2) {
    if(!rest[i]?.startsWith('--') || !rest[i+1] || flags[rest[i]])
      throw new Error('Invalid CLI option: '+String(rest[i]));
    flags[rest[i]]=rest[i+1];
  }
  const json=p=>JSON.parse(readFileSync(p,'utf8'));
  if(command==='generate') {
    if(!flags['--root'] || !flags['--out']) throw new Error('Missing --root or --out');
    if(!flags['--selection'] && flags['--all']!=='yes')
      throw new Error('Provide --selection FILE.json or explicit --all yes');
    const selection=flags['--selection']?json(flags['--selection']):null;
    if(selection!==null && !Array.isArray(selection)) throw new Error('Selection must be JSON array');
    const manifest=await generate(flags['--root'],selection);
    writeFileSync(flags['--out'],JSON.stringify(manifest,null,2)+'\n');
    console.log('Created '+manifest.files.length+' manifest entries; no asset files copied.');
  } else if(command==='verify') {
    if(!flags['--root'] || !flags['--manifest']) throw new Error('Missing --root or --manifest');
    const manifest=json(flags['--manifest']);
    await verify(flags['--root'],manifest);
    console.log('Verified '+manifest.files.length+' assets by SHA-256; no asset files copied.');
  } else {
    if(!flags['--before'] || !flags['--after']) throw new Error('Missing --before or --after');
    console.log(JSON.stringify(compare(json(flags['--before']),json(flags['--after'])),null,2));
  }
}
if(process.argv[1] && resolve(process.argv[1])===resolve(fileURLToPath(import.meta.url)))
  cli(process.argv.slice(2)).catch(err=>{console.error(err.message);process.exitCode=1;});
