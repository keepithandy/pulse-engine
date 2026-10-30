import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const fixedRoutes = new Map([
  ["/", ["dashboard/index.html", "text/html"]],
  ["/dashboard", ["dashboard/index.html", "text/html"]],
  ["/dashboard/", ["dashboard/index.html", "text/html"]],
  ["/dashboard/index.html", ["dashboard/index.html", "text/html"]],
  ["/dashboard/app.js", ["dashboard/app.js", "text/javascript"]],
  ["/dashboard/style.css", ["dashboard/style.css", "text/css"]],
  ["/scenarios/minimal.json", ["scenarios/minimal.json", "application/json"]],
  ["/scenarios/resource-network.json", ["scenarios/resource-network.json", "application/json"]]
]);

function routeFor(pathname) {
  if (fixedRoutes.has(pathname)) return fixedRoutes.get(pathname);
  if (/^\/src\/[a-z][a-z0-9-]*\.js$/.test(pathname)) return [pathname.slice(1), "text/javascript"];
  return null;
}

export function createDashboardServer() {
  return createServer(async (request, response) => {
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Referrer-Policy", "no-referrer");
    response.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
    if (request.method !== "GET" && request.method !== "HEAD") {
      response.writeHead(405, { Allow: "GET, HEAD" });
      response.end("Method not allowed");
      return;
    }
    let route;
    try {
      route = routeFor(new URL(request.url, "http://localhost").pathname);
    } catch {
      response.writeHead(400);
      response.end("Bad request");
      return;
    }
    if (!route) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }
    try {
      const [relative, type] = route;
      const bytes = await readFile(resolve(root, relative));
      response.writeHead(200, { "Content-Type": type + "; charset=utf-8" });
      response.end(request.method === "HEAD" ? undefined : bytes);
    } catch {
      response.writeHead(404);
      response.end("Not found");
    }
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PULSE_DASHBOARD_PORT ?? 4173);
  if (!Number.isSafeInteger(port) || port < 0 || port > 65535) {
    console.error("PULSE_DASHBOARD_PORT must be a valid port (0-65535).");
    process.exitCode = 1;
  } else {
    const server = createDashboardServer();
    server.on("error", error => {
      console.error("Dashboard server:", error.message);
      process.exitCode = 1;
    });
    server.listen(port, "127.0.0.1", () => {
      console.log("Pulse Engine simulator dashboard: http://127.0.0.1:" + server.address().port + "/dashboard/");
      console.log("Local only. Press Ctrl+C to stop.");
    });
  }
}
