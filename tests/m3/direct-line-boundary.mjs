import assert from 'node:assert/strict';
import fs from 'node:fs';

const interaction = fs.readFileSync('src/web/viewport/SketchLineInteractionLayer.tsx', 'utf8');
const tool = fs.readFileSync('src/web/useSketchLineTool.ts', 'utf8');
const stage = fs.readFileSync('src/web/PartModelStage.tsx', 'utf8');
const bindings = fs.readFileSync('src/web/M2CadUiActions.ts', 'utf8');
const registry = JSON.parse(fs.readFileSync('spec/ui/command-registry.v1.json', 'utf8'));

for (const forbidden of ['CadApplication', 'OpenCascade', 'vendor/', 'CadProjectHost', 'localStorage']) {
  assert.equal(interaction.includes(forbidden), false, `Sketch interaction layer must not depend on ${forbidden}`);
}
assert.match(interaction, /onPointerDown=/, 'Line interaction must use Pointer Events for mouse/touch');
assert.match(interaction, /onPointerMove=/, 'Line interaction must own transient pointer preview');
assert.match(tool, /id: 'sketch\.line'/, 'Line tool must commit through typed sketch.line command');
assert.equal(/\.entities\.(push|splice)/.test(tool), false, 'Line tool must not mutate persisted Sketch entities directly');
assert.match(stage, /SketchLineInteractionLayer/, 'Part stage must compose the separate Line interaction layer');
assert.match(bindings, /'sketch\.line': binding\(handlers\.line/, 'shared action catalog must bind sketch.line');

const line = registry.commands.find((command) => command.id === 'sketch.line');
assert.ok(line, 'command registry must contain sketch.line');
assert.equal(line.status, 'implemented', 'sketch.line must be implemented only with the M3.2 product path');
assert.equal(line.milestone, 'M3.2');

console.log('ASA-CAD M3.2 direct Line architecture boundary PASS');
