/* Astrological Charts — Copyright (c) 2026 Cesare-ml (VirgoStars project).
 * CPAL-1.0; see ../LICENSE, Exhibits A/B.
 *
 * Lifecycle of development servers started by the local PNG/JPEG runner.
 * Never terminates pre-existing servers: only spawned children are tracked.
 */
import { spawn } from 'node:child_process';

/** Spawn a server process in its own Unix process group.
 * Windows uses taskkill /T only during cleanup to terminate child processes.
 */
export function startOwnedServer(command, args, options = {}) {
  const child = spawn(command, args, {
    cwd: options.cwd,
    windowsHide: true,
    stdio: 'ignore',
    detached: process.platform !== 'win32',
  });
  child.startupError = null;
  child.on('error', error => { child.startupError = error; });
  return child;
}

export function getServerFailure(child) {
  if (!child) return null;
  if (child.startupError) return child.startupError.message;
  if (child.exitCode !== null) return `exited with code ${child.exitCode}`;
  if (child.signalCode !== null) return `terminated by signal ${child.signalCode}`;
  return null;
}

function waitForExit(child, timeoutMs = 2000) {
  return new Promise(resolve => {
    if (child.exitCode !== null || child.signalCode !== null) return resolve();
    const finish = () => { clearTimeout(timeout); child.off('exit', finish); child.off('error', finish); resolve(); };
    const timeout = setTimeout(finish, timeoutMs);
    timeout.unref?.();
    child.once('exit', finish);
    child.once('error', finish);
  });
}

function taskkillTree(child) {
  return new Promise(resolve => {
    const killer = spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], {
      windowsHide: true, stdio: 'ignore',
    });
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      resolve();
    };
    const timeout = setTimeout(() => {
      try { killer.kill(); } catch { /* already exited */ }
      finish();
    }, 5000);
    timeout.unref?.();
    killer.once('exit', finish);
    killer.once('error', finish);
  });
}

/** Stop ONLY processes launched by this command, in reverse order.
 * Uses POSIX group termination or the Windows taskkill tree operation.
 */
export async function stopOwnedServers(children) {
  for (const child of [...children].reverse()) {
    if (!child || !Number.isSafeInteger(child.pid) || child.pid <= 0) continue;
    if (process.platform === 'win32') {
      // No PID from an unrelated process is passed: tracked spawn only.
      if (child.exitCode === null && child.signalCode === null) {
        await taskkillTree(child);
        await waitForExit(child);
      }
      continue;
    }
    // Unix: detached servers were launched in their own process group.
    // Kill the group so the Angular CLI's children cannot remain orphans.
    try { process.kill(-child.pid, 'SIGTERM'); }
    catch (error) {
      if (error.code !== 'ESRCH') {
        try { child.kill('SIGTERM'); } catch { /* process exited */ }
      }
    }
    await waitForExit(child);
    // Never use an arbitrary PID: the process group belongs to our child.
    try { process.kill(-child.pid, 0); }
    catch { continue; }
    try { process.kill(-child.pid, 'SIGKILL'); }
    catch { /* group already exited */ }
  }
}
