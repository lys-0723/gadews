import type { AlertLevel, RiskAssessment } from "./types";
import { getRecommendations } from "./recommendations";

export interface WssvRiskInput {
  temperatureDelta24h: number;
  salinityDrop24h: number;
  doMin: number;
  ammonia: number;
  pathogenPositive: boolean;
  nearbyOutbreakKm: number | null;
  rainfall24h: number;
}

interface RuleHit {
  rule: string;
  driver: string;
  score: number;
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function levelFromScore(score: number): AlertLevel {
  if (score >= 80) return "critical";
  if (score >= 60) return "high";
  if (score >= 35) return "moderate";
  return "low";
}

export function assessWssvRisk(input: WssvRiskInput): RiskAssessment {
  const hits: RuleHit[] = [];

  if (input.temperatureDelta24h > 3) {
    hits.push({
      rule: "temperatureDelta24h > 3",
      driver: "Rapid temperature change",
      score: 18,
    });
  }

  if (input.salinityDrop24h > 5) {
    hits.push({
      rule: "salinityDrop24h > 5",
      driver: "Rapid salinity drop",
      score: 22,
    });
  }

  if (input.rainfall24h > 30) {
    hits.push({
      rule: "rainfall24h > 30",
      driver: "Rainfall-driven environmental pressure",
      score: 12,
    });
  }

  if (input.doMin < 4) {
    hits.push({
      rule: "doMin < 4",
      driver: "Low dissolved oxygen",
      score: 16,
    });
  }

  if (input.ammonia > 1) {
    hits.push({
      rule: "ammonia > 1",
      driver: "Elevated ammonia",
      score: 14,
    });
  }

  if (input.nearbyOutbreakKm !== null && input.nearbyOutbreakKm <= 5) {
    hits.push({
      rule: "nearbyOutbreakKm <= 5",
      driver: "Nearby fictional event exposure",
      score: 20,
    });
  }

  if (input.pathogenPositive) {
    hits.push({
      rule: "pathogenPositive === true",
      driver: "Positive pathogen signal in Demo data",
      score: 24,
    });
  }

  const hasEnvironmentalAnomaly =
    input.temperatureDelta24h > 3 ||
    input.salinityDrop24h > 5 ||
    input.rainfall24h > 30 ||
    input.doMin < 4 ||
    input.ammonia > 1;

  const rawScore = hits.reduce((total, hit) => total + hit.score, 10);
  const riskScore = clampScore(
    input.pathogenPositive && hasEnvironmentalAnomaly ? Math.max(rawScore, 88) : rawScore
  );
  const alertLevel: AlertLevel =
    input.pathogenPositive && hasEnvironmentalAnomaly
      ? "critical"
      : levelFromScore(riskScore);

  const confidence = clampScore(55 + hits.length * 6 + (input.pathogenPositive ? 8 : 0));

  return {
    disease: "White Spot Syndrome Virus (WSSV) Demo Risk",
    riskScore,
    alertLevel,
    triggeredRules: hits.map((hit) => hit.rule),
    mainDrivers: hits.map((hit) => hit.driver),
    recommendations: getRecommendations(alertLevel),
    confidence,
  };
}
