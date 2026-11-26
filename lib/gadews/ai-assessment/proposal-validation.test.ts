import assert from "node:assert/strict";
import test from "node:test";
import { evaluateTilapiaDemo, tilapiaScoringRubric } from "./tilapia-demo";
import { completeTilapia, FIXTURE_NOW } from "./test-fixtures";
import type { ComparisonReport, ScoringProposal } from "./types";
const baseline = () => evaluateTilapiaDemo(completeTilapia(), { now: FIXTURE_NOW });
function answer(): ScoringProposal { return { items: baseline().items.map(({itemId,branchId,status,score}) => ({itemId,branchId,status,score,reason:"Current explicit input matches this branch."})), generalSupplement:"General explanation, outside scoring." }; }
async function feature() { const value = await import("./proposal-validation").catch(() => null); assert.ok(value, "proposal validation must exist"); return value; }
test("matching complete proposals have independently calculated zero and full grade", async () => {
  const { validateScoringProposal } = await feature(); const result = validateScoringProposal(JSON.stringify(answer()), tilapiaScoringRubric, baseline());
  assert.equal(result.validation.completeScore,0); assert.equal(result.validation.state,"consistent"); assert.equal(result.differences.length,0);
});
test("fake or duplicate IDs, invalid branch shape and arbitrary fields are not accepted as validated answers", async () => {
  const { validateScoringProposal: validate } = await feature();
  for (const mutate of [
    (a:ScoringProposal)=>{a.items[0].itemId="invented";},
    (a:ScoringProposal)=>{a.items[1]=a.items[0];},
    (a:ScoringProposal)=>{a.items[0].branchId="invented";},
    (a:ScoringProposal)=>{a.items[0].status="unknown";a.items[0].score=0;},
    (a:ScoringProposal)=>{a.items[0].reason="x".repeat(121);},
  ]) { const a=answer(); mutate(a); assert.throws(()=>validate(JSON.stringify(a),tilapiaScoringRubric,baseline())); }
  assert.throws(()=>validate(JSON.stringify({...answer(),model:"override"}),tilapiaScoringRubric,baseline()));
});
test("legitimate but wrong branch or points survive as a proposal and cannot become an approved complete score", async () => {
  const {validateScoringProposal:validate}=await feature();const a=answer();a.items[0].branchId="TDS-TEMP:above";a.items[0].score=10;
  const r=validate(JSON.stringify(a),tilapiaScoringRubric,baseline());assert.equal(r.proposal.items[0].score,10);assert.equal(r.validation.completeScore,null);assert.equal(r.validation.state,"needs_review");assert.ok(r.differences.some(d=>d.itemId==="TDS-TEMP"));
  a.items[0].score=999;const score=validate(JSON.stringify(a),tilapiaScoringRubric,baseline());assert.equal(score.validation.knownSubtotal,0);assert.equal(score.proposal.items[0].score,999);
});
test("missing rows are visible differences rather than generated replacement decisions", async () => {
  const {validateScoringProposal:validate}=await feature();const a=answer();a.items.pop();
  const r=validate(JSON.stringify(a),tilapiaScoringRubric,baseline());assert.equal(r.proposal.items.length,7);assert.equal(r.validation.completeScore,null);assert.ok(r.differences.some(d=>d.code==="missing_item"));
});
test("correct unknowns remain partial; model guesses cannot replace unavailable target evidence", async () => {
  const {validateScoringProposal:validate}=await feature();const input=completeTilapia();input.laboratory=[];
  const b=evaluateTilapiaDemo(input,{now:FIXTURE_NOW});const a={items:b.items.map(({itemId,branchId,status,score})=>({itemId,branchId,status,score,reason:"Missing target data."})),generalSupplement:""};
  const r=validate(JSON.stringify(a),tilapiaScoringRubric,b);assert.equal(r.validation.state,"partial");assert.equal(r.validation.completeScore,null);
});
test("WSD raw pathogen points are capped at the existing module maximum rather than rejected or summed past it", async () => {
  const {validateScoringProposal:validate}=await feature();const {buildWsdScoringRubric,evaluateWsdBaseline}=await import("./wsd-rubric");const {readFileSync}=await import("node:fs");
  const config=JSON.parse(readFileSync("public/data/models/wsd-warning-model.json","utf8"));const rubric=buildWsdScoringRubric(config),b=evaluateWsdBaseline({pcrQpcrResult:"positive",environmentalSampleResult:"positive"},{},rubric,config);
  const a={items:b.items.map(({itemId,branchId,status,score})=>({itemId,branchId,status,score,reason:"Per branch."})),generalSupplement:""};
  const r=validate(JSON.stringify(a),rubric,b);assert.equal(r.validation.knownSubtotal,90);assert.equal(r.validation.state,"partial");assert.equal(r.differences.length,0);
});
test("multi-target and multi-sample literal proposals preserve missing and conflict distinctions", async () => {
  const {validateScoringProposal:validate}=await feature();const {lab}=await import("./test-fixtures");
  for (const [kind,expectedScore,expectedState] of [["missing",null,"needs_review"],["independent",35,"consistent"],["conflicted-with-positive",35,"partial"]] as const) {
    const input=completeTilapia();
    if(kind==="missing") input.laboratory=input.laboratory.filter(row=>row.value!.pathogen==="SAG");
    else if(kind==="independent") input.laboratory=[...input.laboratory,lab("SAG","fish_tissue","positive","another-sample")];
    else input.laboratory=[...input.laboratory,lab("SAG","fish_tissue","positive"),lab("SAG","fish_tissue","positive","independent")];
    const b=evaluateTilapiaDemo(input,{now:FIXTURE_NOW}),a:ScoringProposal={items:b.items.map(({itemId,branchId,status,score})=>({itemId,branchId,status,score,reason:"Explicit proposal."})),generalSupplement:""};
    const row=a.items.find(item=>item.itemId==="TDS-FISH")!;
    if(kind==="missing"){row.status="matched";row.branchId="TDS-FISH:negative";row.score=0;}
    assert.equal(b.items[2].score,expectedScore);assert.equal(validate(JSON.stringify(a),tilapiaScoringRubric,b).validation.state,expectedState);
  }
});
test("comparison JSON has its own contract and cannot export stale results or extra configuration", async () => {
  const {serializeComparisonReport}=await import("./comparison-report").catch(()=>({serializeComparisonReport:null}));assert.ok(serializeComparisonReport,"comparison report exporter must exist");
  const {validateScoringProposal}=await feature();const r=validateScoringProposal(JSON.stringify(answer()),tilapiaScoringRubric,baseline());
  const report:ComparisonReport={reportType:"gadews-ai-assessment-comparison",schemaVersion:"1.0",diseaseId:"tilapia-streptococcosis",inputSnapshot:{},contextSnapshot:{},inputHash:"hash",assessedAt:FIXTURE_NOW,standard:tilapiaScoringRubric,model:{id:"fixture",protocol:"responses"},baseline:baseline(),...r,sources:tilapiaScoringRubric.sources};
  const value=JSON.parse(serializeComparisonReport({...report,apiKey:"must-not-export"} as ComparisonReport,false));assert.equal(value.reportType,"gadews-ai-assessment-comparison");assert.equal(value.apiKey,undefined);assert.throws(()=>serializeComparisonReport(report,true));
});
