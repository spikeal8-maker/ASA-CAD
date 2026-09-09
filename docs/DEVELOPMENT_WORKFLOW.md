# ASA-CAD development and visual review workflow

This document answers a practical question: how the owner can run ASA-CAD separately from ASA Lab, look at a concrete page/state, ask an agent to change it, and verify the result before integration.

## 1. Two local run modes

### Mode A — fast development / UI editing

Use this while changing layout, controls, panels, styles and command presentation.

First install once:

```bash
npm run install:vendor
```

Then:

```bash
npm run dev
```

Current imported baseline opens at:

```text
http://localhost:8080
```

The dev server uses hot reload. A source change recompiles and the browser updates without rebuilding the Docker image.

This is the preferred loop for requests such as:

```text
"Open the Part editor. Make the model tree 40 px narrower,
move command parameters to the right panel,
and make the top command group closer to our KOMPAS reference."
```

### Mode B — standalone Docker / production-like verification

Use this after a meaningful change or before accepting a milestone:

```bash
docker compose up --build
```

Open:

```text
http://localhost:8088
```

Stop:

```bash
docker compose down
```

This validates the release-like static build, Caddy serving, WASM delivery and CAD-specific browser-isolation headers.

Do not use Docker rebuild as the normal pixel-by-pixel UI editing loop.

## 2. Current versus target source boundary

### Current state

The standalone visual app is still the imported Toubkal baseline under:

```text
vendor/toubkal/
```

The root `npm run dev` delegates to that baseline. It is useful to inspect and prove the kernel/runtime, but its visible shell is not the ASA-CAD product target.

### Target state after M1/M2

ASA-owned source will become the editable product surface. Product UI must live outside vendor code, conceptually along lines such as:

```text
src/ or apps/cad-web/
  application/
  documents/
  shell/
  part/
  assembly/
  drawing/
  fragment/
  specification/
  text/
  styles/
```

Exact folder names are selected during implementation, but the boundary is mandatory:

```text
ASA UI -> CadApplication -> adapters -> vendor/kernel
```

Agents must not implement long-term visual corrections by continually repainting `vendor/toubkal` components.

## 3. How the owner gives a visual correction task

A good task identifies four things:

1. **URL/state** — where to look;
2. **document kind** — Part, Assembly, Drawing, etc.;
3. **what is wrong**;
4. **what outcome is required**.

Examples:

```text
http://localhost:8080
Document: Part
The header is too tall and the model tree is too wide.
Make the command area denser and keep the viewport larger.
```

or later:

```text
http://localhost:8088/cad/projects/demo-assembly
Document: Assembly
Component tree is hard to read. Mates should be a separate section,
and Create Part must be in the Components command group.
```

A screenshot is useful for visual defects, but the URL/state remains important because the agent should inspect the actual implementation rather than only redraw a screenshot.

## 4. Stable review/demo routes

As the ASA-owned shell appears, development must provide deterministic demo routes/fixtures so the owner can always open the same states without manually rebuilding a model first.

Target examples:

```text
/dev/part/empty
/dev/part/reference
/dev/assembly/reference
/dev/drawing/reference
/dev/fragment/reference
/dev/specification/reference
/dev/text/reference
```

These routes are development-only and backed by checked-in fixtures. They are not public production content.

Purpose:
- visual review;
- screenshot regression;
- agent tasks with an exact state;
- responsive checks;
- fast reproduction of bugs.

## 5. Required visual fixtures

At minimum create fixtures for:

### Part
- empty Part;
- sketch editing;
- fully constrained sketch;
- feature parameter editing;
- protected reference Part;
- rebuild warning/error.

### Assembly
- empty Assembly;
- inserted components;
- active mate command;
- contextual Part editing inside Assembly;
- unresolved mate/reference;
- protected reference Assembly.

### Drawing
- empty A4 sheet;
- drawing with associative views;
- dimensions/annotations;
- multi-sheet state.

### Fragment
- reusable 2D geometry example.

### Specification
- assembly-generated populated table.

### Text
- multi-page technical note example.

## 6. Styling/editing architecture

Product styling must be split into reusable design tokens and document-specific components.

The owner should be able to request:

```text
"Make the whole CAD shell denser"
```

and have the agent change shared tokens rather than manually patching 40 unrelated CSS files.

Likewise:

```text
"Only in Assembly, make component rows more compact"
```

should change an Assembly component/tree style, not the whole application.

See `docs/FILES_SETTINGS_AND_EXPORT.md` for the appearance/settings contract.

## 7. Review loop

Normal visual-development loop:

```text
owner opens dev URL
-> identifies a concrete problem
-> agent edits ASA-owned UI source
-> affected unit/visual tests run
-> dev server hot reloads
-> owner reviews
-> when accepted, Docker image is rebuilt
-> Docker smoke/E2E runs
-> change is ready for milestone acceptance
```

## 8. Testing layers

Every feature should have the cheapest appropriate test first.

1. Type/unit tests — document commands, serializers, solvers/adapters.
2. CAD regression tests — exact geometry/recompute/reference behavior.
3. Browser component/interaction tests — commands and panels.
4. Visual regression — stable fixture screenshots.
5. Docker browser E2E — production-like image.
6. ASA Lab integration E2E — only after standalone behavior is proven.

A screenshot alone never proves CAD correctness. A geometry test alone never proves the interface is usable. Both layers are required.

## 9. What the owner should not need

For normal UI review the owner should not have to:
- run ASA Lab;
- start PostgreSQL;
- configure classes/accounts;
- rebuild Docker after every CSS change;
- know OpenCascade internals;
- navigate vendor source code;
- manually recreate the same test model every time.

Standalone fixtures and the dev server exist specifically to remove that friction.

## 10. Production integration remains separate

The same tested ASA-CAD release is later delivered as `asa-cad-web:<version>` and reverse-proxied by ASA Lab under `/cad/*`.

Standalone development does not create a second product architecture. It is the same CAD app with a local/mock `CadProjectHost` instead of the ASA Lab persistence adapter.
