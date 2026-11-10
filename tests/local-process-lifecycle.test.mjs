/* Copyright (c) 2026 Cesare-ml (VirgoStars project).
 * CPAL-1.0; see ../LICENSE and Exhibits A/B.
 * Tests only short-lived isolated local Node.js child processes.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { startOwnedServer, getServerFailure, stopOwnedServers }
  from '../scripts/local-process-lifecycle.mjs';

test('owned local server starts, is tracked, then exits on cleanup', {timeout: 15000}, async () => {
  const child = startOwnedServer(process.execPath,
    ['-e', 'setInterval(()=>{},1000)'], { cwd: process.cwd() });
  try {
    await once(child, 'spawn');
    assert.ok(Number.isSafeInteger(child.pid) && child.pid > 0);
    assert.equal(getServerFailure(child), null);
  } finally {
    await stopOwnedServers([child]);
  }
  assert.ok(child.exitCode !== null || child.signalCode !== null,
    'owned process must exit when cleanup returns');
});

test('server startup error is reported without a 60-second health-check timeout', {timeout: 10000}, async () => {
  const child = startOwnedServer('__nonexistent_virgostars_test_command__', []);
  // A spawn error is expected and is captured by the lifecycle helper.
  await once(child, 'error').catch(() => {});
  try {
    assert.match(getServerFailure(child), /ENOENT|not found|spawn/i);
  } finally {
    await stopOwnedServers([child]);
  }
});

test('cleanup handles empty or already-stopped child lists', {timeout: 15000}, async () => {
  await stopOwnedServers([]);
  const child = startOwnedServer(process.execPath, ['-e', 'process.exit(0)']);
  await once(child, 'exit');
  assert.equal(child.exitCode, 0);
  assert.match(getServerFailure(child), /exited with code 0/);
  await stopOwnedServers([child, null]);
  await delay(5);
});
