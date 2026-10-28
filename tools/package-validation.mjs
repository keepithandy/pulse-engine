import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

export function validatePackage(manifest, packedFiles, exists = existsSync) {
  const fail = message => { throw new Error(`Package integrity: ${message}`); };
  if (!manifest.repository?.url || !manifest.homepage || !manifest.bugs?.url || !Array.isArray(manifest.keywords) || !manifest.keywords.length) fail("missing discoverability metadata.");
  if (manifest.repository.type !== "git") fail("repository must be a git URL.");
  if (!manifest.types || !manifest.exports?.["."]?.import || manifest.exports["."].types !== manifest.types) fail("root import and declarations must be explicit.");
  const destinations = [manifest.types, manifest.exports["."].import, ...Object.values(manifest.bin ?? {})];
  for (const target of destinations) {
    if (typeof target !== "string" || !/^\.\/[a-zA-Z0-9_./-]+$/.test(target) || target.includes("..") || !exists(target.slice(2))) fail(`missing or unsafe destination: ${target}`);
  }
  if (!packedFiles.length) fail("empty package.");
  for (const entry of packedFiles) {
    const name = entry.path.replace(/\\/g, "/");
    if (!/^(src\/|bin\/|scenarios\/|docs\/|README\.md$|LICENSE$|package\.json$)/.test(name)) fail(`private or unexpected packed file: ${name}`);
  }
  for (const target of destinations) if (!packedFiles.some(file => file.path === target.slice(2))) fail(`destination omitted from tarball: ${target}`);
  return packedFiles.length;
}

