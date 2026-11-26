import { createTilapiaDraftExamplePacket } from "../gadews/tilapia-assessment";
import { evaluateTilapiaDemo } from "../gadews/ai-assessment/tilapia-demo";
import { buildWsdScoringRubric, evaluateWsdBaseline } from "../gadews/ai-assessment/wsd-rubric";
import type { AiAssessmentRequest } from "../gadews/ai-assessment/types";
import type { WsdWarningModelConfig } from "../gadews/wsd-warning-model";
import wsd from "@/public/data/models/wsd-warning-model.json";
import type { Sample } from "./policy";

export function sampleRequest(record: Sample, locale: "en" | "zh-CN"): AiAssessmentRequest {
  const context = { dataMode: "example" as const, now: "2026-11-25T08:00:00Z" };
  if (record.model === "wsd-v1.0")
    return {
      locale,
      diseaseId: "wsd",
      standardId: record.model,
      context,
      input: {
        regionOrSite: record.region,
        farmOrPondId: record.id,
        waterTemperatureC: record.id === "E-01" ? 28 : 26,
      },
    };
  const { input } = createTilapiaDraftExamplePacket();
  return { locale, diseaseId: "tilapia-streptococcosis", standardId: record.model, context, input };
}
export function previewScore(request: AiAssessmentRequest) {
  const baseline =
    request.diseaseId === "wsd"
      ? evaluateWsdBaseline(
          request.input,
          request.context,
          buildWsdScoringRubric(wsd as WsdWarningModelConfig),
        )
      : evaluateTilapiaDemo(request.input, request.context);
  return {
    standard: request.standardId,
    inputVersion: "demo-1",
    subtotal: baseline.knownSubtotal,
    complete: baseline.completeScore,
    maximum: baseline.maxScore,
    evaluated: baseline.evaluatedCount,
    total: baseline.totalCount,
  };
}
