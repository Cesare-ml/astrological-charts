#!/usr/bin/env node
/**
 * Summarize a previously saved benchmark-webgl-buffers JSON report.
 * Read-only, local and dependency-free; it never launches a browser.
 */
import {readFileSync, statSync} from 'node:fs';
import {analyzeWebGLBufferReport} from './analyze-webgl-buffer-report.mjs';

if (process.argv.length !== 3 || !process.argv[2]) {
  console.error('Usage: node scripts/summarize-webgl-buffer-report.mjs <benchmark-report.json>');
  process.exitCode = 2;
} else {
  try {
    const path = process.argv[2];
    const stats = statSync(path);
    if (!stats.isFile() || stats.size < 2 || stats.size > 5_000_000) {
      throw new Error('Expected a JSON file between 2 bytes and 5 MB');
    }
    const summary = analyzeWebGLBufferReport(JSON.parse(readFileSync(path, 'utf8')));
    process.stdout.write(JSON.stringify(summary, null, 2) + '\n');
  } catch (error) {
    console.error(`WebGL report analysis failed: ${error.message}`);
    process.exitCode = 1;
  }
}
