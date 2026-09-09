# ASA-CAD assemblies

## Why assemblies are a separate CAD document

A **Part (Деталь)** describes one component and its own parametric construction history: sketches, dimensions, features and bodies.

An **Assembly (Сборка)** describes how several parts and/or subassemblies are instantiated, positioned and constrained relative to each other. An assembly does not normally merge all components into one part.

Example:

```text
Part: bracket
Part: bolt
Part: washer
Part: nut
        |
        v
Assembly: bracket + bolt + washer + nut
```

The learner therefore needs two creation modes inside the same ASA-CAD module:

- **Деталь**;
- **Сборка**.

## One module, two document kinds

ASA Lab should register one subject module:

```text
moduleKey: cad
projectType: cad-document
```

The saved document is discriminated by ASA-owned schema:

```ts
type CadDocument = CadPartDocument | CadAssemblyDocument;

type CadDocumentKind = 'part' | 'assembly';
```

This keeps one editor/runtime/release while allowing different command sets and document trees.

## Part document

Conceptually:

```text
CadPartDocument
|- kind: part
|- schemaVersion
|- engineVersion
|- units
|- variables
|- datum/origin
|- sketches
|- constraints/dimensions
|- features
|- bodies
|- stable references
`- editor state
```

## Assembly document

Conceptually:

```text
CadAssemblyDocument
|- kind: assembly
|- schemaVersion
|- engineVersion
|- units
|- components
|  |- occurrence id
|  |- source reference
|  |- transform
|  |- visibility
|  `- instance metadata
|- mates / assembly constraints
|- subassemblies
|- assembly reference geometry
|- exploded/view state
`- editor state
```

## Component references in ASA Lab

A cloud assembly must be reproducible. Components therefore cannot be unversioned live pointers that silently change when another project is edited.

Target component source reference:

```text
projectId + pinned revision/version + document identity
```

Rules:

1. inserting a part creates an assembly occurrence referencing a known component revision/version;
2. the same part may appear many times using different occurrence IDs/transforms;
3. updating an occurrence to a newer part revision is an explicit user action;
4. submitted/published assembly versions pin every referenced component version needed to reproduce that assembly;
5. circular assembly references are rejected;
6. deleting/renaming a source project must not corrupt an already pinned assembly version.

A future optimization may cache component B-Rep/tessellation, but the component document/version identity remains authoritative.

## Initial assembly commands

First assembly foundation:

- create assembly;
- insert existing part;
- insert another assembly/subassembly;
- duplicate occurrence;
- fix/unfix component;
- move/rotate before or while constraining;
- replace component;
- explicitly update component revision;
- hide/show/suppress occurrence;
- assembly tree with part/subassembly hierarchy.

Initial mates/constraints:

- coincident/planar;
- concentric;
- parallel;
- perpendicular;
- distance;
- angle;
- fixed component.

Later:

- limits/ranges where solver support is reliable;
- patterns of components;
- exploded views;
- interference/contact analysis;
- BOM-oriented metadata;
- in-context/reference editing only after reference/version semantics are stable.

## Assembly recompute

Assembly recompute is different from Part Design recompute.

A part recomputes its own feature history. An assembly resolves the exact pinned component documents, builds/caches their shapes locally, then solves occurrence transforms from assembly constraints.

All of this still executes on the active browser device. ASA Lab stores documents, versions and referenced component identities; it does not solve the assembly on the server.

## Protected assembly workflow

The first assembly regression should prove:

```text
create two/three part documents
-> create assembly
-> insert multiple occurrences
-> fix base occurrence
-> add concentric + coincident/distance constraints
-> solve placement
-> save
-> close/reopen
-> replace/update one component explicitly
-> recompute assembly
-> save pinned version
-> reopen exact pinned version
```

The assembly must reopen with the same component versions and the same solved intent.

## UI target

When `document.kind = assembly`, the KOMPAS-oriented shell changes command groups and tree presentation, but remains the same ASA-CAD application shell.

The visible distinction must be clear:

- **Деталь**: sketches/features/bodies;
- **Сборка**: components/subassemblies/mates/occurrences.

Assembly support is a required product lane, not an optional postscript.
