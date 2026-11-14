import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';

const source = readFileSync(
  new URL('../src/lib/renderers/oggetti-semplici.renderer.ts', import.meta.url),
  'utf8',
);
// Transpile the real renderer source. Other Three.js factories are deliberately
// not exercised; this unit test records arc geometry operations without a GPU.
const withoutImports = source.replace(/^import [^\n]*\n/gm, '');
const stubs = 