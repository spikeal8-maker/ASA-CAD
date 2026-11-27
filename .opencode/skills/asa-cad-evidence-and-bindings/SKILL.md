---
name: asa-cad-evidence-and-bindings
description: "ASA-CAD only: verify reference manifests, semantic scenario coverage and actual variant-to-action bindings. Load on demand for evidence/inventory work or implementation claims; distinguish facts, targets and missing proof."
---
# Verify the claim against its source

Locate the assigned ASA-CAD checkout even when the session starts in its parent; resolve repository paths from its verified Git root. Read the assigned live issue and exact candidate before trusting its report.
Read only relevant sections of `docs/FUSION_BROWSER_SPEC.md`, `docs/UI_CORE_UNIFICATION_SPEC.md` section 10 and the referenced manifests.
Use `spec/process/fusion-tasks.v1.json` for task meaning and dependencies, not execution permission.

## Classify every fact

- Separate native Fusion observation, native structural metadata, official help, historical ASA checks and chosen requirements.
- Validate each field against its own schema/contract. Another field's vocabulary is not a global enum; report a violation only with an applicable rule.
- An active SketchTab and command definitions do not prove an active tool, open numeric field, gesture, geometry or screenshot.
- Historical ASA browser input is not Autodesk capture. A selected Circle recipe is `chosenRequirement`, never `historicalAsaCheck`.
- Use the field's declared UNKNOWN/NOT_CAPTURED forms for missing facts/captures; otherwise report uncertainty in prose. Preserve a concrete next task.
- Keep field values, explanatory notes and the report consistent. A correct top-level disclaimer does not repair a contradictory row.
- Cite source path/URL, exact ref/SHA, relevant field or symbol and the limited claim it supports.
- Do not claim a screenshot was inspected unless it was actually viewed. Official help describes behavior; it is not a local capture.
- Keep native observations, current ASA behavior and historical gaps tied to their own versions.

## Identify the hashed object

- Distinguish the bytes of the repository JSON from its upstream capture/source.
- If copying `privateSourceSha256`, `source.sha256` or `sourceSha256`, label it `upstreamSourceSha256` and record `sourceField` plus `hashObject`.
- Assert a repository-file hash only after computing it from the exact bytes and recording an immutable source ref.
- Equal upstream hashes may identify one shared source; they do not prove two normalized repository files are byte-identical.
- Publish only authorized safe evidence; never attach private raw captures, workstation paths or streams to explain a hash.

## Trace scenarios by meaning

- Map each required Q-ID to a meaningful state, source/evidence type or NOT_CAPTURED, and concrete next task IDs.
- Check the set of IDs, duplicates, referenced state existence and semantic coverage; counting 16 IDs is not sufficient.
- Match the Browser Spec's actual state and transition: Protected Part is more than generic Save/Open; input lifecycle is more than selection.
- Do not add unrelated Q-IDs to a state to obtain coverage. Preserve unknown/missing states instead of manufacturing proof.
- Resolve each next task against the registry's title and acceptance; ranges such as `X01-X11` do not assign a specific gap.
- Split a compound gap or assign specific existing owners/tasks. Ask the controller only when the missing assignment prevents the authorized result.

## Establish actual variant bindings

1. Start with `spec/ui/command-registry.v1.json` for valid IDs; an existing ID alone proves neither implementation nor UI connection.
2. Trace the exact variant and launch route: visible control -> UI binding -> CadUiAction/contextual dispatch/direct handler -> shared command or navigation behavior.
3. For Sketch, inspect `src/web/fusion/sketchCommands.ts` (`sketchNativeActions`, `fromNative`, `itemAction`, `contextualDimension`) and `SketchRibbon.tsx`.
4. For Solid, inspect relevant `src/web/fusion/liveActions.ts` / `LiveTop.tsx` fragments. For camera rows, inspect the specific ViewCube/SketchPlaneCube/navigation handler.
5. Store actual invoked IDs separately from `asaRelatedCommandIds`; a family-level `sketch.circle` does not establish CircleThreePoint or tangent-circle support.
6. For contextual dispatch, enumerate actual alternatives and conditions. For a direct handler, record its symbol/ref. Null can be valid for a documented handler/container.
7. A complete applicable binding/dispatch chain proving no connection requires null + not_implemented, not UNKNOWN. If source is incomplete, report the claim as unverified in prose and identify the missing link; do not invent an implementationStatus value.
8. Audit every asserted implemented row, not only previously reported examples. Keep implementation status and browser acceptance independent.

Treat dropdowns, separators, headings and composite ViewCube/Navigation groups as containers/behaviors, not invented native CAD commands.
Preserve links to child actions. Count visible actions separately from containers and hidden reference elements; explain count changes.
For each claimed launch route and mode, record its own binding/evidence. A ribbon PASS does not prove shortcut, marking menu or another variant.
Change a field's status vocabulary only when its contract explicitly authorizes that change.
Static code can establish a binding, not browser PASS, geometry correctness or visual parity.

## Review output

Report in Russian: exact candidate, supported claims, precise contradictions by JSON path/source symbol, concrete corrections and remaining UNKNOWNs.
Keep owner visual acceptance PENDING until the owner's explicit verdict; do not turn a reference inventory into a product acceptance claim.
Return REVIEW to the controller. This skill grants no file scope, product permission or acceptance authority.
