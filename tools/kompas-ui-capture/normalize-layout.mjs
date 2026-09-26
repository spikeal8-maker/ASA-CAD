import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { basename, join, relative, resolve } from 'node:path';

function parseArgs(argv) {
  const args = {};
  for (let index = 2; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith('--') || value === undefined) throw new Error(`Invalid argument sequence at ${key ?? '<end>'}`);
    args[key.slice(2)] = value;
  }
  if (!args.root || !args.state) throw new Error('Usage: node normalize-layout.mjs --root <spec/ui/kompas-v25> --state part-empty');
  return args;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function round(value, digits = 6) {
  const factor = 10 ** digits;
  return Math.round(Number(value) * factor) / factor;
}

function rect(rectangle) {
  if (!rectangle?.IsValid && !rectangle?.isValid) return null;
  return {
    x: round(rectangle.X ?? rectangle.x),
    y: round(rectangle.Y ?? rectangle.y),
    width: round(rectangle.Width ?? rectangle.width),
    height: round(rectangle.Height ?? rectangle.height),
  };
}

function walk(node, output = []) {
  if (!node) return output;
  output.push(node);
  for (const child of node.Children ?? node.children ?? []) walk(child, output);
  return output;
}

function firstMatching(nodes, patterns) {
  return nodes.find((node) => {
    const haystack = `${node.Name ?? node.name ?? ''}\n${node.AutomationId ?? node.automationId ?? ''}\n${node.ClassName ?? node.className ?? ''}`;
    return patterns.some((pattern) => pattern.test(haystack));
  });
}

function firstNode(nodes, predicate) {
  return nodes.find((node) => predicate(node));
}

function clientRect(node) {
  const spaces = node?.BoundingRect ?? node?.boundingRect;
  return rect(spaces?.ClientPhysicalPx ?? spaces?.clientPhysicalPx);
}

function unionRects(rectangles) {
  const valid = rectangles.filter(Boolean);
  if (!valid.length) return null;
  const left = Math.min(...valid.map((item) => item.x));
  const top = Math.min(...valid.map((item) => item.y));
  const right = Math.max(...valid.map((item) => item.x + item.width));
  const bottom = Math.max(...valid.map((item) => item.y + item.height));
  return { x: left, y: top, width: right - left, height: bottom - top };
}

function fromPhysicalRect(id, physical, dpiX, dpiY, clientWidth, clientHeight, source, confidence, notes, sourceNodeRuntimeId = []) {
  if (!physical || physical.width <= 0 || physical.height <= 0) return null;
  return {
    id,
    source,
    confidence,
    visible: true,
    rectPx: physical,
    rectPhysicalPx: physical,
    rectDip: {
      x: round(physical.x * 96 / dpiX),
      y: round(physical.y * 96 / dpiY),
      width: round(physical.width * 96 / dpiX),
      height: round(physical.height * 96 / dpiY),
    },
    rectNormalized: {
      x: round(physical.x / clientWidth),
      y: round(physical.y / clientHeight),
      width: round(physical.width / clientWidth),
      height: round(physical.height / clientHeight),
    },
    sourceNodeRuntimeId,
    notes,
  };
}

function toZone(id, node, clientWidth, clientHeight, notes = '') {
  const spaces = node?.BoundingRect ?? node?.boundingRect;
  const physical = rect(spaces?.ClientPhysicalPx ?? spaces?.clientPhysicalPx);
  if (!physical) return null;
  const dip = rect(spaces?.ClientDip ?? spaces?.clientDip);
  const normalized = rect(spaces?.ClientNormalized ?? spaces?.clientNormalized) ?? {
    x: round(physical.x / clientWidth),
    y: round(physical.y / clientHeight),
    width: round(physical.width / clientWidth),
    height: round(physical.height / clientHeight),
  };
  return {
    id,
    source: 'uia',
    confidence: 1,
    visible: !(node.Offscreen ?? node.offscreen ?? false),
    rectPx: physical,
    rectPhysicalPx: physical,
    rectDip: dip,
    rectNormalized: normalized,
    sourceNodeRuntimeId: node.RuntimeId ?? node.runtimeId ?? [],
    notes,
  };
}

function coordinateValidation(nodes, clientScreenRect, dpiX, dpiY, clientWidth, clientHeight) {
  let validated = 0;
  let maxScreenToClientErrorPx = 0;
  let maxDipError = 0;
  let maxNormalizedError = 0;
  for (const node of nodes) {
    const spaces = node?.BoundingRect ?? node?.boundingRect;
    const screen = rect(spaces?.ScreenPhysicalPx ?? spaces?.screenPhysicalPx);
    const client = rect(spaces?.ClientPhysicalPx ?? spaces?.clientPhysicalPx);
    const dip = rect(spaces?.ClientDip ?? spaces?.clientDip);
    const normalized = rect(spaces?.ClientNormalized ?? spaces?.clientNormalized);
    if (!screen || !client || !dip || !normalized) continue;
    validated += 1;
    maxScreenToClientErrorPx = Math.max(maxScreenToClientErrorPx,
      Math.abs((screen.x - clientScreenRect.x) - client.x),
      Math.abs((screen.y - clientScreenRect.y) - client.y),
      Math.abs(screen.width - client.width), Math.abs(screen.height - client.height));
    maxDipError = Math.max(maxDipError,
      Math.abs(client.x * 96 / dpiX - dip.x), Math.abs(client.y * 96 / dpiY - dip.y),
      Math.abs(client.width * 96 / dpiX - dip.width), Math.abs(client.height * 96 / dpiY - dip.height));
    maxNormalizedError = Math.max(maxNormalizedError,
      Math.abs(client.x / clientWidth - normalized.x), Math.abs(client.y / clientHeight - normalized.y),
      Math.abs(client.width / clientWidth - normalized.width), Math.abs(client.height / clientHeight - normalized.height));
  }
  return {
    result: validated > 0 && maxScreenToClientErrorPx <= 0.01 && maxDipError <= 0.01 && maxNormalizedError <= 0.000001 ? 'PASS' : 'FAIL',
    validatedNodeCount: validated,
    tolerancePx: 0.01,
    maxScreenToClientErrorPx: round(maxScreenToClientErrorPx, 8),
    maxDipConversionError: round(maxDipError, 8),
    maxNormalizedError: round(maxNormalizedError, 10),
  };
}

function resolvePointer(rootSchema, pointer) {
  return pointer.split('/').slice(1).reduce((value, token) => value[token.replaceAll('~1', '/').replaceAll('~0', '~')], rootSchema);
}

function validateAgainstSchema(value, schema, rootSchema, path = '$') {
  if (schema.$ref) return validateAgainstSchema(value, resolvePointer(rootSchema, schema.$ref.slice(1)), rootSchema, path);
  if ('const' in schema) assert(Object.is(value, schema.const), `${path} must equal ${JSON.stringify(schema.const)}`);
  if (schema.enum) assert(schema.enum.includes(value), `${path} must be one of ${schema.enum.join(', ')}`);
  if (schema.type) {
    const accepted = Array.isArray(schema.type) ? schema.type : [schema.type];
    const actual = value === null ? 'null' : Array.isArray(value) ? 'array' : Number.isInteger(value) ? 'integer' : typeof value;
    assert(accepted.includes(actual) || (actual === 'integer' && accepted.includes('number')), `${path} type ${actual} is not ${accepted.join('|')}`);
  }
  if (typeof value === 'string' && schema.minLength !== undefined) assert(value.length >= schema.minLength, `${path} is too short`);
  if (typeof value === 'number') {
    if (schema.minimum !== undefined) assert(value >= schema.minimum, `${path} is below minimum`);
    if (schema.maximum !== undefined) assert(value <= schema.maximum, `${path} is above maximum`);
    if (schema.exclusiveMinimum !== undefined) assert(value > schema.exclusiveMinimum, `${path} must be greater than ${schema.exclusiveMinimum}`);
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const required of schema.required ?? []) assert(required in value, `${path}.${required} is required`);
    for (const [key, childSchema] of Object.entries(schema.properties ?? {})) {
      if (key in value) validateAgainstSchema(value[key], childSchema, rootSchema, `${path}.${key}`);
    }
  }
  if (Array.isArray(value) && schema.items) value.forEach((item, index) => validateAgainstSchema(item, schema.items, rootSchema, `${path}[${index}]`));
}

function buildSvg(layout) {
  const { width, height } = layout.window.clientPhysicalPx;
  const colors = ['#1f77b4', '#d62728', '#2ca02c', '#9467bd', '#ff7f0e', '#17becf', '#8c564b'];
  const zones = layout.zones.map((zone, index) => {
    const r = zone.rectPhysicalPx;
    const color = colors[index % colors.length];
    return `  <g><rect x="${r.x}" y="${r.y}" width="${r.width}" height="${r.height}" fill="none" stroke="${color}" stroke-width="2"/><text x="${r.x + 4}" y="${r.y + 16}" fill="${color}" font-size="13">${zone.id} x=${r.x} y=${r.y} w=${r.width} h=${r.height}</text></g>`;
  }).join('\n');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">\n  <title id="title">KOMPAS v25 ${layout.stateId} derived layout</title>\n  <desc id="desc">Text-only derived rectangles; no KOMPAS raster or proprietary artwork.</desc>\n  <rect x="0" y="0" width="${width}" height="${height}" fill="#fafafa" stroke="#111" stroke-width="3"/>\n${zones}\n</svg>\n`;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function validateLayout(layout) {
  assert(layout.schemaVersion === 1, 'layout schemaVersion must be 1');
  assert(layout.stateId === 'part-empty', 'Stage 0 accepts only part-empty');
  assert(layout.coordinateSpaces?.canonicalSource === 'kompas-client-dip', 'canonical coordinate space must be KOMPAS client DIP');
  assert(layout.window.clientPhysicalPx.width > 0 && layout.window.clientPhysicalPx.height > 0, 'client physical size is invalid');
  assert(layout.window.clientDip.width > 0 && layout.window.clientDip.height > 0, 'client DIP size is invalid');
  for (const zone of layout.zones) {
    assert(zone.rectPhysicalPx.width > 0 && zone.rectPhysicalPx.height > 0, `zone ${zone.id} has invalid physical rect`);
    assert(zone.rectNormalized.x >= -1 && zone.rectNormalized.y >= -1, `zone ${zone.id} has invalid normalized origin`);
  }
}

const args = parseArgs(process.argv);
const root = resolve(args.root);
const stateDir = join(root, 'states', args.state);
const rawPath = join(stateDir, '.capture-raw.json');
const raw = readJson(rawPath);
const uia = readJson(join(stateDir, 'uia-tree.json'));
const environment = readJson(join(root, 'environment.json'));
const nodes = walk(uia.root);
const clientPhysical = raw.window.ClientRectScreenPhysicalPx ?? raw.window.clientRectScreenPhysicalPx;
const dpiX = Number(raw.window.DpiX ?? raw.window.dpiX);
const dpiY = Number(raw.window.DpiY ?? raw.window.dpiY);
const clientWidth = Number(clientPhysical.Width ?? clientPhysical.width);
const clientHeight = Number(clientPhysical.Height ?? clientPhysical.height);

const byAutomationId = (id) => firstNode(nodes, (node) => (node.AutomationId ?? node.automationId) === id && !(node.Offscreen ?? node.offscreen));
const byClass = (className) => firstNode(nodes, (node) => (node.ClassName ?? node.className) === className && !(node.Offscreen ?? node.offscreen));
const mainMenuNode = byAutomationId('PART_MainMenu');
const searchNode = byAutomationId('|SearchTextBox');
const contextNode = byAutomationId('PART_ContextPresenter');
const layoutNode = byAutomationId('_layoutPresenter');
const workspaceNode = byAutomationId('TbSetREGIME_SOLID1');
const managementNode = byAutomationId('Resizable_LeftHub_DockingTabControl_0|');
const graphicsNode = byClass('D3View');
const workareaNode = byClass('WorkareaControl');
const contextRect = clientRect(contextNode);
const layoutRect = clientRect(layoutNode);
const managementRect = clientRect(managementNode);
const graphicsBackingRect = clientRect(graphicsNode);
const railButtonUnion = unionRects(nodes.filter((node) => (node.AutomationId ?? node.automationId) === 'TabButton' && !(node.Offscreen ?? node.offscreen)).map(clientRect));
const quickAccessRect = unionRects((workareaNode?.Children ?? workareaNode?.children ?? []).map(clientRect).filter((item) => item && graphicsBackingRect && item.y === graphicsBackingRect.y && item.height <= 30));
const documentTabsRect = contextRect && layoutRect ? { x: contextRect.x, y: contextRect.y, width: contextRect.width, height: layoutRect.y - contextRect.y } : null;
const instrumentRect = layoutRect && graphicsBackingRect ? { x: layoutRect.x, y: layoutRect.y, width: layoutRect.width, height: graphicsBackingRect.y - layoutRect.y } : null;
const railRect = managementRect && railButtonUnion ? { x: managementRect.x, y: managementRect.y, width: railButtonUnion.width, height: managementRect.height } : null;
const panelRect = managementRect && railRect ? { x: railRect.x + railRect.width, y: managementRect.y, width: managementRect.width - railRect.width, height: managementRect.height } : null;
const graphicsRect = graphicsBackingRect && managementRect ? { x: managementRect.x + managementRect.width + 1, y: graphicsBackingRect.y, width: graphicsBackingRect.x + graphicsBackingRect.width - (managementRect.x + managementRect.width + 1), height: graphicsBackingRect.height } : null;
const zones = [
  toZone('mainMenu', mainMenuNode, clientWidth, clientHeight, 'Exact UIA Menu rect; application controls outside the menu are separate.'),
  toZone('commandSearch', searchNode, clientWidth, clientHeight, 'Exact UIA Edit rect.'),
  fromPhysicalRect('documentTabs', documentTabsRect, dpiX, dpiY, clientWidth, clientHeight, 'mixed', 0.95, 'Bounded by UIA ContextPresenter top and LayoutPresenter top.'),
  fromPhysicalRect('instrumentArea', instrumentRect, dpiX, dpiY, clientWidth, clientHeight, 'mixed', 0.95, 'Bounded by UIA LayoutPresenter top and D3View top.'),
  toZone('workspaceTabs', workspaceNode, clientWidth, clientHeight, 'Active Solid Modeling workspace selector UIA rect.'),
  fromPhysicalRect('commandRibbon', instrumentRect, dpiX, dpiY, clientWidth, clientHeight, 'mixed', 0.95, 'Command ribbon bounds derived from UIA command rows and D3View boundary.'),
  fromPhysicalRect('managementRail', railRect, dpiX, dpiY, clientWidth, clientHeight, 'mixed', 0.95, 'Width from UIA TabButton union; height from docked TabControl.'),
  fromPhysicalRect('managementPanel', panelRect, dpiX, dpiY, clientWidth, clientHeight, 'mixed', 0.95, 'Docked TabControl minus the UIA rail width.'),
  fromPhysicalRect('treePanel', panelRect, dpiX, dpiY, clientWidth, clientHeight, 'mixed', 0.95, 'Tree is the selected idle Part tab; rect equals the visible management panel content.'),
  fromPhysicalRect('graphicsArea', graphicsRect, dpiX, dpiY, clientWidth, clientHeight, 'mixed', 0.9, 'D3View backing rect clipped at the UIA dock splitter boundary.'),
  fromPhysicalRect('quickAccess', quickAccessRect, dpiX, dpiY, clientWidth, clientHeight, 'uia', 1, 'Union of visible direct UIA children in WorkareaControl quick-access row.'),
].filter(Boolean);
const allMajorZones = ['mainMenu', 'commandSearch', 'documentTabs', 'instrumentArea', 'workspaceTabs', 'commandRibbon', 'managementRail', 'managementPanel', 'treePanel', 'parametersPanel', 'graphicsArea', 'quickAccess', 'statusBar'];
const clientDip = { width: round(clientWidth * 96 / dpiX), height: round(clientHeight * 96 / dpiY) };
const clientScreen = raw.window.ClientRectScreenPhysicalPx ?? raw.window.clientRectScreenPhysicalPx;
const clientScreenRect = { x: Number(clientScreen.X ?? clientScreen.x), y: Number(clientScreen.Y ?? clientScreen.y) };
const spacesValidation = coordinateValidation(nodes, clientScreenRect, dpiX, dpiY, clientWidth, clientHeight);
const screenshotPipelineResult = raw.screenshot.windowWasForeground && raw.screenshot.windowWasUnobscured && !raw.screenshot.cursorIncluded && !raw.screenshot.scaledAfterCapture && raw.screenshot.width === clientWidth && raw.screenshot.height === clientHeight ? 'PASS' : 'FAIL';
const dpiAwareResult = environment.windows.dpiAwareness === 'per-monitor-v2' && dpiX > 0 && dpiY > 0 ? 'PASS' : 'FAIL';
const requiredBaselineFields = ['kompasVersion', 'uiLanguage', 'theme', 'uiSize', 'iconStyle', 'panelConfiguration', 'windowsTextScale', 'highContrast'];
const baselineFields = environment.baselineConfirmation?.fields ?? {};
const allBaselineFieldsPass = requiredBaselineFields.every((field) => baselineFields[field]?.result === 'PASS');
const canonicalBaselineResult = raw.canonicalBaselineConfirmed === true &&
  environment.canonicalBaselineConfirmed === true &&
  environment.baselineConfirmation?.result === 'PASS' &&
  allBaselineFieldsPass &&
  environment.kompas.productVersion === 'v25' &&
  environment.kompas.uiLanguage === 'ru-RU' &&
  environment.kompas.theme === 'light' &&
  environment.kompas.uiSizeMode === 'standard' &&
  environment.kompas.iconStyle === 'monochrome' &&
  environment.kompas.panelConfiguration === 'normal-docked-desktop' &&
  environment.windows.textScalePercent === 100 &&
  environment.windows.highContrastEnabled === false ? 'PASS' : 'FAIL';
const layout = {
  schemaVersion: 1,
  stateId: args.state,
  capturedAt: raw.screenshot.capturedAt,
  canonicalBaselineConfirmed: raw.canonicalBaselineConfirmed,
  coordinateSpaces: {
    measurement: 'physical-screen-px',
    physical: 'kompas-client-physical-px',
    canonicalSource: 'kompas-client-dip',
    normalized: 'kompas-client-normalized',
    target: 'browser-css-px',
    dipFormula: 'clientDip = clientPhysicalPx * 96 / windowDpi',
  },
  window: {
    hwnd: `0x${Number(raw.window.Hwnd ?? raw.window.hwnd).toString(16).toUpperCase()}`,
    title: raw.window.Title ?? raw.window.title,
    dpi: { x: dpiX, y: dpiY },
    windowsScalePercent: raw.window.WindowsScalePercent ?? raw.window.windowsScalePercent,
    clientPhysicalPx: { width: clientWidth, height: clientHeight },
    clientDip,
    clientNormalized: { width: 1, height: 1 },
  },
  provenance: {
    environmentPath: relative(root, join(root, raw.environmentPath)).replaceAll('\\', '/'),
    environmentSha256: raw.environmentSha256,
    captureToolGitSha: raw.captureToolGitSha,
    baselineConfirmationResult: environment.baselineConfirmation?.result ?? 'FAIL',
    screenshot: raw.screenshot,
    kompas: {
      processName: environment.kompas.processName,
      productVersion: environment.kompas.productVersion,
      fileVersion: environment.kompas.fileVersion,
    },
  },
  stability: raw.stability,
  uiaCoverage: {
    result: uia.coverage,
    totalNodeCount: uia.totalNodeCount,
    visibleNodeCount: uia.visibleNodeCount,
    validBoundingRectCount: uia.validBoundingRectCount,
    namedNodeCount: uia.namedNodeCount,
  },
  zones,
  unresolvedMajorZones: allMajorZones.filter((id) => !zones.some((zone) => zone.id === id)),
  validations: {
    canonicalBaseline: canonicalBaselineResult,
    dpiAwareCapture: dpiAwareResult,
    dpiConversion: spacesValidation.maxDipConversionError <= 0.01 && spacesValidation.validatedNodeCount > 0 ? 'PASS' : 'FAIL',
    coordinateSpace: spacesValidation,
    screenshotPipeline: screenshotPipelineResult,
    stateStability: raw.stability.stabilityResult,
    partEmpty: graphicsNode && managementNode && firstMatching(nodes, [/Дерево/i]) ? 'PASS' : 'FAIL',
  },
};
validateLayout(layout);
assert(layout.validations.dpiAwareCapture === 'PASS', 'capture process is not Per-Monitor V2 DPI-aware');
assert(layout.validations.coordinateSpace.result === 'PASS', 'coordinate space validation failed');
assert(layout.validations.screenshotPipeline === 'PASS', 'screenshot provenance validation failed');
assert(layout.validations.stateStability === 'PASS', 'state stabilization failed');
assert(layout.validations.partEmpty === 'PASS', 'part-empty evidence was not found');
writeFileSync(join(stateDir, 'layout.json'), `${JSON.stringify(layout, null, 2)}\n`);
writeFileSync(join(stateDir, 'layout.svg'), buildSvg(layout));

const baselineResults = requiredBaselineFields.map((field) => `${field}=${baselineFields[field]?.result ?? 'FAIL'}`).join(', ');
const notes = `# KOMPAS-3D v25 — part-empty capture\n\n- State: temporary empty Part; no geometry created or saved.\n- Canonical baseline confirmed: ${layout.canonicalBaselineConfirmed}; validation=${layout.validations.canonicalBaseline}.\n- Baseline evidence: ${baselineResults}.\n- Physical client: ${clientWidth} x ${clientHeight} px.\n- Client DIP: ${clientDip.width} x ${clientDip.height} DIP at ${dpiX}/${dpiY} DPI.\n- UIA: ${uia.coverage}; ${uia.visibleNodeCount} visible Control View nodes.\n- Major zones resolved: ${zones.length ? zones.map((zone) => zone.id).join(', ') : 'none'}.\n- Unresolved zones: ${layout.unresolvedMajorZones.length ? layout.unresolvedMajorZones.join(', ') : 'none'}. No rectangles were invented.\n- Coordinate-space validation: ${layout.validations.coordinateSpace.result}; ${layout.validations.coordinateSpace.validatedNodeCount} nodes; max DIP error ${layout.validations.coordinateSpace.maxDipConversionError}.\n- DPI-aware capture: ${layout.validations.dpiAwareCapture}; screenshot pipeline: ${layout.validations.screenshotPipeline}.\n- Screenshot is local only: ${raw.screenshot.localPath}\n- Screenshot SHA-256: ${raw.screenshot.sha256}\n- Screenshot method: ${raw.screenshot.captureMethod}; foreground=${raw.screenshot.windowWasForeground}; unobscured=${raw.screenshot.windowWasUnobscured}; cursorIncluded=${raw.screenshot.cursorIncluded}; scaledAfterCapture=${raw.screenshot.scaledAfterCapture}.\n- Stabilization: ${raw.stability.stabilityResult}; ${raw.stability.stableSamples} stable samples, ${raw.stability.sampleIntervalMs} ms interval, ${raw.stability.settleDurationMs} ms settle duration.\n- Capture tool Git SHA: ${raw.captureToolGitSha}.\n- Environment SHA-256: ${raw.environmentSha256}.\n`;
writeFileSync(join(stateDir, 'notes.md'), notes);

const manifestPath = join(root, 'manifest.json');
const manifest = {
  schemaVersion: 1,
  referenceProduct: 'KOMPAS-3D v25',
  captureToolVersion: 1,
  baseline: {
    targetClientPx: { width: 1920, height: 1080 },
    actualClientPx: { width: clientWidth, height: clientHeight },
    actualClientDip: clientDip,
    windowsScalePercent: layout.window.windowsScalePercent,
    windowsTextScalePercent: environment.windows.textScalePercent,
    highContrastEnabled: environment.windows.highContrastEnabled,
    kompasUiSize: environment.kompas.uiSizeMode,
    canonicalBaselineConfirmed: layout.canonicalBaselineConfirmed,
    baselineConfirmationResult: environment.baselineConfirmation?.result ?? 'FAIL',
  },
  states: [{
    id: args.state,
    captured: true,
    localScreenshotPath: raw.screenshot.localPath,
    screenshotSha256: raw.screenshot.sha256,
    actualClientSize: { width: clientWidth, height: clientHeight },
    actualClientDip: clientDip,
    uiaCoverage: uia.coverage,
    layoutPath: `states/${args.state}/layout.json`,
    uiaTreePath: `states/${args.state}/uia-tree.json`,
    svgPath: `states/${args.state}/layout.svg`,
    notesPath: `states/${args.state}/notes.md`,
    validations: layout.validations,
  }],
};
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
rmSync(rawPath);

for (const path of [manifestPath, join(root, 'environment.json'), join(stateDir, 'layout.json'), join(stateDir, 'uia-tree.json')]) {
  readJson(path);
}
const schemaRoot = resolve(import.meta.dirname, 'schemas');
const layoutSchema = readJson(join(schemaRoot, 'kompas-layout.schema.json'));
const stateSchema = readJson(join(schemaRoot, 'kompas-state.schema.json'));
validateAgainstSchema(layout, layoutSchema, layoutSchema);
validateAgainstSchema(uia, stateSchema, stateSchema);
process.stdout.write(`Validated Stage 0 JSON and generated ${basename(stateDir)}/layout.svg (${zones.length} UIA-derived zones).\n`);
