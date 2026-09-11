import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const viewport = readFileSync('src/web/CadViewport.tsx', 'utf8');
const picking = readFileSync('src/web/viewport/ViewportPicking.ts', 'utf8');
const selection = readFileSync('src/web/viewport/ViewportSelectionController.ts', 'utf8');

assert.match(viewport, /resolveViewportPickCandidates/, 'CadViewport must delegate candidate filtering/ranking to the ASA picking model');
assert.match(viewport, /new ViewportSelectionController/, 'CadViewport must delegate selection state to the ASA selection controller');
assert.doesNotMatch(viewport, /let selectedFace\s*:/, 'face selection state must not return to the Three effect');
assert.doesNotMatch(viewport, /let hoverFace\s*:/, 'face hover state must not return to the Three effect');
assert.doesNotMatch(viewport, /let hoverBodyId\s*:/, 'body hover state must not return to the Three effect');
assert.match(viewport, /onPickCandidates/, 'viewport must expose an ambiguity/candidate chooser seam');

assert.doesNotMatch(picking, /from ['"]three/, 'candidate model must remain Three-independent');
assert.doesNotMatch(picking, /HTMLElement|PointerEvent|MouseEvent/, 'candidate model must remain DOM-independent');
assert.match(picking, /kind: 'sketch-entity'/, 'candidate model must already have a Sketch-overlay target kind for O8/M3');
assert.match(picking, /ambiguous: boolean/, 'candidate resolver must preserve ambiguity information');

assert.doesNotMatch(selection, /from ['"]three/, 'selection controller must remain Three-independent');
assert.doesNotMatch(selection, /HTMLElement|PointerEvent|MouseEvent/, 'selection controller must remain DOM-independent');
assert.match(selection, /selectedCommandCandidate/, 'command face/edge/Sketch selection must have one shared owner');

console.log('M2O O8 viewport interaction boundary PASS (candidate model + selection owner outside Three effect)');
