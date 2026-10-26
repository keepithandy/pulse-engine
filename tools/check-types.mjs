import { spawnSync } from "node:child_process";
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as runtime from "../src/index.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const compiler = join(dirname(require.resolve("typescript/package.json")), "bin", "tsc");
const npm = process.env.npm_execpath;
if (!npm) throw new Error("Run this check through npm run test:types.");
function run(args, cwd = root) {
  const result = spawnSync(process.execPath, args, { cwd, encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.error?.message ?? `${result.stdout}\n${result.stderr}`);
  return result.stdout;
}
function check(directory) {
  for (const config of ["tsconfig.json", "tsconfig.bundler.json"]) run([compiler, "-p", join(directory, config)]);
}

const declarations = readFileSync(join(root, "src", "index.d.ts"), "utf8");
const declaredExports = [...declarations.matchAll(/^export (?:function|const) (\w+)/gm)].map(match => match[1]).sort();
if (JSON.stringify(declaredExports) !== JSON.stringify(Object.keys(runtime).sort())) throw new Error("Declaration and runtime value exports differ.");
const fixtures = join(root, "fixtures", "types");
check(fixtures);
const tempRoot = resolve(tmpdir());
const consumer = mkdtempSync(join(tempRoot, "pulse-types-"));
try {
  const [packed] = JSON.parse(run([npm, "pack", "--json", "--pack-destination", consumer]));
  writeFileSync(join(consumer, "package.json"), JSON.stringify({ name: "pulse-type-consumer", private: true, type: "module" }));
  run([npm, "install", join(consumer, packed.filename), "--offline", "--ignore-scripts", "--omit=dev", "--no-audit", "--no-fund"], consumer);
  for (const name of ["consumer.mts", "tsconfig.json", "tsconfig.bundler.json"]) copyFileSync(join(fixtures, name), join(consumer, name));
  check(consumer);
  console.log(`All ${declaredExports.length} runtime exports declared; strict NodeNext and Bundler consumers passed from checkout and installed tarball.`);
} finally {
  if (dirname(resolve(consumer)) !== tempRoot || !basename(consumer).startsWith("pulse-types-")) throw new Error("Unexpected type-check cleanup path.");
  rmSync(consumer, { recursive: true, force: true });
}
