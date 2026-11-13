/**
 * Best-effort, local provenance for a manual WebGL benchmark run.
 * Only commit IDs, a tracked-file dirty flag and a manifest digest are exposed.
 * These hints do not attest the dev-server bundle or actual browser requests.
 */
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFileSync, statSync} from 'node:fs';
import {join} from 'node:path';

const SHA1 = /^[0-9a-f]{40}$/;
const MAX_MANIFEST_BYTES = 5_000_000;

function git(args, cwd) {
  return execFileSync('git', args, {
    cwd, encoding: 'utf8', timeout: 5_000,
    stdio: ['ignore', 'pipe', 'ignore'],
  });
}

export function collectWebGLBenchmarkProvenance({
  cwd = process.cwd(),
  manifestPath = process.env.CHART_BUFFER_ASSET_MANIFEST,
  runGit = git,
  read = readFileSync,
  stat = statSync,
} = {}) {
  let sourceRevision = null;
  let sourceDirty = null;
  try {
    const revision = runGit(['rev-parse', '--verify', 'HEAD'], cwd).trim();
    if (SHA1.test(revision)) {
      sourceRevision = revision;
      sourceDirty = runGit(['status', '--porcelain', '--untracked-files=no'], cwd).trim().length > 0;
    }
  } catch {
    // Unavailable Git metadata must never be mistaken for a clean checkout.
  }

  const explicitManifest = manifestPath !== undefined;
  const path = explicitManifest
    ? manifestPath
    : join(cwd, '.local', 'demo-pack', 'manifests', 'approved-assets.json');
  let assetManifestSha256 = null;
  try {
    const info = stat(path);
    if (!info.isFile() || info.size <= 0 || info.size > MAX_MANIFEST_BYTES) {
      throw new Error('Benchmark asset manifest must be a nonempty file at most 5 MB');
    }
    assetManifestSha256 = createHash('sha256').update(read(path)).digest('hex');
  } catch (error) {
    if (explicitManifest || error.code !== 'ENOENT') throw error;
    // Synthetic demo pack may not exist in a standalone contributor checkout.
  }
  return {sourceRevision, sourceDirty, assetManifestSha256};
}
