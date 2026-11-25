import { z } from "zod";
import type { ComparisonReport } from "./types";
const text=z.string().max(2000),score=z.number().finite().min(0).max(10000).nullable();
const level=z.object({id:text,label:text,rank:z.number().int().min(0).max(3).optional()}).nullable();
const status=z.enum(["matched","unknown","conflict","unsupported"]);
const item=z.object({itemId:text,module:text,label:text,status,branchId:text.nullable(),score,reason:text,inputFields:z.array(text),sourceRefs:z.array(text)});
const baseline=z.object({items:z.array(item).max(32),knownSubtotal:z.number().finite(),completeScore:score,maxScore:z.number().finite().positive(),level,dataMode:z.enum(["manual","example","draft-preview"]),quality:z.object({state:z.enum(["complete","partial","insufficient_data"]),issues:z.array(z.object({field:text,code:text,message:text}).passthrough()).max(500)}),minimumAttention:z.enum(["none","review","high","urgent"]),evaluatedCount:z.number().int(),totalCount:z.number().int()}).passthrough();
const reportSchema=z.object({
 reportType:z.literal("gadews-ai-assessment-comparison"),schemaVersion:z.literal("1.0"),diseaseId:z.enum(["wsd","tilapia-streptococcosis"]),
 inputSnapshot:z.record(z.unknown()),contextSnapshot:z.record(z.unknown()),inputHash:text,assessedAt:text,
 standard:z.object({id:text,version:text,title:text,titleEn:text,status:text,scientificallyValidated:z.literal(false),hash:text}).passthrough(),
 model:z.object({id:text,protocol:text}),baseline,
 proposal:z.object({items:z.array(z.object({itemId:text,branchId:text.nullable(),status,score,reason:text})).max(32),generalSupplement:text}),
 validation:z.object({state:z.enum(["consistent","partial","needs_review"]),knownSubtotal:z.number().finite(),completeScore:score,level}),
 differences:z.array(z.object({itemId:text,code:text,message:text})).max(100),sources:z.array(z.object({id:text,title:text,href:text})).max(100),
}).strict();
export function parseComparisonReport(value: unknown): ComparisonReport { return reportSchema.parse(value) as ComparisonReport; }
/** Preserve lexical invalid numbers so the server rejects them instead of receiving a false blank. */
export function comparisonRequestJson(value: unknown): string {
 return JSON.stringify(value,(_key,item:unknown)=>typeof item==="number"&&!Number.isFinite(item)?{$number:String(item)}:item);
}
export function comparisonSourceHref(value:string):string|undefined {
 if (/^\/data\/[a-zA-Z0-9/%_.#-]+$/.test(value) && !value.includes("/../")) return value;
 try{const url=new URL(value);if(["http:","https:"].includes(url.protocol)&&!url.username&&!url.password)return url.href;}catch{/* Non-source links are rendered as text. */}
}
