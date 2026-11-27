import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { activateFusionCircle, assertNoPageErrors, cancelFusionCircle, createFusionPart,
  launchFusionBrowser, newFusionPage, saveFusionDocument } from './FusionBrowserHarness.mjs';

const home = process.env.ASA_CAD_SHELL_URL ?? 'http://127.0.0.1:18190/';
const out = process.env.ASA_FUSION_CAMERA_DIR ?? 'test-results/fus-a05-camera';
const STAGE = '[data-testid="part-model-stage"]';
const SOLID = '.live-workarea[data-workspace="solid"]';
const FINISH = '[data-palette-command="sketch.finish"]';
const SKP = '.live-parameters[data-command="part.sketch.create"]';
const r = { task: 'FUS/A05', status: 'RUNNING', url: home, cases: [] };
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
    const st = document.querySelector(sel);
    return { stage: st.dataset, vis: getComputedStyle(c).visibility, plane: st.dataset.sketchSupport, raw: s,
      ok: !!(s && s.actualProjection === 'orthographic' && s.revision >= 1 && [s.viewMatrix, s.projectionMatrix, s.inverseViewMatrix, s.inverseProjectionMatrix].every(m=>m.length===16&&m.every(Number.isFinite))) };
  }, STAGE);
}
async function aligned() {
  await page.waitForFunction(sel => (document.querySelector(sel)?.dataset.camera ?? '').endsWith(':aligned'), STAGE);
  return cam();
}
const basis = { XY: [[0, 0, 0], [1, 0, 0], [0, 1, 0]], XZ: [[0, 0, 0], [1, 0, 0], [0, 0, 1]], YZ: [[0, 0, 0], [0, 1, 0], [0, 0, 1]] };
function project(st, pts) {
  const [o, u, v] = basis[st.plane], s = st.raw, rc = s.rect;
  const mul = (m, v) => [0, 1, 2, 3].map(i => m[i]*v[0]+m[4+i]*v[1]+m[8+i]*v[2]+m[12+i]*v[3]);
  return pts.map(([x, y]) => {
    const c = mul(s.projectionMatrix, mul(s.viewMatrix, [o[0]+u[0]*x+v[0]*y, o[1]+u[1]*x+v[1]*y, o[2]+u[2]*x+v[2]*y, 1]));
    return [rc.left+(c[0]/c[3]+1)*rc.width/2, rc.top+(1-c[1]/c[3])*rc.height/2];
  });
}
const svgPoint = (sel, x, y) => page.evaluate(([sel, x, y]) => {
  const p = new DOMPoint(x, y).matrixTransform(document.querySelector(sel).getScreenCTM());
  return [p.x, p.y];
}, [sel, x, y]);
async function gridState() {
  return page.evaluate(sel => {
    const svg = document.querySelector('[data-sketch-layer="grid"]');
    const [a, b, c, d, e, f] = svg.firstElementChild.getAttribute('transform').match(/\((.*)\)/)[1].split(/\s+/).map(Number);
    const box = document.querySelector(sel).getBoundingClientRect();
    return { a, b, c, d, e, f, viewBox: svg.getAttribute('viewBox'), par: svg.getAttribute('preserveAspectRatio'), l: box.left, t: box.top, w: box.width, h: box.height };
  }, STAGE);
}
async function makeSketch(plane) {
  await page.locator('.live-top [data-command-id="part.sketch.create"]').click();
  await page.locator(SKP).getByRole('combobox', { name: 'Плоскость эскиза' }).selectOption(plane);
  await page.locator(SKP).locator('.live-commit').click();
  await page.locator(`${STAGE}[data-sketch-support="${plane}"]`).waitFor();
  return aligned();
}
try {
  await mkdir(out, { recursive: true });
  const git=a=>execFileSync('git',a,{encoding:'utf8'}).trim();
  r.gitHead=git(['rev-parse','HEAD']);
  r.checkoutSha=git(['status','--porcelain=v1'])?'uncommitted':r.gitHead;
  browser=await launchFusionBrowser();
  ({page,errors}=await newFusionPage(browser));
  await page.goto(home);
  projectId=await createFusionPart(page,'FUS A05 Camera');
  await makeSketch('XY');
  await step('XY: real camera, suppressed 3D, one aligned mapping', async item => {
    const st = await aligned();
    assert.equal(st.vis, 'hidden', 'empty-model 3D visuals suppressed');
    assert.ok(st.ok);
    item.camera = st.stage.camera;
    const [p0, p1, p2] = project(st, [[0, 0], [1, 0], [0, 1]]);
    const m = await gridState();
    near(Math.hypot(m.a-(p1[0]-p0[0]), m.b-(p1[1]-p0[1])), 0, 'grid u-axis');
    near(Math.hypot(m.c-(p2[0]-p0[0]), m.d-(p2[1]-p0[1])), 0, 'grid v-axis');
    near(Math.hypot(m.e-(p0[0]-m.l), m.f-(p0[1]-m.t)), 0, 'grid origin', 1);
    assert.equal(m.par, 'none'); assert.equal(m.viewBox, `0 0 ${m.w} ${m.h}`);
    await shot('01-xy-aligned.png');
  });
  await step('XY: safe aligned Circle at (20,10)', async item => {
    await activateFusionCircle(page);
    await page.mouse.click(...await svgPoint('[data-testid="cad-sketch-interaction"][data-tool="circle"]', 20, -10));
    const panel = page.locator('.live-parameters[data-command="sketch.circle"]');
    await panel.getByLabel(/^Диаметр(?:, мм)?$/, { exact: true }).fill('40');
    await page.keyboard.press('Enter');
    const saved = await saveFusionDocument(page, projectId);
    const en = saved.document.sketches[0].entities[0];
    assert.equal(en.type, 'circle');
    near(en.data.center[0], 20, 'cx', 0.15); near(en.data.center[1], 10, 'cy', 0.15);
    near(en.data.diameter, 40, 'd');
    const [exp] = project(await cam(), [[20, 10]]);
    const dom = await svgPoint('.cad-sketch-overlay-entity.circle', 20, -10);
    near(Math.hypot(dom[0]-exp[0], dom[1]-exp[1]), 0, 'entity vs real camera');
    await shot('02-xy-circle.png');
  });
  await step('Cancel keeps document and history', async item => {
    await activateFusionCircle(page); await cancelFusionCircle(page);
    const saved=await saveFusionDocument(page,projectId);
    assert.equal(saved.document.sketches[0].entities.length,1,'cancelled draft must not mutate');
    assert.equal(saved.document.features.length,0);
  });
  await step('XZ/YZ: aligned normal views', async item => {
    for (const plane of ['XZ', 'YZ']) {
      await page.locator(FINISH).click();
      await page.locator(SOLID).waitFor();
      const st = await makeSketch(plane);
      item[plane] = st.stage.camera;
      assert.equal(st.vis, 'hidden'); assert.ok(st.ok);
      const [p0] = project(st, [[0, 0]]);
      const box = await page.locator('[data-testid="cad-viewport"] canvas').boundingBox();
      near(Math.hypot(p0[0]-(box.x+box.width/2), p0[1]-(box.y+box.height/2)), 0, `${plane} origin centered`, 1);
    }
  });
  await step('Reopen XY: aligned again, solid world', async item => {
    await page.locator(FINISH).click();
    await page.locator(SOLID).waitFor();
    await page.getByRole('button', { name: /Редактировать/ }).first().click();
    await page.locator(`${STAGE}[data-sketch-support="XY"]`).waitFor();
    item.camera = (await aligned()).stage.camera;
    await page.locator(FINISH).click();
    await page.locator('.live-top [data-native-command="Extrude"]').click();
    const panel = page.locator('.live-parameters[data-command="part.extrude"]');
    await panel.getByRole('spinbutton', { name: 'Расстояние', exact: true }).fill('20');
    await panel.locator('.live-commit').click();
    await page.locator('.cad-app[data-feature-count="1"][data-runtime-status="ready"]').waitFor({ timeout: 120_000 });
    const st = await cam();
    assert.equal(st.vis, 'visible', 'B-Rep body must keep world rendering');
    assert.ok(st.ok);
    const saved = await saveFusionDocument(page, projectId);
    assert.deepEqual([saved.document.features.length, saved.document.bodies.length], [1, 1]);
    await shot('04-solid-world.png');
  });
  r.status = 'PASS';
} catch (e) {
  failure = e; r.status = 'FAIL'; r.error = String(e.stack ?? e);
  if (page) try { await shot('failure.png'); } catch { }
} finally {
  r.pageErrors = errors;
  try { await browser?.close(); } catch (e) { failure ??= e; }
  await writeFile(path.join(out, 'report.json'), JSON.stringify(r, null, 2) + '\n');
}
if (failure) throw failure;
