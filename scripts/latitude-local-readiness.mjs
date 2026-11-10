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
    let hardDeadline;
    const finish = ready => {
      if (settled) return;
      settled = true;
      clearTimeout(hardDeadline);
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
      response.once('close', () => { if (!response.complete) finish(false); });
    });
    req.once('error', () => finish(false));
    req.once('timeout', () => { req.destroy(); finish(false); });
    // A server that trickles a byte every second can evade socket inactivity
    // timeouts indefinitely. Bound the entire readiness request as well.
    hardDeadline = setTimeout(() => { req.destroy(); finish(false); }, 3000);
  });
}

/**
 * Manual browser choices for the focused latitude probe.
 * Single-browser mode honours CHART_TEST_BROWSER. --both runs two browser
 * processes sequentially against the same synthetic demo and asset servers.
 */
export function browserModes(args, env = {}) {
  if (args.length > 1 || (args.length === 1 && args[0] !== '--both')) {
    throw new Error('Usage: npm run test:latitude:local or npm run test:latitude:both');
  }
  if (args.length === 1) return ['chromium', 'firefox'];
  const browser = env.CHART_TEST_BROWSER || 'chromium';
  if (!['chromium', 'firefox'].includes(browser)) {
    throw new Error('CHART_TEST_BROWSER must be chromium or firefox');
  }
  return [browser];
}
