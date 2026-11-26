import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { assessWsd, type WsdWarningModelConfig } from "../wsd-warning-model";
import { WSD_WORKBENCH_EXAMPLE } from "@/components/gadews/warning-tools/warning-fields";
const config = JSON.parse(readFileSync("public/data/models/wsd-warning-model.json", "utf8")) as WsdWarningModelConfig;
async function feature() {
  const value = await import("./wsd-rubric").catch(() => null);
  assert.ok(value, "complete WSD scoring rubric and baseline adapter must exist");
  return value;
}
test("complete WSD catalogue retains every source branch and the 23 core inputs plus optional Ct", async () => {
  const { buildWsdScoringRubric } = await feature(); const rubric = buildWsdScoringRubric(config);
  const original = Object.values(config.modules).flatMap(m => m.rules).map(r => r.id).sort();
  const included = rubric.items.flatMap(item => item.sourceRules ?? []).map(r => r.id).sort();
  assert.equal(original.length, 77); assert.deepEqual(included, original);
  assert.equal(rubric.items.length, 24); assert.equal(rubric.items.filter(item => !item.optional).length, 23);
  assert.equal(rubric.modules.reduce((sum, m) => sum + m.maxScore, 0), 500);
  assert.ok(rubric.items.length > 6); assert.equal(rubric.items.find(item => item.field === "ph")!.branches.length, 3);
});
test("baseline preserves original assessed object and capped module subtotals exactly", async () => {
  const { buildWsdScoringRubric, evaluateWsdBaseline, aggregateScores } = await feature(); const rubric = buildWsdScoringRubric(config);
  const context = { now: "2026-10-30T12:00:00Z", dataMode: "example" as const };
  const input = { ...WSD_WORKBENCH_EXAMPLE, pcrQpcrResult: "positive", environmentalSampleResult: "positive", liveFeedResult: "positive", ctValue: 20 };
  const before = JSON.stringify(input), original = assessWsd(input, config, context);
  const baseline = evaluateWsdBaseline(input, context, rubric, config);
  assert.equal(baseline.knownSubtotal, original.knownScore);
  assert.equal(aggregateScores(baseline.items, rubric), original.knownScore);
  assert.equal(baseline.items.find(item => item.inputFields.includes("pcrQpcrResult"))!.score, 100);
  assert.equal(baseline.completeScore, null); assert.equal(baseline.level, null);
  assert.deepEqual(assessWsd(input, config, context), original); assert.equal(JSON.stringify(input), before);
});
test("source pH gaps and overlaps stay unresolved without reducing independent urgent evidence", async () => {
  const { buildWsdScoringRubric, evaluateWsdBaseline } = await feature(); const rubric = buildWsdScoringRubric(config);
  for (const ph of [8.4,8.5,7.75,7.95]) {
    const result = evaluateWsdBaseline({ ph, whiteSpots: true, pcrQpcrResult: "positive" }, {}, rubric, config);
    assert.equal(result.items.find(item => item.inputFields.includes("ph"))!.score, null);
    assert.equal(result.completeScore, null); assert.equal(result.minimumAttention, "urgent");
    assert.ok(result.quality.issues.some(issue => issue.field === "ph"));
  }
});
test("field metadata and optional inputs retain missing invalid stale and unsupported distinctions", async () => {
  const { buildWsdScoringRubric, evaluateWsdBaseline } = await feature(); const rubric = buildWsdScoringRubric(config);
  const empty = evaluateWsdBaseline({}, {}, rubric, config);
  assert.equal(empty.quality.state, "insufficient_data"); assert.equal(empty.knownSubtotal, 0);
  assert.equal(empty.items.find(item => item.inputFields.includes("ctValue"))!.status, "unsupported");
  const result = evaluateWsdBaseline({ ph: 8.2, redBody: true, softShell: false, rapidTestResult: "weak_positive" }, { now: "2026-10-30T12:00:00Z", observations: { ph: { observedAt: "2026-10-29T12:00:00Z", maxAgeHours: 1, scope: "pond" } } }, rubric, config);
  assert.equal(result.items.find(item => item.inputFields.includes("ph"))!.score, null);
  assert.equal(result.items.find(item => item.inputFields.includes("redBody"))!.score, 10);
  assert.equal(result.items.find(item => item.inputFields.includes("softShell"))!.score, 0);
  assert.equal(result.items.find(item => item.inputFields.includes("rapidTestResult"))!.score, null);
});
test("exact original source IDs win over earlier branches with the same number of points",async()=>{
 const {buildWsdScoringRubric,evaluateWsdBaseline}=await feature();const rubric=buildWsdScoringRubric(config);
 for(const [field,value,id,points]of [["species","克氏原螯虾","BASE-004",20],["farmingMode","稻虾连作","BASE-008",5]]as const){
  const b=evaluateWsdBaseline({[field]:value},{},rubric,config),row=b.items.find(item=>item.inputFields.includes(field))!;
  assert.equal(row.branchId,id);assert.equal(row.score,points);
 }
});
