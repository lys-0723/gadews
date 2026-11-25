import type { AlertLevel } from "./types";

export interface RecommendationSet {
  managerRecommendations: string[];
  farmerRecommendations: string[];
}

const RECOMMENDATIONS: Record<AlertLevel, RecommendationSet> = {
  low: {
    managerRecommendations: [
      "Continue routine dashboard monitoring and keep regional status unchanged.",
      "Review recent sensor completeness before the next scheduled update.",
    ],
    farmerRecommendations: [
      "Maintain normal husbandry routines and observe stock behavior during daily checks.",
      "Confirm that core sensors are reporting plausible values.",
    ],
  },
  moderate: {
    managerRecommendations: [
      "Increase review frequency for affected sites and compare nearby environmental trends.",
      "Ask field teams to verify sensor readings and site metadata before escalation.",
    ],
    farmerRecommendations: [
      "Increase visual observation and reduce avoidable handling or other stressors.",
      "Check aeration and backup power readiness as a precaution.",
    ],
  },
  high: {
    managerRecommendations: [
      "Flag the area for enhanced monitoring and notify responsible technical staff.",
      "Cross-check rainfall, salinity, oxygen, and proximity indicators for consistency.",
    ],
    farmerRecommendations: [
      "Closely observe pond conditions and keep aeration equipment ready.",
      "Avoid unnecessary transfers, crowding, or abrupt management changes.",
    ],
  },
  critical: {
    managerRecommendations: [
      "Escalate the Demo alert to the responsible professional team for review.",
      "Prioritize data validation across sensors, weather feeds, and nearby event records.",
    ],
    farmerRecommendations: [
      "Contact qualified aquaculture professionals for site-specific guidance.",
      "Minimize avoidable stress and keep oxygen support equipment under close watch.",
    ],
  },
};

export function getRecommendations(alertLevel: AlertLevel): RecommendationSet {
  return RECOMMENDATIONS[alertLevel];
}
