/* Astrological Charts — Copyright (c) 2026 Cesare-ml (VirgoStars).
 * CPAL-1.0; see ../LICENSE and Exhibits A/B.
 *
 * Explicit opt-in only: validate owner-authorized external binary
 * assets before launching Angular or Chrome. Never import a private
 * manifest merely because a sibling directory exists.
 */
import { readFileSync } from 'node:fs';
import { verifyApprovedAssetPack } from './verified-asset-pack.mjs';

/** Inspect the exact local binary bytes, not only manifest metadata.
 * The external directory is never copied, committed or uploaded.
 */
export function loadVerifiedExternalRenderPack(assetRoot, assetManifestPath) {
  if (typeof assetRoot !== 'string' || !assetRoot.trim() ||
      typeof assetManifestPath !== 'string' || !assetManifestPath.trim()) {
    throw new TypeError('Both external asset root and approved manifest paths are required.');
  }
  const manifest = JSON.parse(readFileSync(assetManifestPath, 'utf8'));
  const source = manifest?.source?.repository;
  if (typeof source !== 'string' || !source.trim() ||
      source === 'synthetic-local-fixtures') {
    throw new Error('External render mode requires a separately approved, non-synthetic asset manifest.');
  }
  const verified = verifyApprovedAssetPack(assetRoot, manifest);
  return { manifest, verified };
}
