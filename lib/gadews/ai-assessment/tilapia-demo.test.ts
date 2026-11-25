import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { completeTilapia, FIXTURE_NOW, lab } from "./test-fixtures";

async function feature() {
  const value = await import("./tilapia-demo").catch(() => null);
  assert.ok(value, "versioned tilapia scoring and independent calculation must exist");
  return value;
}
test("versioned project standard has eight items, source metadata and exact module totals", async () => {
  const { tilapiaScoringRubric: rubric } = await feature();
  assert.equal(rubric.id, "tilapia-demo-score-v0.1");
  assert.deepEqual(rubric.modules.map(m => m.maxScore), [25, 40, 20, 15]);
  assert.equal(rubric.items.length, 8);
  assert.equal(rubric.items.reduce((n, item) => n + item.maxScore, 0), 100);
  assert.equal(rubric.scientificallyValidated, false);
  assert.ok(rubric.hash.length >= 64);
});
test("literal complete negative evidence scores zero; all eight selected positive branches total 100", async () => {
  const { evaluateTilapiaDemo: evaluate } = await feature(); const input = completeTilapia();
  assert.equal(evaluate(input, { now: FIXTURE_NOW }).completeScore, 0);
  input.waterTemperature!.value = 30; input.dissolvedOxygen!.value = 2;
  input.clinical!.value = { signsPresent: "yes", persistentAbnormality: "yes", respiratoryDistressObserved: "yes" };
  input.mortality!.value!.abnormalityReported = "yes"; input.mortality!.value!.abnormalityPersistent = "yes";
  input.laboratory = [lab("SAG", "fish_tissue", "positive"), lab("SIN", "environment", "positive")];
  const result = evaluate(input, { now: FIXTURE_NOW });
  assert.equal(result.completeScore, 100); assert.equal(result.minimumAttention, "urgent");
  assert.deepEqual(result.items.map(item => item.score), [10, 15, 35, 5, 10, 10, 10, 5]);
});
test("temperature and oxygen boundaries are literal, exclusive and finite", async () => {
  const { evaluateTilapiaDemo: evaluate } = await feature();
  for (const [temperature, oxygen, expected] of [[29.99, 5, 0], [30, 5, 10], [28, 3, 8], [28, 2.99, 15]] as const) {
    const input = completeTilapia(); input.waterTemperature!.value = temperature; input.dissolvedOxygen!.value = oxygen;
    assert.equal(evaluate(input, { now: FIXTURE_NOW }).completeScore, expected);
  }
  for (const oxygen of [-1, NaN, Infinity]) {
    const input = completeTilapia(); input.dissolvedOxygen!.value = oxygen;
    assert.equal(evaluate(input, { now: FIXTURE_NOW }).items[1].score, null);
  }
});
test("all score bands have exact disjoint endpoints", async () => {
  const { classifyTilapiaScore } = await feature();
  for (const [score, rank] of [[0,0],[24,0],[25,1],[49,1],[50,2],[74,2],[75,3],[100,3]]) assert.equal(classifyTilapiaScore(score).rank, rank);
  for (const score of [-1, 101, NaN]) assert.throws(() => classifyTilapiaScore(score));
});
test("empty and partial fields remain unknown rather than low risk or rescaled totals", async () => {
  const { evaluateTilapiaDemo: evaluate } = await feature();
  const empty = evaluate({ scope: null, assessmentWindow: null, targetPathogens: [], laboratory: [] }, { now: FIXTURE_NOW });
  assert.equal(empty.quality.state, "insufficient_data"); assert.equal(empty.completeScore, null); assert.equal(empty.level, null); assert.equal(empty.evaluatedCount, 0);
  const input = completeTilapia(); delete input.clinical;
  input.waterTemperature!.value = 30;
  const partial = evaluate(input, { now: FIXTURE_NOW });
  assert.equal(partial.knownSubtotal, 10); assert.equal(partial.completeScore, null); assert.equal(partial.evaluatedCount, 6);
});
test("scope, source, QC, matrix validation and assessment time cannot be invented", async () => {
  const { evaluateTilapiaDemo: evaluate } = await feature();
  for (const mutate of [
    (input: ReturnType<typeof completeTilapia>) => { input.waterTemperature!.scope!.batchId = "another"; },
    (input: ReturnType<typeof completeTilapia>) => { input.waterTemperature!.sourceRef = null; },
    (input: ReturnType<typeof completeTilapia>) => { input.waterTemperature!.quality = "stale"; },
    (input: ReturnType<typeof completeTilapia>) => { input.waterTemperature!.observedAt = "2026-10-29T12:00:00Z"; },
    (input: ReturnType<typeof completeTilapia>) => { input.waterTemperature!.receivedAt = "2026-10-31T12:00:00Z"; },
  ]) { const input = completeTilapia(); mutate(input); assert.equal(evaluate(input, { now: FIXTURE_NOW }).items[0].score, null); }
  for (const key of ["controlsPassed", "matrixValidated"] as const) {
    const input = completeTilapia(); input.laboratory[0].value![key] = "no";
    assert.equal(evaluate(input, { now: FIXTURE_NOW }).items[2].score, null);
  }
});
test("an untested selected target is unknown; independent target positive is scored only once", async () => {
  const { evaluateTilapiaDemo: evaluate } = await feature(); const input = completeTilapia();
  input.laboratory = [lab("SAG", "fish_tissue", "negative"), lab("SAG", "environment", "negative")];
  assert.equal(evaluate(input, { now: FIXTURE_NOW }).items[2].score, null);
  input.laboratory = [...input.laboratory, lab("SAG", "fish_tissue", "positive", "other-sample"), lab("SIN", "fish_tissue", "negative"), lab("SAG", "fish_tissue", "positive", "third")];
  assert.equal(evaluate(input, { now: FIXTURE_NOW }).items[2].score, 35);
});
test("only same-sample target matrix overlapping windows conflict; later negatives do not erase positives", async () => {
  const { evaluateTilapiaDemo: evaluate } = await feature(); const input = completeTilapia();
  input.laboratory = [...input.laboratory, lab("SAG", "fish_tissue", "positive")];
  assert.equal(evaluate(input, { now: FIXTURE_NOW }).items[2].score, null);
  input.laboratory = [...input.laboratory, lab("SAG", "fish_tissue", "positive", "independent")];
  const independent = evaluate(input, { now: FIXTURE_NOW });
  assert.equal(independent.items[2].score, 35); assert.equal(independent.completeScore, null);
  const later = completeTilapia(); const positive = lab("SAG", "fish_tissue", "positive");
  positive.observedAt = "2026-10-30T01:00:00Z"; later.laboratory = [...later.laboratory, positive];
  assert.equal(evaluate(later, { now: FIXTURE_NOW }).items[2].score, 35);
});
test("invalid denominator never creates mortality percentage and input/source originals remain unchanged", async () => {
  const { evaluateTilapiaDemo: evaluate } = await feature(); const input = completeTilapia();
  input.mortality!.value!.stockStartCount = null;
  const before = JSON.stringify(input); const path = "public/data/knowledge/tilapia-streptococcosis.json"; const source = readFileSync(path);
  const result = evaluate(input, { now: FIXTURE_NOW, dataMode: "manual" });
  assert.equal(result.metrics?.mortalityRate, null); assert.equal(result.dataMode, "manual");
  assert.equal(result.completeScore, null); assert.equal(JSON.stringify(input), before); assert.deepEqual(readFileSync(path), source);
});
