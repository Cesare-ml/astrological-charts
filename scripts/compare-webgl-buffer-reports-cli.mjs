#!/usr/bin/env node
/**
 * Compare two saved, locally generated chart WebGL benchmark reports.
 * Read-only: never connects to the demo, starts a browser or writes files.
 */
import {readFileSync, statSync} from 'node:fs';
import {compareWebGLBufferReports} from './compare-webgl-buffer-reports.mjs';

function readReport(path) {
  const stat = statSync(path);
  if (!stat.isFile() || stat.size < 2 || stat.size > 5_000_000) {
    throw new TypeError('Expected a JSON file between 2 bytes and 5 MB');
  }
  return JSON.parse(readFileSync(path, 'utf8'));
}

if (process.argv.length !== 4 || !process.argv[2] || !process.argv[3]) {
  console.error('Usage: node scripts/compare-webgl-buffer-reports-cli.mjs <chromium.json> <firefox.json>');
  process.exitCode = 2;
} else {
  try {
    const first = readReport(process.argv[2]);
    const second = readReport(process.argv[3]);
    const result = compareWebGLBufferReports(first, second);
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  } catch (error) {
    console.error(`Cannot compare WebGL buffer reports: ${error.message}`);
    process.exitCode = 1;
  }
}
