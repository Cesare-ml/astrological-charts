#!/usr/bin/env node
/**
 * Compare 2–20 runs of the same browser workload. This only reads JSON
 * reports and never starts a browser or modifies any local files.
 */
import {readFileSync, statSync} from 'node:fs';
import {summarizeWebGLBufferRepeatability} from './summarize-webgl-repeatability.mjs';

const paths = process.argv.slice(2);
if (paths.length < 2 || paths.length > 20) {
  console.error('Usage: node scripts/summarize-webgl-repeatability-cli.mjs <run1.json> <run2.json> [run3.json ... run20.json]');
  process.exitCode = 2;
} else {
  try {
    const reports = paths.map(path => {
      const stat = statSync(path);
      if (!stat.isFile() || stat.size < 2 || stat.size > 5_000_000) {
        throw new TypeError('Each input must be a JSON file between 2 bytes and 5 MB');
      }
      return JSON.parse(readFileSync(path, 'utf8'));
    });
    process.stdout.write(JSON.stringify(summarizeWebGLBufferRepeatability(reports), null, 2) + '\n');
  } catch (error) {
    console.error(`Cannot summarize WebGL repeatability: ${error.message}`);
    process.exitCode = 1;
  }
}
