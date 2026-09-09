# ASA-CAD run, test and deployment model

## Decision

ASA-CAD is an independently buildable frontend application and Docker image.

It has **no CAD compute backend** and **no database of its own**. The container serves HTML, JavaScript, WebAssembly and other static assets. The browser downloads those assets and performs CAD mathematics on the active user device.

The same versioned image is used in two modes:

1. standalone development/testing;
2. production ASA Lab deployment behind the ASA Lab public reverse proxy.

## 1. Standalone development without Docker

During development:

```bash
npm run install:vendor
npm run dev
```

The current baseline starts the imported Toubkal development server. As M1/M2 replace the application shell, the root `npm run dev` command must continue to start the standalone ASA-CAD editor.

Standalone mode uses a local/mock `CadProjectHost` implementation. It must not require ASA Lab in order to test geometry, document, UI, undo/redo, Part Design or assembly behavior.

## 2. Standalone Docker

A root `Dockerfile`, `docker/Caddyfile` and `compose.yaml` are provided.

Run:

```bash
docker compose up --build
```

Default address:

```text
http://localhost:8088
```

Override the host port:

```bash
ASA_CAD_PORT=8090 docker compose up --build
```

Container boundary:

```text
asa-cad container
|- Caddy static web server
|- index.html
|- JS/CSS chunks
|- OpenCascade WASM
`- static assets

NO database
NO geometry API
NO server-side solver
```

Browser behavior:

```text
browser requests ASA-CAD
        |
        v
download JS/WASM
        |
        v
instantiate WASM in browser RAM
        |
        v
CAD calculation uses that device CPU/RAM/GPU
```

The current imported baseline needs cross-origin isolation. The standalone Caddy config applies COOP/COEP headers to this CAD application only.

## 3. Standalone test layers

The repository must maintain four test levels.

### A. Headless/domain tests

For `CadDocument`, command semantics, solver adapters, stable references and recompute.

### B. Kernel regression tests

Exact geometry/B-Rep and imported Toubkal/OpenCascade regression coverage.

### C. Browser end-to-end tests

Start the standalone container and run real-browser flows, including:

- create/open document;
- protected Part workflow;
- protected Assembly workflow;
- save/reopen;
- undo/redo;
- selection/picking;
- command confirm/cancel;
- responsive/device capability behavior.

### D. Docker smoke test

CI builds the actual Docker image and proves it starts and serves the application/health endpoint.

No release is accepted only because TypeScript compiles.

## 4. Production deployment inside ASA Lab

Recommended production form: **separate frontend container on the same ASA Lab deployment/network**.

```text
Internet / school LAN
        |
        v
ASA Lab public reverse proxy / web front door
        |
        +---------------------------+
        |                           |
        v                           v
asa-web                         asa-cad-web
main ASA Lab UI                 CAD HTML/JS/WASM
        |
        +------------+--------------+
                     |
                     v
                  asa-api
          identity/classes/projects/
          versions/submissions
```

The user still sees one ASA Lab domain and one authenticated product.

The CAD container is not exposed as a second login/service. It is reverse-proxied under the same public origin, preferably under a dedicated prefix such as:

```text
/cad/*
```

Target routes:

```text
/cad/projects/:projectId
/cad/view/:versionId
```

The main ASA Lab web container currently already uses Caddy as its front door and proxies `/api/*` to `api:4611`. The CAD route should be matched before the generic ASA Lab SPA route and proxied to the `asa-cad-web` service.

Conceptual Caddy routing:

```text
/api/*       -> asa-api
/cad/*       -> asa-cad-web
all other UI -> asa-web static app
```

The exact production Caddy/Compose patch belongs to the ASA Lab repository and is implemented in M5.

## 5. Why a separate CAD container is preferred

It gives us:

- independent ASA-CAD repository and release cycle;
- independent Docker build/version;
- no 40-50 MB CAD/WASM payload in the normal ASA Lab web bundle;
- ability to roll back CAD without rebuilding unrelated ASA Lab UI;
- isolated CAD-specific security/runtime headers;
- simple standalone testing using exactly the same image;
- no iframe;
- same-origin ASA Lab API/session access.

This is a frontend deployment boundary, not a compute-server boundary.

## 6. Authentication and ASA Lab API

In production the browser reaches ASA-CAD through the same public ASA Lab origin. ASA-CAD calls the normal same-origin ASA Lab endpoints for:

- current session/user context;
- project load/save;
- versions/checkpoints;
- snapshots;
- assignments/submissions;
- referenced Part/Assembly component versions.

The existing ASA Lab HttpOnly session cookie remains authoritative. ASA-CAD must not implement a second login or store credentials itself.

## 7. Project host modes

ASA-CAD uses one public persistence boundary with different implementations.

### Standalone host

- fixtures/local files/IndexedDB;
- no ASA Lab required;
- used for development, demos and browser tests.

### ASA Lab host

- same `CadDocument` API;
- reads/writes ASA Lab Project Core;
- version-aware;
- assignment/submission aware through ASA Lab APIs.

The CAD application and geometry code must not care which host is active.

## 8. Release model

Every accepted ASA-CAD release produces:

```text
ASA-CAD version/tag
        |
        +-> Docker image asa-cad-web:<version>
        +-> immutable JS/WASM assets
        +-> document schema/engine version metadata
        `-> compatibility/test evidence
```

ASA Lab pins a specific ASA-CAD image version. It never deploys `latest` or the ASA-CAD `main` branch automatically.

Upgrade flow:

```text
new ASA-CAD version
-> standalone CI/tests
-> document compatibility tests
-> Part + Assembly regressions
-> staging ASA Lab deployment
-> integration tests
-> pin new image version in ASA Lab
```

Rollback is changing the pinned CAD image to the previous compatible release.

## 9. Cross-origin isolation

The current Toubkal/OpenCascade baseline requires SharedArrayBuffer/COOP/COEP. A separate CAD document/container makes it possible to apply those headers to `/cad/*` without forcing them onto every ASA Lab page.

If later ASA-CAD moves to a runtime that does not require cross-origin isolation, the external deployment contract stays the same; only the CAD container headers/runtime loader change.

## 10. Required acceptance tests before ASA Lab integration

Standalone release must prove:

- `docker compose up --build` produces a working editor;
- actual Docker image is CI-buildable;
- Part protected workflow passes in a real browser;
- Assembly protected workflow passes in a real browser;
- browser CPU/RAM perform geometry work;
- no geometry RPC endpoint exists;
- save/reopen works through standalone host;
- document compatibility tests pass;
- CAD container serves cacheable hashed WASM/assets;
- capability failure does not corrupt a document.

ASA Lab integration then additionally proves:

- `/cad/*` is served by the pinned `asa-cad-web` container;
- one ASA Lab login/session works in CAD;
- projects/classes/assignments/submissions work through ASA Lab APIs;
- unrelated ASA Lab pages never load CAD WASM;
- same project opens from another supported device;
- submitted Part and Assembly versions are reproducible.
