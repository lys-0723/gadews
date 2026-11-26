import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { gzipSync } from "node:zlib";
import { restoreRuntimeData, verifyRuntimeData } from "./restore-runtime-data";

const digest = (data: Buffer) => createHash("sha256").update(data).digest("hex");

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "gadews-restore-test-"));
  const raw = Buffer.from('[{"source":"QAAD","text":"原始资料"}]\r\n');
  const packed = gzipSync(raw);
  const resource = {
    source: "data/runtime-baseline/example.json.gz",
    target: "public/data/example.json",
    rawBytes: raw.length,
    rawSha256: digest(raw),
    compressedSha256: digest(packed),
  };
  await mkdir(join(root, "data/runtime-baseline"), { recursive: true });
  await writeFile(join(root, resource.source), packed);
  const saveManifest = () => writeFile(join(root, "data/runtime-baseline/manifest.json"), JSON.stringify({ schemaVersion: 1, resources: [resource] }));
  await saveManifest();
  return { root, raw, resource, saveManifest, cleanup: () => rm(root, { recursive: true, force: true }) };
}

test("restores exact bytes and leaves an already valid resource untouched", async () => {
  const f = await fixture();
  try {
    assert.equal((await restoreRuntimeData(f.root))[0].status, "restored");
    const target = join(f.root, f.resource.target);
    assert.deepEqual(await readFile(target), f.raw);
    const before = await stat(target);
    assert.equal((await restoreRuntimeData(f.root))[0].status, "unchanged");
    assert.equal((await stat(target)).mtimeMs, before.mtimeMs);
    assert.equal((await verifyRuntimeData(f.root))[0].status, "verified");
  } finally { await f.cleanup(); }
});

test("verification never restores a missing file", async () => {
  const f = await fixture();
  try {
    await assert.rejects(verifyRuntimeData(f.root), /missing/i);
    await assert.rejects(stat(join(f.root, f.resource.target)), { code: "ENOENT" });
  } finally { await f.cleanup(); }
});

test("refuses an independently changed target without overwriting it", async () => {
  const f = await fixture();
  try {
    await mkdir(dirname(join(f.root, f.resource.target)), { recursive: true });
    const independent = Buffer.from("user update");
    await writeFile(join(f.root, f.resource.target), independent);
    await assert.rejects(restoreRuntimeData(f.root), /conflict/i);
    assert.deepEqual(await readFile(join(f.root, f.resource.target)), independent);
  } finally { await f.cleanup(); }
});

test("rejects corrupted packed or raw data before publishing a target", async () => {
  for (const field of ["compressedSha256", "rawSha256"] as const) {
    const f = await fixture();
    try {
      f.resource[field] = "0".repeat(64);
      await f.saveManifest();
      await assert.rejects(restoreRuntimeData(f.root), /checksum/i);
      await assert.rejects(stat(join(f.root, f.resource.target)), { code: "ENOENT" });
    } finally { await f.cleanup(); }
  }
});

test("rejects an escaping manifest path", async () => {
  const f = await fixture();
  try {
    f.resource.target = "../outside.json";
    await f.saveManifest();
    await assert.rejects(restoreRuntimeData(f.root), /path/i);
  } finally { await f.cleanup(); }
});

test("refuses a symlink target directory", async () => {
  const f = await fixture();
  const outside = await mkdtemp(join(tmpdir(), "gadews-restore-outside-"));
  try {
    await mkdir(join(f.root, "public"), { recursive: true });
    await symlink(outside, join(f.root, "public/data"), "dir");
    await assert.rejects(restoreRuntimeData(f.root), /symlink|path/i);
    await assert.rejects(stat(join(outside, "example.json")), { code: "ENOENT" });
  } finally { await f.cleanup(); await rm(outside, { recursive: true, force: true }); }
});
