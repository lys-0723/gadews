import { createHash, randomUUID } from "node:crypto";
import { lstat, readFile, realpath, rename, unlink, writeFile } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";
import { parseQaad, parseWahis, validDate, type SourceMetadata } from "../lib/gadews/public-surveillance";

export const QAAD_DISPLAY_FIELDS = ["summary_id", "country_or_territory", "region", "year", "quarter", "report_period", "disease_id", "disease_name", "status_summary", "positive_months", "absent_months", "no_information_months", "positive_months_all_year", "diagnosis_levels", "epidemiological_comments", "report_file_urls", "source_urls", "latitude", "longitude", "coordinate_type", "source", "source_type", "organization"] as const;
const WAHIS_PATH = "public/data/woah-wahis-aquatic-disease-reports.geo.json";
const QAAD_PATH = "public/data/qaad-regional-surveillance-summary.json";
const OUTPUT_PATH = "public/data/qaad-surveillance-display.json";
const MANIFEST_PATH = "public/data/surveillance-manifest.json";
const sha = (data: Buffer) => createHash("sha256").update(data).digest("hex");
const normalized = (data: Buffer) => Buffer.from(data.toString("utf8").replaceAll("\r\n", "\n"));
interface Identity { wahis: { sha256: string; recordCount: number }; qaad: { sha256: string; recordCount: number } }
interface PublishedSource extends SourceMetadata {
  sourcePath: string; sourceSha256: string; sourceHashMode: "raw-bytes" | "lf-normalized-utf8";
  outputSha256: string; outputHashMode: "raw-bytes" | "lf-normalized-utf8"; outputBytes: number;
}
export interface SurveillanceManifest { schemaVersion: 1; fieldVersion: 1; sources: { wahis: PublishedSource; qaad: PublishedSource } }
const range = (values: string[]) => { const sorted = [...values].sort(); return { from: sorted[0] ?? null, to: sorted.at(-1) ?? null }; };

export function buildPublication(wahisRaw: Buffer, qaadRaw: Buffer, identity: Identity): { data: Buffer; manifest: SurveillanceManifest } {
  const wahisBytes = normalized(wahisRaw);
  if (sha(wahisBytes) !== identity.wahis.sha256 || sha(qaadRaw) !== identity.qaad.sha256) throw new Error("Source checksum mismatch");
  const wahisInput: unknown = JSON.parse(wahisRaw.toString("utf8")); const qaadInput: unknown = JSON.parse(qaadRaw.toString("utf8"));
  const w = parseWahis(wahisInput); const q = parseQaad(qaadInput);
  if (!Array.isArray(qaadInput) || w.rejectedCount || q.rejectedCount || w.invalidCoordinates || w.invalidDates || q.invalidCoordinates || w.records.length !== identity.wahis.recordCount || q.records.length !== identity.qaad.recordCount) throw new Error("Invalid source rows or counts");
  const projected = (qaadInput as Array<Record<string, unknown>>).map((row) => Object.fromEntries(QAAD_DISPLAY_FIELDS.filter((key) => Object.hasOwn(row, key)).map((key) => [key, row[key]])));
  const data = Buffer.from(`${JSON.stringify(projected)}\n`);
  if (data.length > 2_097_152) throw new Error("QAAD display exceeds 2 MiB");
  const accessDates = [...new Set(w.records.map((r) => r.access_date).filter(validDate))];
  return { data, manifest: {
    schemaVersion: 1, fieldVersion: 1,
    sources: {
      wahis: { source: "WOAH WAHIS", sourceType: "snapshot", path: WAHIS_PATH.replace("public", ""), sourcePath: WAHIS_PATH, recordCount: w.records.length, sourceSha256: sha(wahisBytes), sourceHashMode: "lf-normalized-utf8", outputSha256: sha(wahisBytes), outputHashMode: "lf-normalized-utf8", outputBytes: wahisBytes.length, coverage: range(w.records.map((r) => r.event_start_date).filter(validDate)), retrievedAt: accessDates.length === 1 ? accessDates[0] : null, sourceUrls: ["https://wahis.woah.org/"] },
      qaad: { source: "NACA QAAD", sourceType: "snapshot", path: OUTPUT_PATH.replace("public", ""), sourcePath: QAAD_PATH, recordCount: q.records.length, sourceSha256: sha(qaadRaw), sourceHashMode: "raw-bytes", outputSha256: sha(data), outputHashMode: "raw-bytes", outputBytes: data.length, coverage: range(q.records.flatMap((r) => r.report_period ? [r.report_period] : [])), retrievedAt: null, sourceUrls: [...new Set(q.records.flatMap((r) => r.source_urls ?? []))] },
    },
  } };
}

async function safeFile(root: string, path: string) {
  const target = resolve(root, path); const rel = relative(root, target);
  if (!rel || rel.startsWith(`..${sep}`) || rel === "..") throw new Error("Publication path escapes root");
  let current = root;
  for (const part of rel.split(sep)) {
    current = join(current, part);
    try { if ((await lstat(current)).isSymbolicLink()) throw new Error("Publication path contains symlink"); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  }
  return target;
}
async function prepare(projectRoot: string) {
  const root = await realpath(projectRoot);
  // Resolve all inputs/outputs before reading or replacing anything.
  const paths = await Promise.all([WAHIS_PATH, QAAD_PATH, OUTPUT_PATH, MANIFEST_PATH, "data/runtime-baseline/manifest.json"].map((p) => safeFile(root, p)));
  const [wahis, qaad, baseline] = await Promise.all([readFile(paths[0]), readFile(paths[1]), readFile(paths[4], "utf8")]);
  const manifest = JSON.parse(baseline);
  const resource = manifest.resources?.find((r: { target?: string }) => r.target === QAAD_PATH);
  if (manifest.schemaVersion !== 1 || !/^[a-f0-9]{64}$/.test(resource?.rawSha256 ?? "")) throw new Error("Invalid source identity manifest");
  const result = buildPublication(wahis, qaad, { wahis: { sha256: "56160203b0f36afdda2e4ea998953d1a0aaa5c4c9c0868c8d8f1c658042cd23f", recordCount: 371 }, qaad: { sha256: resource.rawSha256, recordCount: 1789 } });
  return { root, paths, data: result.data, manifest: Buffer.from(`${JSON.stringify(result.manifest, null, 2)}\n`) };
}
async function atomicWrite(root: string, relativePath: string, data: Buffer) {
  const target = await safeFile(root, relativePath); const temporary = `${target}.${randomUUID()}.publish-tmp`;
  try {
    await writeFile(temporary, data, { flag: "wx" });
    await safeFile(root, relativePath);
    await rename(temporary, target);
  } finally { await unlink(temporary).catch((e: NodeJS.ErrnoException) => { if (e.code !== "ENOENT") throw e; }); }
}
export async function publishSurveillanceData(projectRoot: string): Promise<void> {
  const p = await prepare(projectRoot);
  await atomicWrite(p.root, OUTPUT_PATH, p.data);
  await atomicWrite(p.root, MANIFEST_PATH, p.manifest);
}
export async function verifySurveillanceData(projectRoot: string): Promise<void> {
  const p = await prepare(projectRoot);
  for (const [path, expected] of [[p.paths[2], p.data], [p.paths[3], p.manifest]] as const) {
    if (!(await readFile(path)).equals(expected)) throw new Error("Published snapshot differs from verified source projection");
  }
}
if (process.argv[1] && /(?:^|[/\\])publish-surveillance-data\.(?:ts|js)$/.test(process.argv[1])) {
  (process.argv.includes("--check") ? verifySurveillanceData(process.cwd()) : publishSurveillanceData(process.cwd()))
    .then(() => process.stdout.write("Public surveillance publication verified\n"))
    .catch((error: unknown) => { process.stderr.write(`${error instanceof Error ? error.message : "Publication failed"}\n`); process.exitCode = 1; });
}
