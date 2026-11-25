export type DetectionState =
  | "negative" | "weak_positive" | "positive" | "strong_positive"
  | "not_tested" | "inconclusive" | "invalid" | "unknown" | "missing";
export type PathologyState =
  | "negative" | "suspicious" | "typical"
  | "not_tested" | "inconclusive" | "invalid" | "unknown" | "missing";

function key(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function missing(value: unknown) {
  return value === null || value === undefined || (typeof value === "string" && !value.trim());
}

const sharedStates: Record<string, DetectionState> = {
  unknown: "unknown", "未知": "unknown", "不详": "unknown", "未记录": "unknown",
  not_tested: "not_tested", "未检测": "not_tested", "未测": "not_tested", "not tested": "not_tested",
  inconclusive: "inconclusive", "不确定": "inconclusive", "结果不确定": "inconclusive", "无法判定": "inconclusive",
  invalid: "invalid", "无效": "invalid", "检测无效": "invalid", "质控失败": "invalid",
};
const detectionAliases: Record<string, DetectionState> = {
  ...sharedStates,
  negative: "negative", "阴性": "negative", "未检出": "negative",
  positive: "positive", "阳性": "positive",
  weak_positive: "weak_positive", "弱阳性": "weak_positive", "weak positive": "weak_positive",
  strong_positive: "strong_positive", "强阳性": "strong_positive", "strong positive": "strong_positive",
};
const pathologyAliases: Record<string, PathologyState> = {
  ...sharedStates as Record<string, PathologyState>,
  negative: "negative", "阴性": "negative", "无明显异常": "negative", "未见典型病变": "negative",
  "未见明显 wsd 相关病理变化": "negative", "未见明显wsd相关病理变化": "negative",
  suspicious: "suspicious", "可疑": "suspicious", "可疑病变": "suspicious", "可疑组织病变": "suspicious",
  typical: "typical", typical_positive: "typical", "典型病理阳性": "typical", "核内包涵体": "typical",
};

/** Only complete aliases match; negation and arbitrary prose never imply positivity. */
export function normalizeDetectionResult(value: unknown): DetectionState {
  if (missing(value)) return "missing";
  const candidate = key(value);
  return Object.hasOwn(detectionAliases, candidate) ? detectionAliases[candidate] : "invalid";
}

export function normalizePathologyResult(value: unknown): PathologyState {
  if (missing(value)) return "missing";
  const candidate = key(value);
  return Object.hasOwn(pathologyAliases, candidate) ? pathologyAliases[candidate] : "invalid";
}

export function isPositiveDetection(value: unknown) {
  return ["positive", "strong_positive"].includes(normalizeDetectionResult(value));
}

export function normalizeObservationBoolean(value: unknown): boolean | "missing" | "unknown" | "invalid" {
  if (missing(value)) return "missing";
  if (typeof value === "boolean") return value;
  const text = key(value);
  if (["true", "yes", "y", "1", "是", "有", "明显", "present"].includes(text)) return true;
  if (["false", "no", "n", "0", "否", "无", "absent"].includes(text)) return false;
  if (["unknown", "未知", "不详", "未记录"].includes(text)) return "unknown";
  return "invalid";
}
