import type { TilapiaAssessmentInput } from "./tilapia-types";

export interface TilapiaPredictionResult {
  state: "not_configured";
  probability: null;
  horizonHours: null;
  reason: string;
}

/** Offline adapter placeholder. No model endpoint or HTTP operation is installed. */
export function predictTilapia(_input: TilapiaAssessmentInput): TilapiaPredictionResult {
  void _input;
  return {
    state: "not_configured", probability: null, horizonHours: null,
    reason: "Prediction model not configured; no trained tilapia prediction model, probability or forecast horizon is available.",
  };
}
