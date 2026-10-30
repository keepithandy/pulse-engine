import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { chromium, webkit } from "playwright";
const root = resolve(".");
const server = createServer(async (request, response) => {
  try {
    const path = resolve(root, `.${new URL(request.url, 'http://localhost').pathname}`);
    if (!path.startsWith(root + sep)) throw new Error("Path outside root.");
    response.setHeader('Content-Type', path.endsWith('.js') ? 'text/javascript' : path.endsWith('.css') ? 'text/css' : path.endsWith('.json') ? 'application/json' : 'text/html');
    response.end(await readFile(path));
  } catch { response.writeHead(404); response.end(); }
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
let browser;
try {
  const name = process.env.PULSE_BROWSER ?? 'chromium';
  const type = { chromium, webkit }[name];
  if (!type) throw new Error(`Unsupported browser: ${name}`);
  browser = await type.launch({ headless: true, ...(process.env.PULSE_BROWSER_PATH ? { executablePath: process.env.PULSE_BROWSER_PATH } : {}) });
  const page = await browser.newPage();
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/test/browser-fixture.html`);
  await page.waitForFunction(() => window.pulseResult !== undefined);
  const result = await page.evaluate(() => window.pulseResult);
  if (!result.ok || errors.length) throw new Error(JSON.stringify({ result, errors }));
  console.log(`${name}: native ES module import, dispatch, rules, scheduling, restore, diagnostics, recording and replay execution passed.`);
  // Exercise the actual simulator dashboard in both supported browser engines.
  await page.goto(`http://127.0.0.1:${server.address().port}/dashboard/index.html`);
  await page.waitForFunction(() => document.getElementById("status")?.dataset.kind === "success");
  if (await page.locator("#resource-value").textContent() !== "2") throw Error("Default dashboard scenario did not initialize.");
  await page.locator("#step-button").click();
  await page.waitForFunction(() => document.getElementById("tick-value")?.textContent === "1");
  let state = JSON.parse(await page.locator("#state-json").textContent());
  if (state.resources.energy !== 2 || state.resources.water !== 11) throw Error("Dashboard step did not execute the real resource-flow system.");
  await page.locator("#tick-count").fill("9");
  await page.locator("#run-button").click();
  await page.waitForFunction(() => document.getElementById("tick-value")?.textContent === "10");
  state = JSON.parse(await page.locator("#state-json").textContent());
  if (state.resources.energy !== 20 || state.resources.water !== 20 ||
      await page.locator("#event-value").textContent() !== "30") throw Error("Dashboard run/state/event results differ from expected scenario.");
  await page.locator("#verify-button").click();
  await page.waitForFunction(() => document.getElementById("verify-result")?.dataset.result === "pass");
  await page.locator("#scenario-json").fill("{ bad json");
  await page.locator("#apply-button").click();
  await page.waitForFunction(() => document.getElementById("status")?.dataset.kind === "error");
  if (await page.locator("#tick-value").textContent() !== "10") throw Error("Invalid JSON destroyed the active engine.");
  await page.locator("#reset-button").click();
  await page.waitForFunction(() => document.getElementById("tick-value")?.textContent === "0");
  state = JSON.parse(await page.locator("#state-json").textContent());
  if (state.resources.energy !== 0 || state.resources.water !== 10) throw Error("Dashboard reset did not restore the applied scenario.");
  const downloadPromise = page.waitForEvent("download");
  await page.locator("#export-button").click();
  const download = await downloadPromise;
  if (download.suggestedFilename() !== "pulse-checkpoint-tick-0.json") throw Error("Dashboard checkpoint export filename mismatch.");
  await page.locator("#preset").selectOption("minimal");
  await page.waitForFunction(() => document.getElementById("status")?.dataset.kind === "success" &&
    document.getElementById("resource-value")?.textContent === "0");
  if (errors.length) throw new Error("Dashboard browser errors: " + JSON.stringify(errors));
  console.log(`${name}: simulator dashboard preset, step, batch run, events, determinism, invalid input, reset and checkpoint export passed.`);
} finally {
  await browser?.close();
  await new Promise(done => server.close(done));
}
