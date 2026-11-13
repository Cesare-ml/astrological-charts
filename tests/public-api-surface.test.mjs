import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';

// Stable entry-point checks, intentionally independent of Angular and WebGL.
const publicApiSource = readFileSync(new URL('../src/public-api.ts', import.meta.url), 'utf8');
const exportFrom = /^\s*export\s+(?:\*|\{[^}]*\})\s+from\s+['"]([^'"]+)['"]\s*;?/gm;
const targets = [...publicApiSource.matchAll(exportFrom)].map(match => match[1]);

test('public API re-exports each source module at most once', () => {
  assert.ok(targets.length > 0, 'Expected public API module re-exports');
  const occurrences = new Map();
  for (const target of targets) {
    occurrences.set(target, (occurrences.get(target) ?? 0) + 1);
  }
  const duplicates = [...occurrences].filter(([, count]) => count > 1).map(([target]) => target);
  assert.deepEqual(duplicates, [], `Duplicate public API re-exports: ${duplicates.join(', ')}`);
});

test('public API keeps the core consumer imports available', () => {
  const required = [
    './lib/services/grafico-render.service',
    './lib/models/tema-render.model',
    './lib/models/opzioni-grafico.model',
    './lib/renderers/@skin-manager',
    './lib/renderers/@carta-astrale/carta-astrale.renderer',
    './lib/renderers/gestore-immagini',
    './lib/renderers/chart-asset-urls',
  ];
  for (const target of required) {
    assert.ok(targets.includes(target), `Missing compatibility export: ${target}`);
  }
});
