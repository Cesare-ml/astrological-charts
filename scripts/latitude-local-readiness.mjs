// Browser-free readiness checks for the opt-in localhost latitude test runner.
// Refuse occupied ports and require the expected local server identity.
import { get } from 'node:http';
import { connect } from 'node:net';

export function portInUse(port) {
  return new Promise(resolvePort => {
    const socket = connect({host: '127.0.0.1', port});
    let done = false;
    const finish = used => { if (done) return; done = true; socket.destroy(); resolvePort(used); };
    socket.once('connect', () => finish(true));
    socket.once('error', () => finish(false));
    socket.setTimeout(1200, () => finish(true)); // fail closed on uncertainty
  });
}

export function reachable(url, expectedMarker) {
  return new Promise(resolveReady => {
    let settled = false;
    const finish = ready => {
      if (settled) return;
      settled = true;
      resolveReady(ready);
    };
    const req = get(url, {timeout: 1500}, response => {
      const ok = response.statusCode >= 200 && response.statusCode < 400;
      let prefix = '';
      response.setEncoding('utf8');
      response.on('data', chunk => {
        // Identity markers occur in the first lines of the demo and asset preview.
        if (prefix.length < 8192) prefix += chunk.slice(0, 8192 - prefix.length);
      });
      response.once('end', () => finish(ok && prefix.includes(expectedMarker)));
      response.once('error', () => finish(false));
    });
    req.once('error', () => finish(false));
    req.once('timeout', () => { req.destroy(); finish(false); });
  });
}
