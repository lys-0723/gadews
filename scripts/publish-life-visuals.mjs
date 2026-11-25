import { readFile, writeFile, mkdir } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { resolve } from "node:path";

const hash = (raw) => createHash("sha256").update(raw).digest("hex");
const escape = (value) => String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]);

export function encodeLifePointData(data) {
  const count = data.tilapia.count;
  if (!Number.isInteger(count) || count < 1 || count > 50000 || data.shrimp.count !== count) throw new Error("Invalid animal point count");
  const buffer = new ArrayBuffer(16 + count * 16);
  const bytes = new Uint8Array(buffer), view = new DataView(buffer);
  bytes.set([71, 76, 70, 49]); view.setUint16(4, 1, true); view.setUint16(6, 8, true); view.setUint32(8, count, true); view.setUint32(12, 2, true);
  for (const [animal, index] of [["tilapia", 0], ["shrimp", 1]]) {
    const item = data[animal];
    if (item.stride !== 5 || !Array.isArray(item.points) || item.points.length !== count * 5) throw new Error("Invalid animal point stride");
    for (let i = 0; i < count; i++) {
      const [x, y, z, intensity, edge] = item.points.slice(i * 5, i * 5 + 5);
      if (![x, y, z, intensity, edge].every(Number.isFinite) || Math.abs(x) > 2.05 || Math.abs(y) > 3 || Math.abs(z) > .1 || intensity < 0 || intensity > 1 || (edge !== 0 && edge !== 1)) throw new Error("Invalid sampled photo coordinate");
      const at = 16 + index * count * 8 + i * 8;
      view.setInt16(at, Math.round(x * 8192), true); view.setInt16(at + 2, Math.round(y * 8192), true); view.setInt16(at + 4, Math.round(z * 32767), true);
      view.setUint8(at + 6, Math.round(intensity * 255)); view.setUint8(at + 7, edge ? 255 : 0);
    }
  }
  return Buffer.from(buffer);
}

function staticPhoto(item) {
  const points = item.points, circles = [];
  let minY = 0, maxY = 0;
  for (let i = 1; i < points.length; i += 5) { minY = Math.min(minY, points[i]); maxY = Math.max(maxY, points[i]); }
  for (let i = 0; i < item.count; i += Math.max(1, Math.floor(item.count / 6000))) {
    const at = i * 5;
    circles.push('<circle cx="' + points[at].toFixed(4) + '" cy="' + (-points[at + 1]).toFixed(4) + '" r="' + (points[at + 4] ? ".006" : ".0045") + '" opacity="' + (.4 + points[at + 3] * .6).toFixed(3) + '"/>');
  }
  return Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="-2.15 ' + (-maxY - .12).toFixed(4) + ' 4.3 ' + (maxY - minY + .24).toFixed(4) + '" role="img"><title>' + escape(item.nameZh) + '：照片轮廓粒子</title><metadata>' + escape(item.credit + "; " + item.license + "; " + item.sourceUrl + "; Derived outline and texture points; not anatomical 3D reconstruction.") + '</metadata><g fill="#9ce9d7">' + circles.join("") + '</g></svg>\n');
}

function staticMicroscope(kind) {
  const cell = '<circle cx="200" cy="160" r="115" fill="none" stroke="#66c7c4" stroke-width="2"/><ellipse cx="190" cy="158" rx="42" ry="45" fill="#b6efdf" fill-opacity=".15" stroke="#9ce9d7"/><circle cx="182" cy="160" r="15" fill="#9ce9d7" fill-opacity=".45"/>' + Array.from({ length: 8 }, (_, i) => '<ellipse cx="' + (200 + Math.cos(i * Math.PI / 4) * 80).toFixed(2) + '" cy="' + (160 + Math.sin(i * Math.PI / 4) * 80).toFixed(2) + '" rx="14" ry="8" fill="none" stroke="#9ce9d7" opacity=".7"/>').join("");
  const pathogen = Array.from({ length: 7 }, (_, i) => '<circle cx="' + (55 + i * 27) + '" cy="' + (110 + Math.sin(i * .7) * 20).toFixed(2) + '" r="14" fill="#69bbd8" fill-opacity=".12" stroke="#9ce9d7"/>').join("") + '<rect x="200" y="190" width="135" height="42" rx="21" fill="#69bbd8" fill-opacity=".12" stroke="#9ce9d7"/><rect x="214" y="202" width="105" height="18" rx="9" fill="none" stroke="#65b9cc"/><path d="M335 210q35 5 34 30" fill="none" stroke="#9ce9d7"/>';
  return Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 320" role="img"><title>' + (kind === "cell" ? "细胞结构示意" : "链状球菌与杆状病毒形态示意") + '</title><metadata>Original GADEWS schematic; not a micrograph, diagnostic result or measured anatomical reconstruction.</metadata>' + (kind === "cell" ? cell : pathogen) + '</svg>\n');
}

export async function buildLifeArtifacts(repo = process.cwd()) {
  const sourceRoot = resolve(repo, "data/visuals/life");
  const rawSamples = await readFile(resolve(sourceRoot, "photo-samples.json.gz"));
  const data = JSON.parse(gunzipSync(rawSamples).toString("utf8"));
  const assets = new Map();
  assets.set("photo-points.bin", encodeLifePointData(data));
  const sources = [];
  for (const animal of ["tilapia", "shrimp"]) {
    const item = data[animal];
    const original = await readFile(resolve(sourceRoot, "originals", animal + ".jpg"));
    if (hash(original) !== item.sourceSha256) throw new Error(animal + " original photograph identity changed");
    const reference = await readFile(resolve(sourceRoot, "references", animal + ".jpg"));
    assets.set(animal + "-original.jpg", original); assets.set(animal + "-reference.jpg", reference);
    assets.set(animal + "-static.svg", staticPhoto(item));
    const metadata = Object.fromEntries(Object.entries(item).filter(([key]) => key !== "points"));
    sources.push({ ...metadata, id: animal, photo: animal + "-reference.jpg", originalPhoto: animal + "-original.jpg", fallback: animal + "-static.svg" });
  }
  assets.set("cell-static.svg", staticMicroscope("cell")); assets.set("pathogen-static.svg", staticMicroscope("pathogen"));
  const metadata = {
    version: 1, pointFile: "photo-points.bin", pointFormat: "GLF1 / int16-xy8192-z32767 / uint8-intensity-edge / little-endian", sources,
    stages: ["tilapia", "shrimp", "cell", "pathogen"],
    microscopic: { purpose: "Procedural schematic, not a micrograph or diagnosis", references: ["https://ictv.global/report/chapter/nimaviridae/nimaviridae", "https://pmc.ncbi.nlm.nih.gov/articles/PMC1828557/"] },
    inputSha256: hash(rawSamples), files: [...assets].map(([path, bytes]) => ({ path, bytes: bytes.length, sha256: hash(bytes) })),
  };
  assets.set("manifest.json", Buffer.from(JSON.stringify(metadata, null, 2) + "\n"));
  return assets;
}

export async function verifyLifeVisuals(repo = process.cwd()) {
  const assets = await buildLifeArtifacts(repo);
  for (const [name, bytes] of assets) {
    const actual = await readFile(resolve(repo, "public/media/gadews/life", name));
    if (!bytes.equals(actual)) throw new Error("Published life visual differs from controlled input: " + name);
  }
  const packed = assets.get("photo-points.bin");
  if (packed.length > 600000) throw new Error("Life point transfer budget exceeded");
  console.log("Verified " + assets.size + " deterministic life visual artifacts and photo identities.");
}

async function main() {
  if (process.argv.includes("--check")) await verifyLifeVisuals();
  else if (process.argv.includes("--write")) {
    const assets = await buildLifeArtifacts();
    await mkdir("public/media/gadews/life", { recursive: true });
    for (const [name, bytes] of assets) await writeFile(resolve("public/media/gadews/life", name), bytes);
    console.log("Published " + assets.size + " life visual artifacts from controlled input.");
  } else throw new Error("Choose --check or --write explicitly");
}
if (process.argv[1]?.replaceAll("\\", "/").endsWith("/publish-life-visuals.mjs")) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
