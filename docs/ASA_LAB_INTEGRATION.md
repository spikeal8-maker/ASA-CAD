# ASA-CAD -> ASA Lab integration contract

## Decision

ASA-CAD remains a separate repository **and a separate versioned frontend Docker image**.

In production it becomes a first-class ASA Lab module by being reverse-proxied through the same public ASA Lab origin under `/cad/*`.

It is:

- not an iframe;
- not a second login/account system;
- not a CAD compute server;
- not bundled into every normal ASA Lab page.

The separate container serves only the ASA-CAD frontend/runtime assets. Geometry still executes in the learner browser.

## Production topology

```text
browser
  |
  v
ASA Lab public origin / front door
  |
  +---- /api/* -----> asa-api
  |
  +---- /cad/* -----> asa-cad-web
  |
  `---- other UI ---> asa-web
```

The existing ASA Lab web image already uses Caddy and reverse-proxies `/api/*` to `api:4611`. M5 adds the more-specific `/cad/*` route before the generic SPA route.

The user remains on the ASA Lab domain. Existing HttpOnly session cookies and the normal ASA Lab APIs remain authoritative.

## Why separate frontend container

This is the preferred integration because it gives us:

- independent ASA-CAD build/release/rollback;
- exactly the same image for standalone and ASA Lab testing;
- no OpenCascade payload in the normal ASA Lab bundle;
- CAD-specific COOP/COEP/runtime headers without imposing them on every ASA Lab page;
- independent CAD cache/versioning;
- no iframe or cross-origin authentication bridge.

## Module registration

Target manifest:

```text
moduleKey: cad
projectType: cad-document
schemaVersion: 1
editorRoute: /cad/projects/:projectId
viewerRoute: /cad/view/:versionId
availability: active
previewKind: scene
categories: design, engineering
```

`CadDocument` itself declares:

```text
kind: part | assembly
```

A single ASA Lab CAD module therefore supports both **Деталь** and **Сборка**.

## Runtime loading

Target sequence:

```text
learner opens CAD project
        |
        v
browser navigates to same-origin /cad/projects/<projectId>
        |
        v
asa-cad-web returns ASA-CAD HTML/JS
        |
        v
ASA-CAD performs capability check
        |
        v
browser downloads content-hashed OpenCascade WASM
        |
        v
WASM is instantiated in browser RAM
        |
        v
Part/Assembly calculations run on that device
```

Opening ordinary ASA Lab pages/modules must not fetch the CAD JS/WASM payload.

## Client-compute invariant

Production ASA-CAD must have no normal endpoint such as `/compute`, `/rebuild`, `/boolean`, `/fillet`, `/solve` or `/assembly-solve` that executes learner CAD mathematics on a server.

The browser performs:

- sketch solving;
- Part feature construction/recompute;
- assembly mate solving and occurrence placement;
- B-Rep operations;
- tessellation;
- picking/measurement support;
- normal export generation where practical.

Server traffic is for product persistence/education only.

## Persistence adapter

ASA-CAD owns the public project contract, not ASA Lab internals:

```ts
interface CadProjectHost {
  load(): Promise<{ document: CadDocument; revision: number }>;
  save(input: {
    document: CadDocument;
    baseRevision: number;
    mutationId: string;
  }): Promise<{ revision: number }>;
  saveSnapshot(imageDataUrl: string, sourceRevision: number): Promise<void>;
}
```

In standalone mode this is backed by fixtures/local storage/IndexedDB.

In ASA Lab mode it maps to existing Project Core open/draft/snapshot/version APIs.

For Assembly documents the ASA Lab host also resolves pinned component project versions referenced by the assembly document.

## Part/Assembly persistence

### Part

A Part project saves its parametric sketch/feature document and engine/schema metadata.

### Assembly

An Assembly project saves:

- component occurrence IDs;
- source project/document identity;
- pinned component revision/version;
- occurrence transforms;
- assembly mates/constraints;
- assembly state required for deterministic reopen.

A submitted/published Assembly version must pin the component versions needed to reproduce that exact submission.

Editing a source Part later must not silently alter an already pinned Assembly submission.

## Save/recovery flow

1. User command changes the in-memory `CadDocument`.
2. Local Part/Assembly recompute runs on the device.
3. After a safe command boundary/debounce the serialized document is sent to ASA Lab.
4. ASA Lab saves with `baseRevision` + `mutationId` conflict protection.
5. Editor reports saved state only after server acknowledgement.
6. Local IndexedDB may retain unsent recovery state after crash/network loss.
7. ASA Lab remains cross-device authority.
8. Opening on another device reloads the document and recomputes locally.

## Classes, courses, assignments and submissions

ASA Lab owns the educational workflow.

- A teacher assignment references `moduleKey = cad`.
- Assignment/template metadata may specify initial document kind: `part` or `assembly`.
- Starting work creates/resolves the learner CAD project through normal Project Core.
- Autosave writes to that project.
- Submission pins a project revision/version.
- For Assembly submission, all required component versions are also reproducible/pinned.
- Teacher review opens the submitted version through `/cad/view/:versionId` or editable route according to permissions.

ASA-CAD does not implement its own roster, class, account, assignment or submission database.

## Container deployment

ASA Lab production deploys a pinned image, conceptually:

```text
asa-web:<ASA version>
asa-api:<ASA version>
asa-cad-web:<ASA-CAD version>
```

The exact Compose/Coolify deployment lives in the ASA Lab repository, not ASA-CAD.

ASA Lab never points production at `asa-cad-web:latest` or ASA-CAD `main`. It pins an explicit tested version/tag/digest.

Upgrade flow:

```text
ASA-CAD release
-> standalone Docker/browser tests
-> document compatibility tests
-> protected Part + Assembly workflows
-> ASA Lab staging
-> integration tests
-> update pinned asa-cad-web version
```

Rollback means restoring the previous compatible CAD image version.

## Browser/kernel isolation

The imported Toubkal baseline currently requires SharedArrayBuffer/cross-origin isolation and runs OpenCascade on the main browser thread.

A separate `/cad/*` frontend route lets us put current COOP/COEP headers on the CAD document without changing the normal ASA Lab pages.

Later runtime/threading improvements may remove this requirement, but the public deployment boundary stays the same.

## Device capability tiers

The same project format is used on every supported device.

- Full-capability desktop/laptop: reference editable CAD environment.
- Supported tablet/phone: same Part/Assembly documents and local calculation, with responsive panels and possibly lower visual tessellation/complexity limits.
- Unsupported device: explicit failure/read-only access where possible.

No device silently falls back to server-side CAD compute.

## Integration acceptance gate

Integration is accepted only when:

- `/cad/*` is served from the pinned `asa-cad-web` container through the ASA Lab origin;
- ordinary ASA Lab pages do not download OpenCascade WASM;
- one ASA Lab session/login works in CAD without second authentication;
- browser CPU/RAM perform Part and Assembly mathematics;
- server requests during modeling are persistence/education requests, not geometry RPCs;
- Part save/reopen works cross-device;
- Assembly save/reopen preserves exact component versions and mates;
- assignments/submissions/teacher review use existing ASA Lab flows;
- supported phone/tablet computes locally;
- unsupported hardware fails safely;
- the KOMPAS-oriented UI remains independent from Toubkal UI internals.

See `docs/RUN_AND_DEPLOY.md`, `docs/ASSEMBLIES.md` and `docs/SYSTEM_SPEC.md`.
