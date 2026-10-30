import assert from "node:assert/strict";
import test from "node:test";
import { createDashboardServer } from "../tools/dashboard-server.mjs";

test("dashboard server serves only approved files on the loopback listener", async () => {
  const server = createDashboardServer();
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const origin = "http://127.0.0.1:" + server.address().port;
  try {
    const pages = [
      ["/dashboard/", "text/html", "Simulation control room"],
      ["/dashboard/app.js", "text/javascript", "createEngineFromScenario"],
      ["/dashboard/style.css", "text/css", ".workspace"],
      ["/src/index.js", "text/javascript", "createEngine"],
      ["/scenarios/resource-network.json", "application/json", "resource-flow"]
    ];
    for (const [path, contentType, needle] of pages) {
      const response = await fetch(origin + path);
      assert.equal(response.status, 200, path);
      assert.match(response.headers.get("content-type"), new RegExp(contentType));
      assert.equal(response.headers.get("x-content-type-options"), "nosniff");
      assert.match(await response.text(), new RegExp(needle));
    }
    const head = await fetch(origin + "/dashboard/", { method: "HEAD" });
    assert.equal(head.status, 200);
    assert.equal(await head.text(), "");
    for (const path of ["/package.json", "/.git/config", "/docs/getting-started.md",
      "/scenarios/../../package.json", "/src/../package.json", "/src/private.txt"]) {
      const response = await fetch(origin + path);
      assert.equal(response.status, 404, path);
    }
    const post = await fetch(origin + "/dashboard/", { method: "POST" });
    assert.equal(post.status, 405);
    assert.equal(post.headers.get("allow"), "GET, HEAD");
  } finally {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
