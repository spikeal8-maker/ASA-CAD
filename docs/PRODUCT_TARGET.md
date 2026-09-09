# ASA-CAD product target

## What we are building

ASA-CAD is a new browser-native engineering CAD module for ASA Lab.

It is separate from the existing beginner ASA 3D editor. It is intended to teach workflows that transfer directly to KOMPAS-3D.

ASA-CAD has two first-class document modes:

- **Деталь / Part** — sketches, dimensions, feature history and bodies;
- **Сборка / Assembly** — Part/subassembly occurrences, placement and mates/constraints.

## End-state interface

The ASA-owned desktop interface follows the KOMPAS-3D teaching workflow as closely as practical:

- document tabs;
- Part/Assembly new-document choice;
- top command/ribbon area;
- Part model/history tree;
- Assembly component/mate tree;
- contextual parameter panel;
- central 3D viewport;
- sketch constraints/driving dimensions;
- assembly mates;
- confirm/cancel command lifecycle;
- status/constraint feedback;
- Russian engineering terminology aligned with the taught KOMPAS workflow.

The UI is recreated by ASA-CAD. We do not depend on the visible ToubkalCAD UI and do not ship proprietary KOMPAS binaries/source/artwork.

## Execution model

All interactive CAD mathematics runs on the active learner device.

- desktop/laptop -> that computer;
- tablet -> that tablet;
- supported phone -> that phone;
- ASA Lab server does not calculate the Part or Assembly for the learner.

The browser downloads/instantiates OpenCascade WebAssembly and solver/runtime code and uses local device resources.

## Standalone product

ASA-CAD must be independently runnable/testable without ASA Lab.

```bash
docker compose up --build
```

Default standalone address:

```text
http://localhost:8088
```

The Docker image is frontend-only: no own database and no CAD compute backend.

## ASA Lab deployment

Production uses a separate pinned frontend image under the same ASA Lab public origin:

```text
/api/* -> asa-api
/cad/* -> asa-cad-web
other UI -> asa-web
```

This gives one domain/session/product to the learner while keeping CAD independently buildable, testable, cacheable and rollbackable.

Target module:

```text
moduleKey: cad
projectType: cad-document
CadDocument.kind: part | assembly
```

## ASA Lab responsibility

ASA Lab owns:

- authentication/learner identity;
- classes/assignments/courses;
- project ownership/access;
- draft saving;
- versions/checkpoints;
- submissions/teacher review;
- snapshots/previews;
- Assembly component-version storage/resolution.

ASA Lab stores serialized `CadDocument` intent. B-Rep/WASM pointers/Three.js meshes are runtime caches, not project authority.

## Assembly reproducibility

A saved/submitted Assembly must identify the exact component revisions/versions needed to reproduce it. Later edits to a source Part must not silently mutate an already pinned Assembly submission.

## Device policy

ASA-CAD performs a capability probe before starting the kernel. Unsupported devices fail clearly/read-only where possible rather than corrupting projects or switching silently to server-side compute.

Desktop is the reference KOMPAS-oriented interface. Smaller screens use the same document/command model with responsive panel presentation.

## Definition of success

A learner can:

1. run ASA-CAD standalone for development/testing;
2. create/edit/reopen a parametric Part;
3. create/edit/reopen an Assembly with pinned components and mates;
4. open ASA Lab and create/receive a CAD Part or Assembly project;
5. work without installing desktop CAD;
6. save to ASA Lab;
7. reopen on another supported device;
8. submit a reproducible version;
9. have the teacher open exactly the submitted Part/Assembly version.

During CAD work, the active client device performs the mathematics.
