import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { activateFusionCircle, assertNoPageErrors, cancelFusionCircle, createFusionPart,
  launchFusionBrowser, newFusionPage, saveFusionDocument } from './FusionBrowserHarness.mjs';

const home = process.env.ASA_CAD_SHELL_URL ?? 'http://127.0.0.1:18190/';
const out = process.env.ASA_FUSION_CAMERA_DIR ?? 'test-results/fus-a05-camera';
const STAGE = '[data-testid="part-model-stage"]';
const SOLID = '.live-workarea[data-workspace="solid"]';
const FINISH = '[data-palette-command="sketch.finish"]';
const SKP = '.live-parameters[data-command="part.sketch.create"]';
const CIRC = '.live-parameters[data-command="sketch.circle"]';
const r = { task: 'FUS/A05', status: 'RUNNING', cases: [] };
let browser,page,failure,projectId,errors=[];
const near=(a,b,m,t=.5)=>assert.ok(Math.abs(a-b)<=t,m);
const shot=n=>page.screenshot({path:out+'/'+n});
const step = async (name, run) => {
  const item = { name, status: 'RUNNING' }; r.cases.push(item);
  try { await run(item); assertNoPageErrors(errors, name); item.status = 'PASS'; }
  catch (e) { item.status = 'FAIL'; item.error = String(e.message); throw e; }
};
async function cam() {
  return page.evaluate(sel => {
    const c = document.querySelector('[data-testid="cad-viewport"] canvas');
    const s = JSON.parse(c.dataset.cameraSnapshot ?? 'null');
    const d = document.querySelector(sel).dataset;
    return { vis: getComputedStyle(c).visibility, plane: d.sketchSupport, raw: s,
      ok: !!(s&&s.actualProjection==='orthographic'&&s.revision>=1&&[s.viewMatrix,s.projectionMatrix,s.inverseViewMatrix,s.inverseProjectionMatrix].every(m=>m.length===16&&m.every(Number.isFinite))) };
  }, STAGE);
}
async function aligned() {
  await page.waitForFunction(sel => (document.querySelector(sel)?.dataset.camera ?? '').endsWith(':aligned'), STAGE);
  return cam();
}
const basis = { XY: [[0, 0, 0], [1, 0, 0], [0, 1, 0]], XZ: [[0, 0, 0], [1, 0, 0], [0, 0, 1]], YZ: [[0, 0, 0], [0, 1, 0], [0, 0, 1]] };
function project(st, pts) {
  const b = basis[st.plane], s = st.raw, rc = s.rect;
  const mul = (m, v) => [0, 1, 2, 3].map(i => m[i]*v[0]+m[4+i]*v[1]+m[8+i]*v[2]+m[12+i]*v[3]);
  return pts.map(([x, y]) => {
    const p = [b[0][0]+b[1][0]*x+b[2][0]*y, b[0][1]+b[1][1]*x+b[2][1]*y, b[0][2]+b[1][2]*x+b[2][2]*y, 1];
    const c = mul(s.projectionMatrix, mul(s.viewMatrix, p));
    return [rc.left+(c[0]/c[3]+1)*rc.width/2, rc.top+(1-c[1]/c[3])*rc.height/2];
  });
}
const groupPoint = xy => page.evaluate(([x, y]) => { const p = new DOMPoint(x, y).matrixTransform(document.querySelector('[data-sketch-layer="grid"]').firstElementChild.getScreenCTM()); return [p.x, p.y]; }, xy);
const svgPoint = (sel, x, y) => page.evaluate(([sel, x, y]) => { const p = new DOMPoint(x, y).matrixTransform(document.querySelector(sel).getScreenCTM()); return [p.x, p.y]; }, [sel, x, y]);
async function gridState() {
  return page.evaluate(sel => {
    const svg = document.querySelector('[data-sketch-layer="grid"]');
    const [a, b, c, d, e, f] = svg.firstElementChild.getAttribute('transform').match(/\((.*)\)/)[1].split(/\s+/).map(Number);
    const r = document.querySelector(sel).getBoundingClientRect();
    return { a, b, c, d, e, f, viewBox: svg.getAttribute('viewBox'), par: svg.getAttribute('preserveAspectRatio'), l: r.left, t: r.top, w: r.width, h: r.height };
  }, STAGE);
}
async function makeSketch(plane) {
  await page.locator('.live-top [data-command-id="part.sketch.create"]').click();
  await page.locator(SKP).getByLabel('Плоскость эскиза').selectOption(plane);
  await page.locator(SKP).locator('.live-commit').click();
  await page.locator(`${STAGE}[data-sketch-support="${plane}"]`).waitFor();
  return aligned();
}
try {
  await mkdir(out, { recursive: true });
  browser=await launchFusionBrowser();
  ({page,errors}=await newFusionPage(browser));
  await page.goto(home);
  projectId=await createFusionPart(page,'A05');
  const finish = async () => { await page.locator(FINISH).click(); await page.locator(SOLID).waitFor(); };
  const planeAligned = async st => {
    assert.equal(st.vis, 'hidden'); assert.ok(st.ok);
    const rc = st.raw.rect, [p0] = project(st, [[0, 0]]);
    near(Math.hypot(p0[0]-(rc.left+rc.width/2), p0[1]-(rc.top+rc.height/2)), 0, st.plane + ' origin', 1);
  };
  await step('XZ: aligned mapping, 3D suppressed', async () => planeAligned(await makeSketch('XZ')));
  await step('YZ: aligned mapping, 3D suppressed', async () => { await finish(); planeAligned(await makeSketch('YZ')); });
  await step('XY: aligned mapping, 3D suppressed', async () => {
    await finish();
    const st = await makeSketch('XY');
    assert.equal(st.vis, 'hidden');
    assert.ok(st.ok);
    const [p0, p1, p2] = project(st, [[0, 0], [1, 0], [0, 1]]);
    const m = await gridState();
    near(Math.hypot(m.a-(p1[0]-p0[0]), m.b-(p1[1]-p0[1])), 0, 'u-axis');
    near(Math.hypot(m.c+(p2[0]-p0[0]), m.d+(p2[1]-p0[1])), 0, 'v-axis -v');
    near(Math.hypot(m.e-(p0[0]-m.l), m.f-(p0[1]-m.t)), 0, 'origin');
    assert.equal(m.par, 'none'); assert.equal(m.viewBox, `0 0 ${m.w} ${m.h}`);
  });
  await step('XY: CTM, Circle (20,10)', async () => {
    await activateFusionCircle(page);
    const st = await aligned();
    const [exp] = project(st, [[20, 10]]);
    const dom = await groupPoint([20, -10]);
    near(Math.hypot(dom[0]-exp[0], dom[1]-exp[1]), 0, 'ctm');
    await page.mouse.click(dom[0], dom[1]);
    await page.locator(CIRC).getByLabel(/Диаметр/).fill('40');
    await page.keyboard.press('Enter');
    const saved = await saveFusionDocument(page, projectId);
    const en = saved.document.sketches.find(s => s.support === 'XY').entities[0];
    assert.equal(en.type, 'circle');
    near(en.data.center[0], 20, 'cx', 0.15); near(en.data.center[1], 10, 'cy', 0.15);
    near(en.data.diameter, 40, 'd');
    const ent = await svgPoint('.cad-sketch-overlay-entity.circle', 20, -10);
    near(Math.hypot(ent[0]-exp[0], ent[1]-exp[1]), 0, 'entity CTM');
  });
  await step('Invalid draft: no mutation', async () => {
    await activateFusionCircle(page);
    const panel = page.locator(CIRC);
    await panel.getByLabel(/Диаметр/).fill('-40');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(100);
    if (await panel.count()) await cancelFusionCircle(page);
    const saved = await saveFusionDocument(page, projectId);
    assert.equal(saved.document.sketches.find(s => s.support === 'XY').entities.length, 1);
    assert.equal(saved.document.features.length, 0);
  });
  await step('Reopen XY: solid world', async () => {
    await finish();
    await page.locator('.live-timeline button[data-timeline-sketch]').last().click();
    await page.locator(`${STAGE}[data-sketch-support="XY"]`).waitFor();
    await aligned();
    await page.locator(FINISH).click();
    await page.locator('.live-top [data-native-command="Extrude"]').click();
    const panel = page.locator('.live-parameters[data-command="part.extrude"]');
    await panel.getByRole('spinbutton', { name: 'Расстояние', exact: true }).fill('20');
    await panel.locator('.live-commit').click();
    await page.locator('.cad-app[data-feature-count="1"][data-runtime-status="ready"]').waitFor({ timeout: 120_000 });
    const st = await cam();
    assert.equal(st.vis, 'visible');
    assert.ok(st.ok);
    const saved = await saveFusionDocument(page, projectId);
    assert.deepEqual([saved.document.features.length, saved.document.bodies.length], [1, 1]);
    await shot('04.png');
  });
  r.status = 'PASS';
} catch (e) {
  failure = e; r.status = 'FAIL'; r.error = String(e);
  if (page) { try { await shot('f.png'); } catch { } }
} finally {
  r.pageErrors = errors;
  try { await browser?.close(); } catch { }
  await writeFile(path.join(out, 'report.json'), JSON.stringify(r));
}
if (failure) throw failure;
