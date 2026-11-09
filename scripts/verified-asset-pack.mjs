#!/usr/bin/env node
/**
 * Validate the approved-assets manifest from astrological-assets.
 * No production image is bundled or downloaded.
 */
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, readFileSync, realpathSync } from 'node:fs';
import { extname, join } from 'node:path';

const allowedTypes = new Set(['.png','.jpg','.jpeg','.webp','.gif','.svg','.avif','.bmp','.ico','.woff','.woff2','.ttf','.otf','.json']);

export function validatePackPath(path) {
  if (typeof path !== 'string' || !path || path.includes('\\') || path.includes('\0')
    || path.startsWith('/') || path.includes('%') || path.includes('?') || path.includes('#'))
    throw new Error('Unsafe asset path: ' + String(path));
  const parts=path.split('/');
  if(parts.length<2 || !['img','fonts'].includes(parts[0])
    || parts.some(x=>!x || x==='.' || x==='..' || x.includes(':')))
    throw new Error('Unsafe asset path: ' + path);
  const ext=extname(path).toLowerCase();
  if(!allowedTypes.has(ext) || (ext==='.json' && parts[0]!=='fonts'))
    throw new Error('Unsupported asset type: ' + path);
  return path;
}
export function readSafeAsset(root,path) {
  validatePackPath(path);
  let current=root;
  for(const part of path.split('/')) {
    current=join(current,part);
    if(!existsSync(current)) throw new Error('Pack asset missing: '+path);
    const st=lstatSync(current);
    if(st.isSymbolicLink()) throw new Error('Pack asset symlink forbidden: '+path);
  }
  if(!lstatSync(current).isFile()) throw new Error('Asset is not a regular file: '+path);
  return readFileSync(current);
}

export function verifyApprovedAssetPack(rootPath,manifest) {
  if(!manifest || manifest.schemaVersion!==1 || !Array.isArray(manifest.assets)
    || manifest.assets.length===0)
    throw new Error('Expected a nonempty astrological-assets approved manifest (schemaVersion 1).');
  if(typeof rootPath!=='string' || !rootPath.trim()) throw new Error('Asset root is required');
  const root=realpathSync(rootPath);
  if(!lstatSync(root).isDirectory()) throw new Error('Asset root must be a directory');
  const paths=new Map();
  const folded=new Set();
  let totalBytes=0;
  for(const record of manifest.assets) {
    const path=validatePackPath(record?.path);
    const key=path.normalize('NFC').toLowerCase();
    if(folded.has(key)) throw new Error('Case-colliding or duplicate path: '+path);
    folded.add(key);
    if(!Number.isSafeInteger(record.bytes) || record.bytes<0
      || !/^[0-9a-f]{64}$/.test(record.sha256))
      throw new Error('Invalid asset size or SHA-256: '+path);
    for(const field of ['rightsHolder','permissionBasis','approvalEvidence'])
      if(typeof record[field]!=='string' || !record[field].trim())
        throw new Error('Missing explicit approval metadata '+field+': '+path);
    const bytes=readSafeAsset(root,path);
    if(bytes.length!==record.bytes ||
      createHash('sha256').update(bytes).digest('hex')!==record.sha256)
      throw new Error('Asset differs from approved manifest: '+path);
    paths.set(path,{bytes:record.bytes,sha256:record.sha256});
    totalBytes+=bytes.length;
  }
  return {root,paths,totalBytes,count:paths.size};
}

export function verifyRequestBytes(buffer,expected) {
  return Boolean(expected) && buffer.length===expected.bytes &&
    createHash('sha256').update(buffer).digest('hex')===expected.sha256;
}
