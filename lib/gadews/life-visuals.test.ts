import assert from "node:assert/strict";
import test from "node:test";
import { decodePhotoPointPack, sampleAnimalPoints, nextLifeStage, lifePointCount, lifeMotionAllowed, createLifeFrameLoop, parseLifeManifest } from "./life-visuals";
import { readFileSync } from "node:fs";

function pack() {
  const buffer = new ArrayBuffer(32);
  const bytes = new Uint8Array(buffer);
  bytes.set([71, 76, 70, 49]);
  const view = new DataView(buffer);
  view.setUint16(4, 1, true); view.setUint16(6, 8, true);
  view.setUint32(8, 1, true); view.setUint32(12, 2, true);
  view.setInt16(16, -8192, true); view.setInt16(18, 4096, true); view.setInt16(20, 0, true); view.setUint8(22, 204); view.setUint8(23, 255);
  view.setInt16(24, 8192, true); view.setInt16(26, -4096, true); view.setInt16(28, 0, true); view.setUint8(30, 102); view.setUint8(31, 0);
  return buffer;
}

test("packed photo coordinates retain original proportions, intensity and edge identity", () => {
  const result = decodePhotoPointPack(pack());
  assert.equal(result.pointsPerAnimal, 1);
  assert.deepEqual([...result.tilapia.slice(0, 3)], [-1, 0.5, 0]);
  assert.deepEqual([...result.shrimp.slice(0, 3)], [1, -0.5, 0]);
  assert.ok(Math.abs(result.tilapia[3] - 0.8) < 0.000001);
  assert.equal(result.tilapia[4], 1);
  assert.equal(result.shrimp[4], 0);
});

test("corrupt, oversized or anatomically distorted point packs are rejected before GPU use", () => {
  const variants = [
    (v: DataView) => v.setUint8(0, 0),
    (v: DataView) => v.setUint16(4, 2, true),
    (v: DataView) => v.setUint16(6, 4, true),
    (v: DataView) => v.setUint32(8, 50001, true),
    (v: DataView) => v.setUint32(12, 3, true),
    (v: DataView) => v.setInt16(16, 32767, true),
    (v: DataView) => v.setInt16(20, 20000, true),
    (v: DataView) => v.setUint8(23, 12),
  ];
  for (const mutate of variants) { const data = pack(); mutate(new DataView(data)); assert.throws(() => decodePhotoPointPack(data)); }
  assert.throws(() => decodePhotoPointPack(pack().slice(0, 29)));
  const extra = new ArrayBuffer(33); new Uint8Array(extra).set(new Uint8Array(pack()));
  assert.throws(() => decodePhotoPointPack(extra));
});

test("resampling changes display density without inventing silhouette coordinates", () => {
  const source = new Float32Array([-1, 0.5, 0, 0.8, 1, 1, -0.5, 0, 0.4, 0]);
  const before = [...source];
  const result = sampleAnimalPoints(source, 4);
  assert.deepEqual([...result], [...source.slice(0, 5), ...source.slice(0, 5), ...source.slice(5), ...source.slice(5)]);
  assert.deepEqual([...source], before);
  assert.throws(() => sampleAnimalPoints(new Float32Array([1, 2]), 4));
  assert.throws(() => sampleAnimalPoints(source, 0));
  assert.throws(() => sampleAnimalPoints(source, 100001));
});

test("life story starts with fish and shrimp before microscopic forms at bounded densities", () => {
  assert.deepEqual([0, nextLifeStage(0), nextLifeStage(1), nextLifeStage(2), nextLifeStage(3)], [0, 1, 2, 3, 0]);
  assert.throws(() => nextLifeStage(4));
  assert.equal(lifePointCount(390, false), 7000);
  assert.equal(lifePointCount(1440, false), 14000);
  assert.equal(lifePointCount(1440, true), 0);
});

test("hidden, offscreen, reduced and mobile covered life scenes do not run continuously", () => {
  const base = { reduced: false, visible: true, hidden: false, assistantOpen: false, mobile: false };
  assert.equal(lifeMotionAllowed(base), true);
  for (const item of [{ reduced: true }, { visible: false }, { hidden: true }, { assistantOpen: true, mobile: true }]) assert.equal(lifeMotionAllowed({ ...base, ...item }), false);
  assert.equal(lifeMotionAllowed({ ...base, assistantOpen: true }), true);
});

test("redraw during an automatic transition never duplicates the frame loop and dispose cancels work", () => {
  let nextId = 0, draws = 0;
  const callbacks = new Map<number, FrameRequestCallback>();
  const scheduler = {
    request: (callback: FrameRequestCallback) => { const id = ++nextId; callbacks.set(id, callback); return id; },
    cancel: (id: number) => { callbacks.delete(id); },
  };
  const loop = createLifeFrameLoop(scheduler, () => { draws++; loop.redraw(); });
  loop.setActive(true); loop.redraw(); loop.setActive(true);
  assert.equal(callbacks.size, 1);
  for (let i = 0; i < 20; i++) { const [id, callback] = [...callbacks][0]; callbacks.delete(id); callback(i * 16); assert.equal(callbacks.size, 1); }
  assert.equal(draws, 20);
  loop.setActive(false); assert.equal(callbacks.size, 0);
  loop.redraw(); assert.equal(callbacks.size, 1);
  loop.dispose(); assert.equal(callbacks.size, 0);
  loop.redraw(); loop.setActive(true); assert.equal(callbacks.size, 0);
});

test("photo provenance accepts published material but rejects executable or escaping reference paths", () => {
  const input = JSON.parse(readFileSync("public/media/gadews/life/manifest.json", "utf8"));
  const manifest = parseLifeManifest(input);
  assert.equal(manifest.sources[0].scientificName, "Oreochromis niloticus");
  assert.equal(manifest.sources[1].scientificName, "Penaeus vannamei");
  assert.equal(manifest.sources[0].license, "CC BY 4.0");
  assert.throws(() => parseLifeManifest({ ...input, sources: [{ ...input.sources[0], sourceUrl: "javascript:alert(1)" }, input.sources[1]] }));
  assert.throws(() => parseLifeManifest({ ...input, sources: [{ ...input.sources[0], photo: "../secrets" }, input.sources[1]] }));
  assert.throws(() => parseLifeManifest({ ...input, sources: [] }));
});
