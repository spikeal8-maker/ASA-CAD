import { readFileSync, writeFileSync } from 'node:fs';

const path = 'tests/m2/part-browser.mjs';
let source = readFileSync(path, 'utf8');

const before = `  const solveStatus = page.locator('[data-testid="sketch-solve-status"][data-solve-status="solved"]');
  await solveStatus.waitFor({ timeout: 60_000 });
  const solvedOverlay = page.locator('[data-testid="cad-sketch-overlay"]');`;
const after = `  const solveStatus = page.locator('[data-testid="sketch-solve-status"]');
  await solveStatus.waitFor({ timeout: 20_000 });
  try {
    await page.waitForFunction(() => {
      const status = document.querySelector('[data-testid="sketch-solve-status"]')?.getAttribute('data-solve-status');
      return status === 'solved' || status === 'error';
    }, null, { timeout: 20_000 });
  } catch {
    // Fall through to the diagnostic assertion below with the current state.
  }
  const solveState = await solveStatus.getAttribute('data-solve-status');
  if (solveState !== 'solved') {
    const diagnostic = await page.locator('[data-testid="sketch-solve-diagnostic"]').textContent().catch(() => null);
    const currentWasm = await loadedWasmResources();
    throw new Error(
      'Sketch solve did not reach solved: status=' + solveState
      + '; diagnostic=' + (diagnostic ?? 'none')
      + '; wasm=' + currentWasm.join(', ')
      + '; pageErrors=' + pageErrors.join(' | ')
      + '; failedRequests=' + failedRequests.join(' | '),
    );
  }
  const solvedOverlay = page.locator('[data-testid="cad-sketch-overlay"]');`;

if (!source.includes(before)) throw new Error('solver wait block not found');
source = source.replace(before, after);
writeFileSync(path, source);
console.log('M3.1 solver browser diagnostics applied');
