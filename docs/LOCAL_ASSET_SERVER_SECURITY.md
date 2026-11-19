# Local asset server: loopback HTTP Host boundary

The optional development asset server (`scripts/serve-local-assets.mjs`) is **not** a public artwork distribution service. It is read-only, binds to `127.0.0.1`, serves only SHA-256-verified files from an explicitly approved manifest, and permits only configured local browser origins. This is not a license or rights audit.

## Why verify the HTTP Host header?

Binding a development server to a loopback socket and configuring CORS are useful, but they are **not** a complete DNS-rebinding defence. A hostile website can attempt to resolve its own hostname to the user's loopback address. Without an explicit Host check, an HTTP request can reach the development server with the hostile hostname even though the TCP connection targets `127.0.0.1`.

The server now requires an exact HTTP `Host` of `127.0.0.1:<port>` or `localhost:<port>`, where `<port>` is the **actual local socket port**. Hostname comparisons are case-insensitive. Hosts with extra subdomains, a different port, IPv6 aliases, leading-zero ports, userinfo, or a missing port are rejected with HTTP `403 Forbidden host`. This policy is intentionally strict for a development server bound to IPv4 loopback.

The check runs **before** asset routing, preview generation, or CORS processing, and therefore applies to `GET`, `HEAD` and `OPTIONS`. It does not change any canonical asset URLs, approved file content, manifest schema, Angular code, or production operation.

## Running locally

From a clean checkout:

```bash
npm ci
npm run test:local-assets
npm run test:assets
```

For the interactive demo, generate a synthetic development pack and serve it using the existing commands:

```bash
npm run demo:pack
npm run demo:assets
# In another terminal:
npm run demo
```

The server supports the existing `http://127.0.0.1:4177/assets/` URL, plus `localhost` with the same port when the connection resolves to IPv4 loopback.

The regression checks both the pure Host validator and **real HTTP requests** to the local test server with substituted Host headers. Passing these tests cannot establish immunity to every browser-origin attack, graphics fidelity, WebGL behavior, or suitability for internet exposure. Never configure this server to listen on a public network interface or redistribute unapproved artwork.

## Compatibility and rollback

Normal requests from the Angular demo using `127.0.0.1:4177` are unchanged. Noncanonical Host aliases, reverse proxies, and HTTP/1.0 clients without an explicit port are intentionally unsupported. No production VirgoStars or Astrolabio files are modified. Rollback by reverting this focused PR; do not merge until the local Node suite and demo have been checked.
