import assert from "node:assert/strict";
import test from "node:test";
import { validatePackage } from "../tools/package-validation.mjs";

const manifest = {
  repository: { type: "git", url: "https://github.com/example/sample.git" },
  homepage: "https://github.com/example/sample",
  bugs: { url: "https://github.com/example/sample/issues" },
  keywords: ["simulation"],
  types: "./src/index.d.ts",
  exports: { ".": { types: "./src/index.d.ts", import: "./src/index.js" } },
  bin: { "pulse-run": "./bin/pulse-run.js" }
};
const files = ["src/index.js", "src/index.d.ts", "bin/pulse-run.js", "README.md", "package.json", ...["dispatch", "rules", "world", "schedules", "saves", "inspection"].map(name => `examples/${name}.mjs`)].map(path => ({ path }));
const exists = () => true;

test("package validation accepts declared entry points and safe files", () => {
  assert.equal(validatePackage(manifest, files, exists), files.length);
});
test("package validation rejects private files, missing entry points and unsafe paths", () => {
  assert.throws(() => validatePackage(manifest, [...files, { path: "test/secret.js" }], exists), /unexpected packed file/);
  assert.throws(() => validatePackage(manifest, files.filter(file => file.path !== "examples/dispatch.mjs"), exists), /executable example omitted/);
  assert.throws(() => validatePackage(manifest, files.filter(file => file.path !== "bin/pulse-run.js"), exists), /omitted from tarball/);
  assert.throws(() => validatePackage({ ...manifest, types: "./../secret", exports: { ".": { ...manifest.exports["."], types: "./../secret" } } }, files, exists), /unsafe destination/);
  assert.throws(() => validatePackage({ ...manifest, keywords: [] }, files, exists), /discoverability metadata/);
});
