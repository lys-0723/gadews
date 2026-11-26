import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { buildPublication, publishSurveillanceData, verifySurveillanceData } from "./publish-surveillance-data";

const sha = (b: Buffer) => createHash("sha256").update(b).digest("hex");
const event = { event_id: "x", country: "China", disease_id: "WSD", disease_name: "White spot", event_start_date: "2025-01-01", latitude: 0, longitude: 0, access_date: "2026-05-18" };
const row = { summary_id: "same", country_or_territory: "China", disease_id: "WSD", disease_name: "White spot", year: 2025, quarter: 4, report_period: "2025 Q4", status_summary: "no_information", source: "NACA QAAD", source_type: "regional_quarterly_surveillance_summary", organization: "NACA", latitude: 0, longitude: 0, positive_months: [], source_urls: ["https://enaca.org/?id=8"], report_file_urls: ["https://enaca.org/a.xlsx"], monthly_records: [{ secret: "unused" }] };
const w = Buffer.from(JSON.stringify([event], null, 2));
const q = Buffer.from(JSON.stringify([row, { ...row, status_summary: "absent_in_report_year" }]));
const identity = { wahis: { sha256: sha(w), recordCount: 1 }, qaad: { sha256: sha(q), recordCount: 2 } };

test("projection preserves duplicate rows, status and source evidence without nested payload", () => {
  const output = buildPublication(w, q, identity);
  const data = JSON.parse(output.data.toString());
  assert.equal(data.length, 2); assert.equal(data[0].summary_id, data[1].summary_id);
  assert.equal(data[1].status_summary, "absent_in_report_year");
  assert.deepEqual(data[0].source_urls, ["https://enaca.org/?id=8"]);
  assert.deepEqual(data[0].report_file_urls, ["https://enaca.org/a.xlsx"]);
  assert.equal("monthly_records" in data[0], false);
  assert.equal(output.manifest.sources.qaad.retrievedAt, null);
  assert.deepEqual(output.manifest.sources.qaad.coverage, { from: "2025 Q4", to: "2025 Q4" });
  assert.equal(output.manifest.sources.wahis.retrievedAt, "2026-05-18");
});

test("LF and CRLF inputs produce identical manifests and repeated generation is exact", () => {
  const a = buildPublication(w, q, identity);
  const b = buildPublication(Buffer.from(w.toString().replaceAll("\n", "\r\n")), q, identity);
  assert.deepEqual(a, b);
  assert.equal(a.manifest.sources.wahis.outputBytes, w.length);
  assert.equal(a.manifest.sources.wahis.outputHashMode, "lf-normalized-utf8");
  assert.equal(a.data.at(-1), 10);
});

test("bad hashes, shape, row counts and over-size evidence reject publication", () => {
  assert.throws(() => buildPublication(w, q, { ...identity, qaad: { ...identity.qaad, sha256: "0".repeat(64) } }));
  for (const data of [Buffer.from("null"), Buffer.from('[{"summary_id":"missing fields"}]')]) {
    assert.throws(() => buildPublication(w, data, { ...identity, qaad: { sha256: sha(data), recordCount: 1 } }));
  }
  assert.throws(() => buildPublication(w, q, { ...identity, qaad: { ...identity.qaad, recordCount: 1 } }));
  const large = Buffer.from(JSON.stringify([{ ...row, epidemiological_comments: ["x".repeat(2_097_152)] }]));
  assert.throws(() => buildPublication(w, large, { ...identity, qaad: { sha256: sha(large), recordCount: 1 } }), /2 MiB/);
});

test("real source publication is exact, verify is read-only, corruption preserves existing outputs", async () => {
  const root = await mkdtemp(join(tmpdir(), "gadews-publication-"));
  try {
    await mkdir(join(root, "public/data"), { recursive: true });
    await mkdir(join(root, "data/runtime-baseline"), { recursive: true });
    for (const name of ["woah-wahis-aquatic-disease-reports.geo.json", "qaad-regional-surveillance-summary.json"]) await writeFile(join(root, "public/data", name), await readFile(`public/data/${name}`));
    await writeFile(join(root, "data/runtime-baseline/manifest.json"), await readFile("data/runtime-baseline/manifest.json"));
    await assert.rejects(verifySurveillanceData(root));
    await publishSurveillanceData(root);
    const file = join(root, "public/data/qaad-surveillance-display.json");
    const packed = await readFile(file); const projected = JSON.parse(packed.toString());
    assert.equal(projected.length, 1789); assert.ok(packed.length <= 2_097_152);
    const original: Array<Record<string, unknown>> = JSON.parse(await readFile("public/data/qaad-regional-surveillance-summary.json", "utf8"));
    for (let i = 0; i < original.length; i++) for (const [key, value] of Object.entries(projected[i])) assert.deepEqual(value, original[i][key]);
    await verifySurveillanceData(root); assert.deepEqual(await readFile(file), packed);
    await publishSurveillanceData(root); assert.deepEqual(await readFile(file), packed);
    await writeFile(file, "independent output");
    await assert.rejects(verifySurveillanceData(root));
    assert.equal(await readFile(file, "utf8"), "independent output");
    await writeFile(join(root, "public/data/qaad-regional-surveillance-summary.json"), "[]");
    await assert.rejects(publishSurveillanceData(root));
    assert.equal(await readFile(file, "utf8"), "independent output");
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("publication refuses symlink paths outside its project root", async () => {
  const root = await mkdtemp(join(tmpdir(), "gadews-publication-path-"));
  const outside = await mkdtemp(join(tmpdir(), "gadews-outside-"));
  try {
    await symlink(outside, join(root, "public"));
    await assert.rejects(publishSurveillanceData(root), /symlink|escape/i);
  } finally { await rm(root, { recursive: true, force: true }); await rm(outside, { recursive: true, force: true }); }
});
