import { createHash, randomUUID } from "node:crypto";
import { link, lstat, mkdir, readFile, realpath, unlink, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { gunzipSync } from "node:zlib";

interface RuntimeResource {
  source: string;
  target: string;
  rawBytes: number;
  rawSha256: string;
  compressedSha256: string;
}

export interface RestoreResult {
  target: string;
  status: "restored" | "unchanged";
}

export interface VerifyResult {
  target: string;
  status: "verified";
}

const sha256 = (data: Buffer) => createHash("sha256").update(data).digest("hex");
const isMissing = (error: unknown) => (error as NodeJS.ErrnoException).code === "ENOENT";

async function safePath(root: string, value: string): Promise<string> {
  if (!value || isAbsolute(value) || value.includes("\\")) throw new Error("Invalid resource path");
  const path = resolve(root, value);
  const inside = relative(root, path);
  if (!inside || inside === ".." || inside.startsWith(`..${sep}`)) throw new Error("Resource path escapes project");
  let ancestor = root;
  for (const part of inside.split(sep)) {
    ancestor = resolve(ancestor, part);
    try {
      if ((await lstat(ancestor)).isSymbolicLink()) throw new Error("Resource path contains a symlink");
    } catch (error) { if (!isMissing(error)) throw error; }
  }
  return path;
}

async function resources(root: string): Promise<RuntimeResource[]> {
  const manifestPath = await safePath(root, "data/runtime-baseline/manifest.json");
  const manifest: unknown = JSON.parse(await readFile(manifestPath, "utf8"));
  if (!manifest || typeof manifest !== "object" || !("schemaVersion" in manifest) || manifest.schemaVersion !== 1 || !("resources" in manifest) || !Array.isArray(manifest.resources)) {
    throw new Error("Invalid runtime data manifest");
  }
  const targets = new Set<string>();
  return manifest.resources.map((item: unknown) => {
    if (!item || typeof item !== "object") throw new Error("Invalid runtime resource");
    const r = item as RuntimeResource;
    if (typeof r.source !== "string" || typeof r.target !== "string" || !Number.isSafeInteger(r.rawBytes) || r.rawBytes < 1 || r.rawBytes > 100 * 1024 * 1024 || !/^[a-f0-9]{64}$/.test(r.rawSha256) || !/^[a-f0-9]{64}$/.test(r.compressedSha256) || targets.has(r.target)) {
      throw new Error("Invalid runtime resource metadata");
    }
    targets.add(r.target);
    return r;
  });
}

async function matches(path: string, resource: RuntimeResource): Promise<boolean> {
  try {
    const data = await readFile(path);
    if (data.length !== resource.rawBytes || sha256(data) !== resource.rawSha256) throw new Error(`Resource conflict: ${resource.target}`);
    return true;
  } catch (error) {
    if (isMissing(error)) return false;
    throw error;
  }
}

export async function restoreRuntimeData(projectRoot: string): Promise<RestoreResult[]> {
  const root = await realpath(projectRoot);
  const results: RestoreResult[] = [];
  for (const resource of await resources(root)) {
    const target = await safePath(root, resource.target);
    if (await matches(target, resource)) {
      results.push({ target: resource.target, status: "unchanged" });
      continue;
    }
    const source = await safePath(root, resource.source);
    const packed = await readFile(source);
    if (sha256(packed) !== resource.compressedSha256) throw new Error(`Packed checksum mismatch: ${resource.source}`);
    const raw = gunzipSync(packed, { maxOutputLength: resource.rawBytes });
    if (raw.length !== resource.rawBytes || sha256(raw) !== resource.rawSha256) throw new Error(`Raw checksum mismatch: ${resource.target}`);
    await mkdir(dirname(target), { recursive: true });
    await safePath(root, resource.target);
    const temporary = `${target}.${randomUUID()}.restore-tmp`;
    try {
      await writeFile(temporary, raw, { flag: "wx" });
      // Atomic create without replacing a file created by someone else.
      try { await link(temporary, target); }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
        await matches(target, resource);
      }
    } finally { await unlink(temporary).catch((error: unknown) => { if (!isMissing(error)) throw error; }); }
    results.push({ target: resource.target, status: "restored" });
  }
  return results;
}

export async function verifyRuntimeData(projectRoot: string): Promise<VerifyResult[]> {
  const root = await realpath(projectRoot);
  const results: VerifyResult[] = [];
  for (const resource of await resources(root)) {
    const target = await safePath(root, resource.target);
    if (!await matches(target, resource)) throw new Error(`Resource missing: ${resource.target}; run npm run data:restore`);
    results.push({ target: resource.target, status: "verified" });
  }
  return results;
}

if (process.argv[1] && /(?:^|[/\\])restore-runtime-data\.(?:ts|js)$/.test(process.argv[1])) {
  const verify = process.argv.includes("--verify");
  (verify ? verifyRuntimeData(process.cwd()) : restoreRuntimeData(process.cwd()))
    .then((result) => { process.stdout.write(`${JSON.stringify(result)}\n`); })
    .catch((error: unknown) => { process.stderr.write(`${error instanceof Error ? error.message : "Runtime data failed"}\n`); process.exitCode = 1; });
}
