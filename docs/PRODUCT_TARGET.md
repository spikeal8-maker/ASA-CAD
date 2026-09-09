# ASA-CAD product target

## What we are building

ASA-CAD is a new, independent engineering CAD module for ASA Lab.

It is not a replacement for the existing beginner ASA 3D editor. It is a separate parametric CAD environment intended to teach workflows that transfer directly to KOMPAS-3D.

## End-state

When a learner opens a CAD project inside ASA Lab, the learner sees an ASA-owned CAD interface whose desktop information architecture and command workflow follow KOMPAS-3D as closely as practical:

- document tabs;
- top command/ribbon area;
- model/history tree;
- contextual parameter panel;
- central 3D viewport;
- sketch constraints and driving dimensions;
- confirm/cancel command lifecycle;
- status/constraint feedback;
- Russian engineering terminology matching the taught KOMPAS workflow.

The UI is recreated by ASA-CAD. We do not depend on the visible ToubkalCAD UI and do not copy proprietary KOMPAS binaries or artwork.

## Non-negotiable execution model

All interactive CAD mathematics runs on the learner device.

- desktop/laptop -> CPU/RAM of that computer;
- tablet -> CPU/RAM of that tablet;
- phone -> CPU/RAM of that phone, subject to capability checks;
- ASA Lab server does not calculate the model for the learner.

The browser downloads the ASA-CAD JavaScript and OpenCascade WebAssembly only when a CAD project is opened. The WASM module is instantiated in browser memory and performs geometry operations locally. Hashed runtime assets are cacheable, so they are not downloaded again on every normal open.

## Server responsibility

ASA Lab provides product and classroom services only:

- authentication and learner identity;
- classes and assignments;
- project ownership/access;
- draft saving;
- versions/checkpoints;
- submissions and teacher review;
- project snapshots/previews;
- optional imported CAD attachments.

The server stores a serializable parametric `CadDocument`; B-Rep/WASM pointers and Three.js meshes are runtime caches and are not project authority.

## Device policy

ASA-CAD must perform an explicit capability probe before starting the kernel.

Required checks include the browser features needed by the selected WASM build, available rendering support and a practical memory floor. Unsupported devices must fail clearly rather than partially corrupting a document.

Desktop remains the reference UI for KOMPAS workflow parity. Smaller screens keep the same document/commands and local mathematics, while panels may collapse into drawers/tabs so the editor remains usable.

## Definition of success

A learner can:

1. open ASA Lab;
2. create or receive a `cad` assignment/project;
3. open the CAD editor without installing desktop software;
4. build a parametric part;
5. change an early dimension and recompute downstream features;
6. save the work to ASA Lab;
7. open the same project on another device and continue editing;
8. submit a version to a teacher;
9. have the teacher open the exact submitted version.

Geometry calculation during steps 4-5 happens on the active client device, not on the ASA Lab server.
