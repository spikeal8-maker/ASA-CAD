# ASA-CAD -> ASA Lab integration contract

## Decision

ASA-CAD remains a separate repository during development, but its released editor is embedded as a native lazy-loaded ASA Lab module. It is not an iframe and does not require a separate CAD application server.

## Runtime loading

Target loading sequence:

```text
Learner opens ASA Lab project with moduleKey = cad
        |
        v
ASA Lab ModuleEditorHost lazy-imports ASA-CAD editor bundle
        |
        v
ASA-CAD performs device capability check
        |
        v
ASA-CAD loads OpenCascade WASM from same-origin static assets
        |
        v
WASM is instantiated in browser memory
        |
        v
All sketch/feature/recompute operations execute on this device
```

The CAD JavaScript/WASM payload must not be part of the normal ASA Lab boot bundle. A learner who opens electronics, chess or the current beginner 3D editor must not pay the CAD payload cost.

Runtime assets use content-hashed filenames and long-lived immutable browser caching. A normal reopen should reuse the cached kernel until the ASA-CAD runtime version changes.

## Distribution boundary

ASA-CAD will eventually produce a versioned release artifact consumed by ASA Lab at build time.

The release must expose:

- the React editor entry point;
- ASA-owned `CadApplication` API/types;
- ASA-owned `CadDocument` schema/parser/migrations;
- runtime/kernel loader;
- required WASM/static assets;
- read-only viewer entry point;
- version metadata.

ASA Lab pins an explicit ASA-CAD release. ASA Lab never consumes `main` automatically.

The exact package transport (release tarball/package registry/workspace import) can be selected when the public boundary exists in M1. The contract is more important than the transport: no runtime dependency on a separately deployed Toubkal site.

## ASA Lab module registration

Target server manifest:

```text
moduleKey: cad
projectType: cad-part
schemaVersion: 1
editorRoute: /projects/:projectId/cad
viewerRoute: /view/projects/:versionId/cad
availability: active
previewKind: scene
categories: design, engineering
```

ASA Lab already resolves editors by `moduleKey` and lazy loads editor components. CAD will be registered through the same module registry/host path as the existing subject modules.

## Persistence adapter

ASA-CAD itself must not know tenant IDs, classroom database tables or ASA Lab authentication internals.

The host supplies a small storage adapter:

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

In standalone development this interface can use local storage/fixtures. Inside ASA Lab it maps to the existing project open/draft/snapshot/version APIs.

The ASA Lab server stores the `CadDocument`, not live OpenCascade objects and not Three.js scene state.

## Save and recovery flow

1. User command changes the in-memory `CadDocument`.
2. Local recompute runs on the device.
3. After a debounce/meaningful command boundary, the editor sends the serializable document to ASA Lab.
4. ASA Lab saves with `baseRevision` + `mutationId` conflict protection.
5. Editor updates the displayed saved revision only after server acknowledgement.
6. A small local IndexedDB recovery journal may retain the latest unsent document in case of tab/browser/network loss.
7. Server remains the cross-device authority; IndexedDB is recovery, not identity or classroom storage.

## Classes, assignments and submissions

ASA Lab owns the educational workflow.

- A teacher assignment references `moduleKey = cad`.
- Opening/starting that assignment creates or resolves the learner project using the normal Project Core flow.
- The editor receives only `projectId`, current user context and assignment context from the host.
- Autosave writes to that project.
- Submission pins a project revision/version through ASA Lab.
- Teacher review opens the pinned submitted document in the ASA-CAD viewer/editor according to permissions.

ASA-CAD does not implement its own class roster, user system, assignment database or submission system.

## Client-compute invariant

Production ASA-CAD must have no endpoint such as `/compute`, `/rebuild`, `/boolean`, `/fillet` or `/solve` whose normal purpose is to execute learner CAD mathematics on the server.

Allowed server traffic:

- project/document read/write;
- versions and submissions;
- preview/snapshot uploads;
- import/export file persistence where required;
- telemetry/errors without project geometry secrets beyond what product policy allows.

Geometry creation, sketch solving, recomputation, tessellation and normal export generation execute locally.

## Browser/kernel isolation issue

The imported Toubkal baseline currently requires `SharedArrayBuffer`/cross-origin isolation and runs OpenCascade on the main browser thread. That is an upstream implementation detail, not the final host contract.

Before ASA Lab integration we must decide and regression-test one of these runtime forms:

1. preferred if viable: client-side kernel execution that does not force cross-origin isolation on the whole ASA Lab application;
2. otherwise: a narrowly isolated CAD runtime delivery strategy proven compatible with ASA Lab authentication and other modules.

Do not globally change ASA Lab security headers merely to make the imported baseline boot. Runtime requirements must first be isolated behind the ASA-CAD kernel loader and validated on target browsers.

## Device capability tiers

The same project format is used on every device.

- Full-capability device: editable CAD environment.
- Lower-capability but supported device: same document and commands, potentially reduced visual quality/tessellation or conservative operation limits.
- Unsupported device: clear message and read-only/project access where possible; never silently send geometry computation to the ASA Lab server as a fallback.

This preserves the rule that CAD compute belongs to the active client.

## Integration acceptance gate

The integration is accepted only when all of the following are proven:

- opening ordinary ASA Lab pages does not load OpenCascade WASM;
- opening a CAD project lazy-loads ASA-CAD and the kernel;
- browser CPU/RAM perform the geometry work;
- server requests during modeling are persistence/education requests, not geometry RPCs;
- a project saves with revision protection;
- the same project opens and recomputes on another computer;
- assignment/submission/teacher review work through the existing ASA Lab flow;
- a supported phone/tablet executes the same document locally;
- unsupported hardware fails safely without document corruption;
- the KOMPAS-oriented UI does not import Toubkal UI internals.
