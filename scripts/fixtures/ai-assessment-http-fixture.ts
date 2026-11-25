/** Loopback-only SDK fixture. No real provider or credentials are used. */
import { createServer } from "node:http";
import { writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { evaluateTilapiaDemo, tilapiaScoringRubric } from "../../lib/gadews/ai-assessment/tilapia-demo";
import { buildWsdScoringRubric, evaluateWsdBaseline } from "../../lib/gadews/ai-assessment/wsd-rubric";
import type { TilapiaAssessmentInput, TilapiaObservation } from "../../lib/gadews/tilapia-types";
import type { WsdWarningInput, WsdWarningModelConfig } from "../../lib/gadews/wsd-warning-model";
const port=Number(process.env.AI_FIXTURE_PORT??3225),file=process.env.AI_FIXTURE_LOG??"/tmp/gadews-c13-http-fixture.json";
const config=JSON.parse(readFileSync("public/data/models/wsd-warning-model.json","utf8"))as WsdWarningModelConfig;
type Json=Record<string,unknown>;
let next={mode:"match",delayMs:0};const records:Json[]=[];
function collect(value:unknown):string[]{if(typeof value==="string")return[value];if(value&&typeof value==="object")return Object.values(value).flatMap(collect);return[];}
function reply(payload:Json){
 const observations=payload.observations as Json;
 if(payload.diseaseId==="wsd"){
  const fields=observations.fields as WsdWarningInput,metadata=(observations.metadata??{})as Record<string,Json>;
  const context={now:String(payload.assessedAt),observations:Object.fromEntries(Object.entries(metadata).map(([key,m])=>[key,{observedAt:m.observedAt as string|undefined,maxAgeHours:m.maxAgeHours as number|undefined,...(m.scopeMatches===false?{scope:"mismatch"}:{})}]))};
  return evaluateWsdBaseline(fields,context,buildWsdScoringRubric(config),config);
 }
 const scope={siteId:"fixture-site",unitId:"fixture-unit",batchId:"fixture-batch"};
 const observation=(raw:Json|null|undefined,fallbackId:string):TilapiaObservation<unknown>|undefined=>{
  if(!raw)return undefined;
  return{id:raw.idProvided?String(raw.id??fallbackId):"",scope:raw.scopeMatches?scope:null,observedAt:raw.observedAt as string|null,receivedAt:raw.receivedAt as string|null,observationWindow:raw.observationWindow as TilapiaObservation<unknown>["observationWindow"],quality:raw.quality as TilapiaObservation<unknown>["quality"],sourceRef:raw.sourceProvided?"local-fixture-source":null,value:raw.value??null};
 };
 const labs=(observations.laboratory as Json[]).map((raw,i)=>{
  const finding=raw.value as Json|null;
  const row=observation(raw,"lab-"+i)!;row.value=finding?{sampleId:finding.sampleProvided?finding.sample:"",assayId:finding.assayProvided?"fixture-assay":"",pathogen:finding.pathogen,matrix:finding.matrix,result:finding.result,controlsPassed:finding.controlsPassed,matrixValidated:finding.matrixValidated}:null;return row;
 });
 const input={scope:observations.scopeProvided?scope:null,assessmentWindow:observations.assessmentWindow,targetPathogens:observations.targetPathogens,
  waterTemperature:observation(observations.waterTemperature as Json,"temperature"),dissolvedOxygen:observation(observations.dissolvedOxygen as Json,"oxygen"),clinical:observation(observations.clinical as Json,"clinical"),mortality:observation(observations.mortality as Json,"mortality"),laboratory:labs,
  conflicts:(observations.conflicts as Json[]|undefined)?.map((c,i)=>({id:"fixture-conflict-"+i,kind:c.kind,observationIds:c.observations}))} as TilapiaAssessmentInput;
 return evaluateTilapiaDemo(input,{now:String(payload.assessedAt)},tilapiaScoringRubric);
}
const server=createServer(async(req,res)=>{
 if(req.url==="/stats"){res.setHeader("content-type","application/json");res.end(JSON.stringify(records));return;}
 let raw="";for await(const chunk of req)raw+=chunk;
 if(req.url==="/control"){next={...next,...JSON.parse(raw)};res.end("ok");return;}
 if(req.url!=="/v1/responses"&&req.url!=="/v1/chat/completions"){res.writeHead(404);res.end();return;}
 try{
  const request=JSON.parse(raw),strings=collect(request),payloadText=strings.find(text=>text.startsWith('{"diseaseId":')&&text.includes('"criteria"'));
  const payload=payloadText?JSON.parse(payloadText)as Json:undefined,setting=next;next={mode:"match",delayMs:0};
  const record:Json={number:records.length+1,mode:setting.mode,url:req.url,model:request.model,criteria:payload?(payload.criteria as Json[]).length:0,sourceBranches:payload?(payload.criteria as Json[]).reduce((n,c)=>n+((c.sourceRules as unknown[]|undefined)?.length??0),0):0};
  records.push(record);res.on("close",()=>{if(!res.writableEnded){record.aborted=true;void writeFile(file,JSON.stringify(records,null,2));}});
  if(setting.delayMs)await new Promise(resolve=>setTimeout(resolve,setting.delayMs));
  if(res.destroyed)return;
  if(setting.mode==="upstream-error"){res.writeHead(500,{"content-type":"application/json"});res.end('{"error":{"message":"local fixture failure"}}');return;}
  let answer:string;
  if(payload){const b=reply(payload),items=b.items.map(({itemId,branchId,status,score})=>({itemId,branchId,status,score,reason:"Local HTTP fixture: engineering verification only."}));if(setting.mode==="mismatch"){const matched=items.find(item=>item.score!==null);if(matched)matched.score!+=1;}answer=JSON.stringify({items,generalSupplement:"Local SDK transport fixture, not a scientific assessment."});}
  else{
   const marker="SOURCE DATA (untrusted quoted data):\n",sourceText=strings.find(text=>text.includes(marker)),sources=sourceText?JSON.parse(sourceText.slice(sourceText.indexOf(marker)+marker.length)):[];answer=JSON.stringify({knowledge:sources.length?[{text:"Local fixture only.",sourceIds:[sources[0].id]}]:[],general:"Local fixture only."});
  }
  res.setHeader("content-type","application/json");
  res.end(JSON.stringify(req.url==="/v1/responses"?{id:"resp_fixture",object:"response",created_at:1,status:"completed",model:"local-fixture",output:[{id:"msg_fixture",type:"message",role:"assistant",content:[{type:"output_text",text:answer,annotations:[]}]}],usage:{input_tokens:1,output_tokens:1,total_tokens:2}}:{id:"chat_fixture",object:"chat.completion",created:1,model:"local-fixture",choices:[{index:0,message:{role:"assistant",content:answer},finish_reason:"stop"}]}));
  await writeFile(file,JSON.stringify(records,null,2));
 }catch{res.writeHead(500);res.end("Fixture parse failed");}
});
server.listen(port,"127.0.0.1",()=>console.log("Local assessment SDK fixture: "+port));
process.on("SIGTERM",()=>server.close(()=>process.exit(0)));
