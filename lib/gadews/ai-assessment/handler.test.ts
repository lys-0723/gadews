import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "node:http";
import { completeTilapia, FIXTURE_NOW } from "./test-fixtures";
import type { ScoringPrompt } from "./provider";
const env={GADEWS_AI_API_KEY:"fixture-private-key"};
const body=()=>({diseaseId:"tilapia-streptococcosis",locale:"en",standardId:"tilapia-demo-score-v0.1",input:completeTilapia(),context:{dataMode:"manual",now:"1999-01-01T00:00:00Z"}});
function req(value:unknown=body(),signal?:AbortSignal,origin="http://localhost"){return new Request("http://localhost/api/assessment/ai",{method:"POST",headers:{origin,"content-type":"application/json"},body:JSON.stringify(value),signal});}
function valid(prompt:ScoringPrompt){const p=JSON.parse(prompt.prompt);return JSON.stringify({items:p.criteria.map((c:{id:string;branches:{id:string;score:number}[]})=>({itemId:c.id,branchId:c.branches[0].id,status:"matched",score:c.branches[0].score,reason:"Explicit fixture input."})),generalSupplement:"Local SDK fixture only."});}
async function feature(){const value=await import("./handler").catch(()=>null);assert.ok(value,"bounded AI assessment handler must exist");return value;}
test("no key and strict request guards prevent all upstream calls",async()=>{
 const {createAiAssessmentHandler}=await feature();let calls=0;
 const h=createAiAssessmentHandler({env:{},generate:async(_c,p)=>{calls++;return valid(p);}});
 assert.equal((await h(req())).status,503);
 for(const v of [null,{...body(),apiKey:"inject"},{...body(),standardId:"fake"},{...body(),input:{...completeTilapia(),professionalRecords:[]}},{...body(),context:{professionalRecords:[]}},{...body(),input:{...completeTilapia(),laboratory:Array.from({length:17},()=>completeTilapia().laboratory[0])}}])assert.equal((await h(req(v))).status,400);
 assert.equal((await h(req(body(),undefined,"https://evil.test"))).status,403);assert.equal(calls,0);
});
test("server clock and standard are authoritative and prompt excludes private identities",async()=>{
 const {createAiAssessmentHandler}=await feature();let inspected=false;
 const h=createAiAssessmentHandler({env,now:()=>new Date(FIXTURE_NOW),generate:async(c,p)=>{
  assert.equal(c.model,"deepseek-v4.1-flash-1017");assert.doesNotMatch(JSON.stringify(p),/private-site|private-pond|private-batch|private-source|fixture-private-key/);
  const data=JSON.parse(p.prompt);assert.equal(data.criteria.length,8);assert.equal(data.observations.laboratory.length,4);inspected=true;return valid(p);
 }});
 const response=await h(req());assert.equal(response.status,200);assert.equal(response.headers.get("cache-control"),"no-store");
 const r=await response.json();assert.equal(r.assessedAt,FIXTURE_NOW.replace("Z",".000Z"));assert.equal(r.baseline.completeScore,0);assert.equal(r.validation.completeScore,0);assert.equal(r.standard.scientificallyValidated,false);assert.ok(r.inputHash.length===64);assert.equal(inspected,true);
});
test("actual body and total text limits reject before generation; raw failures stay sanitized",async()=>{
 const {createAiAssessmentHandler}=await feature();let calls=0;const h=createAiAssessmentHandler({env,generate:async()=>{calls++;throw new Error("fixture-private-key raw upstream");}});
 const large=new ReadableStream({start(c){c.enqueue(new Uint8Array(65537));c.close();}});
 assert.equal((await h(new Request("http://localhost",{method:"POST",headers:{origin:"http://localhost","content-length":"1"},body:large,duplex:"half"} as RequestInit))).status,413);
 assert.equal((await h(req({...body(),context:{inputProvenance:{note:"x".repeat(32769)}}}))).status,400);
 const response=await h(req());assert.equal(response.status,502);assert.doesNotMatch(await response.text(),/fixture-private-key|raw upstream/);assert.equal(calls,1);
});
test("WSD endpoint passes every applicable criterion without private observation metadata",async()=>{
 const {createAiAssessmentHandler}=await feature();const {buildWsdScoringRubric,evaluateWsdBaseline}=await import("./wsd-rubric");const {readFileSync}=await import("node:fs");
 const config=JSON.parse(readFileSync("public/data/models/wsd-warning-model.json","utf8")),rubric=buildWsdScoringRubric(config);let sourceCount=0;
 const h=createAiAssessmentHandler({env,now:()=>new Date(FIXTURE_NOW),generate:async(_c,p)=>{
  const data=JSON.parse(p.prompt);sourceCount=data.criteria.flatMap((item:{sourceRules:unknown[]})=>item.sourceRules).length;
  assert.equal(data.criteria.length,24);assert.doesNotMatch(JSON.stringify(p),/private-site/);
  const b=evaluateWsdBaseline({ph:8.2,redBody:true},{now:FIXTURE_NOW,observations:{ph:{scope:"private-site"}}},rubric,config);
  return JSON.stringify({items:b.items.map(({itemId,branchId,status,score})=>({itemId,branchId,status,score,reason:"Explicit local fixture."})),generalSupplement:""});
 }});
 const response=await h(req({diseaseId:"wsd",locale:"en",standardId:"wsd-v1.0",input:{ph:8.2,redBody:true,regionOrSite:"private-site"},context:{dataMode:"manual",observations:{ph:{scope:"private-site"},"private-site":{scope:"private-site"}}}}));
 assert.equal(response.status,200);assert.equal(sourceCount,77);const r=await response.json();assert.equal(r.validation.state,"partial");assert.equal(r.baseline.knownSubtotal,10);
});
test("invalid model citations or scores never silently replace the rule result",async()=>{
 const {createAiAssessmentHandler}=await feature();const h=createAiAssessmentHandler({env,now:()=>new Date(FIXTURE_NOW),generate:async(_c,p)=>{const a=JSON.parse(valid(p));a.items[0].itemId="fake";return JSON.stringify(a);}});
 assert.equal((await h(req())).status,502);
 const differing=createAiAssessmentHandler({env,now:()=>new Date(FIXTURE_NOW),generate:async(_c,p)=>{const a=JSON.parse(valid(p));a.items[0].score=999;return JSON.stringify(a);}});
 const response=await differing(req());assert.equal(response.status,200);const r=await response.json();assert.equal(r.validation.state,"needs_review");assert.equal(r.validation.completeScore,null);assert.equal(r.proposal.items[0].score,999);assert.equal(r.baseline.completeScore,0);
});
test("chat and assessment factories share production-style slots; cancellation releases them",async()=>{
 const {createAiAssessmentHandler}=await feature();const {createAssistantHandler}=await import("../assistant/handler");const {createModelBudget}=await import("../assistant/runtime");const budget=createModelBudget();let running=0;
 const generation=async()=>{running++;return await new Promise<string>(()=>{});};
 const chat=createAssistantHandler({env,budget,getCorpus:()=>[],generate:generation,timeoutMs:50});
 const ai=createAiAssessmentHandler({env,budget,generate:generation,timeoutMs:50});const controller=new AbortController();
 const a=chat(req({locale:"en",messages:[{role:"user",content:"Question"}]}));const b=ai(req(body(),controller.signal));
 while(running<2)await new Promise(resolve=>setTimeout(resolve,1));
 assert.equal((await ai(req())).status,429);controller.abort();assert.equal((await b).status,499);assert.equal((await a).status,504);
});
test("real scoring SDK uses explicit protocols, complete criteria, output budget and no retries",async()=>{
 const provider=await import("./provider").catch(()=>null);assert.ok(provider,"scoring SDK provider must exist");const requests:Record<string,unknown>[]=[];
 const server=createServer(async(incoming,outgoing)=>{let raw="";for await(const c of incoming)raw+=c;requests.push(JSON.parse(raw));outgoing.setHeader("content-type","application/json");const text='{"items":[],"generalSupplement":"Local fixture"}';outgoing.end(JSON.stringify(incoming.url==="/v1/responses"?{id:"resp",object:"response",created_at:1,status:"completed",model:"fixture",output:[{id:"msg",type:"message",role:"assistant",content:[{type:"output_text",text,annotations:[]}]}],usage:{input_tokens:1,output_tokens:1,total_tokens:2}}:{id:"chat",object:"chat.completion",created:1,model:"fixture",choices:[{index:0,message:{role:"assistant",content:text},finish_reason:"stop"}]}));});
 await new Promise<void>(resolve=>server.listen(0,"127.0.0.1",resolve));const address=server.address();assert.ok(address&&typeof address!=="string");
 try{for(const protocol of ["responses","chat-completions"]as const){const result=await provider.generateScoringText({apiKey:"local-only",baseURL:"http://127.0.0.1:"+address.port+"/v1",model:"fixture",protocol},{system:"Rubric constraints",prompt:"All applicable criteria"},new AbortController().signal);assert.ok(result.includes("generalSupplement"));}
 assert.equal(requests.length,2);for(const r of requests){assert.ok(r.max_output_tokens===6000||r.max_completion_tokens===6000||r.max_tokens===6000);assert.equal(r.reasoning_effort,undefined);}}
 finally{await new Promise<void>(resolve=>server.close(()=>resolve()));}
});
test("assessment deadline is enforced even if a generator ignores abort",async()=>{
 const {createAiAssessmentHandler}=await feature();
 const h=createAiAssessmentHandler({env,timeoutMs:10,generate:async()=>new Promise<string>(()=>{})});
 const response=await h(req());assert.equal(response.status,504);assert.equal((await response.json()).error.code,"timeout");
});
test("invalid example clocks are rejected before model use",async()=>{
 const {createAiAssessmentHandler}=await feature();let calls=0;
 const h=createAiAssessmentHandler({env,generate:async(_c,p)=>{calls++;return valid(p);}});
 for(const now of ["not-a-date","2026-02-30T12:00:00Z","2026-10-30T25:00:00Z"])assert.equal((await h(req({...body(),context:{dataMode:"example",now}}))).status,400);
 assert.equal(calls,0);
});
test("scoring SDK does not retry failures or switch protocol",async()=>{
 const {generateScoringText}=await import("./provider");let calls=0;
 const server=createServer((_req,res)=>{calls++;res.writeHead(500,{"content-type":"application/json"});res.end('{"error":{"message":"local fixture"}}');});
 await new Promise<void>(resolve=>server.listen(0,"127.0.0.1",resolve));const address=server.address();assert.ok(address&&typeof address!=="string");
 try{await assert.rejects(generateScoringText({apiKey:"local-only",baseURL:"http://127.0.0.1:"+address.port+"/v1",model:"fixture",protocol:"responses"},{system:"Rubric",prompt:"Criteria"},new AbortController().signal));assert.equal(calls,1);}
 finally{await new Promise<void>(resolve=>server.close(()=>resolve()));}
});
test("anonymous conflicts preserve which non-laboratory observation is affected without leaking its original identity",async()=>{
 const {buildScoringPrompt}=await feature();const {evaluateTilapiaDemo,tilapiaScoringRubric}=await import("./tilapia-demo");
 const a=completeTilapia();a.waterTemperature!.id="secret-temperature-record";a.dissolvedOxygen!.id="secret-oxygen-record";
 const b=structuredClone(a);a.conflicts=[{id:"private-conflict",kind:"other",observationIds:[a.waterTemperature!.id]}];b.conflicts=[{id:"private-conflict",kind:"other",observationIds:[b.dissolvedOxygen!.id]}];
 const make=(input:typeof a)=>buildScoringPrompt({...body(),diseaseId:"tilapia-streptococcosis",locale:"en",standardId:"tilapia-demo-score-v0.1",input,context:{now:FIXTURE_NOW}},tilapiaScoringRubric,evaluateTilapiaDemo(input,{now:FIXTURE_NOW}));
 const first=make(a),second=make(b);assert.notEqual(first.prompt,second.prompt);assert.doesNotMatch(first.prompt,/secret-temperature-record|secret-oxygen-record|private-conflict/);
 assert.deepEqual(JSON.parse(first.prompt).observations.conflicts[0].observations,["temperature"]);
 assert.deepEqual(JSON.parse(second.prompt).observations.conflicts[0].observations,["oxygen"]);
});
