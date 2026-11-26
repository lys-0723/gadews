import type { AssessmentContext, AssessmentResult, MinimumAttention, QualityIssue, RuleEvaluation } from "./warning-assessment";
import { snapshotAssessmentRecord } from "./warning-assessment";
import { isPositiveDetection, normalizeDetectionResult, normalizeObservationBoolean, normalizePathologyResult } from "./wsd-evidence";

export type WsdAssessmentContext = AssessmentContext;

export type WsdModuleKey =
  | "environment"
  | "pathogen"
  | "clinical"
  | "pathology"
  | "baseline";

type WsdInputValue = string | number | boolean | null | undefined;

export interface WsdModelRuleOption {
  level?: string;
  label?: string;
  condition?: string;
  score?: number;
}

export interface WsdModelRule {
  id?: string;
  name?: string;
  condition?: string;
  conditionLabel?: string;
  score?: number;
  riskLevel?: string;
  riskLevelLabel?: string;
  riskExplanation?: string;
  recommendedAction?: string;
  notes?: string;
  options?: WsdModelRuleOption[];
  [key: string]: unknown;
}

export interface WsdModelModule {
  maxScore: number;
  rules: WsdModelRule[];
}

export interface WsdRiskLevel {
  name: string;
  label: string;
  range?: {
    raw?: string;
    min?: number;
    max?: number;
    operator?: string;
    value?: number;
    minInclusive?: boolean;
    maxInclusive?: boolean;
  };
  enabled?: boolean;
  rank?: number;
}

export interface WsdWarningModelConfig {
  modelName?: string;
  modelNameEn?: string;
  version?: string;
  sourceWorkbook?: string;
  totalMaxScore?: number;
  modules: Record<WsdModuleKey, WsdModelModule>;
  riskLevels?: WsdRiskLevel[];
  forcedUpgradeRules?: Array<Record<string, unknown>>;
  extremeConditions?: Array<Record<string, unknown>>;
  inputTemplate?: {
    fields?: Array<Record<string, unknown>>;
    exampleRows?: Array<Record<string, unknown>>;
  };
}

export interface WsdWarningInput {
  regionOrSite?: string;
  farmOrPondId?: string;
  species?: string;
  farmingMode?: string;
  growthStage?: string;
  month?: number | string;
  waterTemperatureC?: number;
  ph?: number;
  pH?: number;
  farmingEnvironmentType?: string;
  /**
   * Primary animal/sample PCR or qPCR result for WSSV.
   */
  pcrQpcrResult?: string;
  rapidTestResult?: string;
  ctValue?: number;
  /**
   * Quantitative animal qPCR interpretation, when it is kept separate from the
   * categorical PCR/qPCR result in the converted model.
   */
  animalQpcrQuantitativeResult?: string;
  /**
   * Environmental sample WSSV result.
   */
  environmentalSampleResult?: string;
  /**
   * Compatibility alias from the Excel-converted JSON. In this UI/model layer,
   * pcrQpcrResult_2 is treated as the environmental sample WSSV result, not as
   * the primary animal/sample PCR/qPCR result.
   */
  pcrQpcrResult_2?: string;
  liveFeedResult?: string;
  reducedFeeding?: boolean | string;
  abnormalSwimming?: boolean | string;
  abnormalSwimmingOrLethargy?: boolean | string;
  pondEdgeAggregation?: boolean | string;
  whiteSpots?: boolean | string;
  redBodyOrSoftShell?: boolean | string;
  redBody?: boolean | string;
  softShell?: boolean | string;
  increasedMortality?: boolean | string;
  massMortality?: boolean | string;
  birdAggregation?: boolean | string;
  pathologyResult?: string;
  histopathologyResult?: string;
  ishResult?: string;
  regionalDiseaseBackground?: string;
  localDiseaseBackground?: string;
  historicalWssvPositiveRecord?: boolean | string;
  [key: string]: WsdInputValue;
}

export interface WsdRiskDriver {
  module: WsdModuleKey;
  label: string;
  score: number;
  explanation: string;
  recommendedAction?: string;
  ruleId?: string;
  sourceRefs?: string[];
}

export interface WsdModuleScore {
  module: WsdModuleKey;
  rawScore: number;
  maxScore: number;
  score: number;
  drivers: WsdRiskDriver[];
}

export interface WsdExtremeAlert {
  field: string;
  label: string;
  value: number;
  message: string;
}

export interface WsdRiskResult {
  environmentScore: number;
  pathogenScore: number;
  clinicalScore: number;
  pathologyScore: number;
  baselineScore: number;
  moduleScores: Record<WsdModuleKey, WsdModuleScore>;
  totalScore: number | null;
  normalizedRiskIndex: number | null;
  initialRiskLevel: WsdRiskLevel | null;
  finalRiskLevel: WsdRiskLevel | null;
  appliedForcedRules: string[];
  mainRiskDrivers: WsdRiskDriver[];
  extremeAlerts: WsdExtremeAlert[];
  recommendedActions: string[];
  samplingRecommended: boolean;
  reportingRecommended: boolean;
  interpretation: string;
  assessment: AssessmentResult;
  status: AssessmentResult["status"];
  knownScore: number;
  minimumAttention: MinimumAttention;
}

const DEFAULT_TOTAL_MAX_SCORE = 500;
const DEFAULT_RISK_LEVELS: WsdRiskLevel[] = [
  { name: "低风险", label: "低风险", range: { min: 0, max: 120 }, rank: 0 },
  {
    name: "中风险 / 预防性预警",
    label: "中风险 / 预防性预警",
    range: { min: 120, max: 220 },
    rank: 1,
  },
  {
    name: "高风险 / 需要响应",
    label: "高风险 / 需要响应",
    range: { min: 220, max: 320 },
    rank: 2,
  },
  {
    name: "极高风险 / 疫病事件很可能正在发生",
    label: "极高风险 / 疫病事件很可能正在发生",
    range: { operator: ">=", value: 320 },
    rank: 3,
  },
];

const MODULES: WsdModuleKey[] = [
  "environment",
  "pathogen",
  "clinical",
  "pathology",
  "baseline",
];

export const wsdLowRiskExampleInput: WsdWarningInput = {
  regionOrSite: "示例区域A",
  farmOrPondId: "Pond-001",
  species: "凡纳滨对虾",
  farmingMode: "普通池塘",
  growthStage: "养成期",
  month: 6,
  waterTemperatureC: 30,
  ph: 8.2,
  farmingEnvironmentType: "海水养殖",
  pcrQpcrResult: "阴性",
  rapidTestResult: "阴性",
  reducedFeeding: false,
  abnormalSwimming: false,
  pondEdgeAggregation: false,
  whiteSpots: false,
  redBodyOrSoftShell: false,
  increasedMortality: false,
  massMortality: false,
  birdAggregation: false,
  regionalDiseaseBackground: "无",
  historicalWssvPositiveRecord: false,
};

export const wsdMediumHighRiskExampleInput: WsdWarningInput = {
  regionOrSite: "示例区域B",
  farmOrPondId: "Pond-002",
  species: "克氏原螯虾",
  farmingMode: "稻虾连作",
  growthStage: "养成期",
  month: 5,
  waterTemperatureC: 25.5,
  ph: 8.6,
  farmingEnvironmentType: "淡水养殖",
  pcrQpcrResult: "未检测",
  rapidTestResult: "未检测",
  reducedFeeding: true,
  abnormalSwimming: true,
  pondEdgeAggregation: false,
  whiteSpots: false,
  redBodyOrSoftShell: false,
  increasedMortality: false,
  massMortality: false,
  birdAggregation: false,
  regionalDiseaseBackground: "无",
  historicalWssvPositiveRecord: false,
};

export const wsdExtremeRiskExampleInput: WsdWarningInput = {
  regionOrSite: "示例区域C",
  farmOrPondId: "Pond-003",
  species: "凡纳滨对虾",
  farmingMode: "普通池塘",
  growthStage: "养成期",
  month: 7,
  waterTemperatureC: 25,
  ph: 7.6,
  farmingEnvironmentType: "海水养殖",
  pcrQpcrResult: "阳性",
  reducedFeeding: false,
  abnormalSwimming: false,
  whiteSpots: true,
  increasedMortality: true,
  massMortality: false,
  regionalDiseaseBackground: "有",
  historicalWssvPositiveRecord: false,
};

export const wsdRiskExampleInputs = [
  wsdLowRiskExampleInput,
  wsdMediumHighRiskExampleInput,
  wsdExtremeRiskExampleInput,
];

export async function loadWsdWarningModelConfig(): Promise<WsdWarningModelConfig> {
  const response = await fetch("/data/models/wsd-warning-model.json");
  if (!response.ok) {
    throw new Error(`Failed to load WSD warning model: ${response.status}`);
  }
  return response.json() as Promise<WsdWarningModelConfig>;
}

export function normalizeRiskIndex(score: number, maxScore = DEFAULT_TOTAL_MAX_SCORE) {
  if (!Number.isFinite(score) || maxScore <= 0) return 0;
  return Math.round((score / maxScore) * 100);
}

export function capScore(score: number, maxScore: number) {
  return Math.min(Math.max(0, Math.round(score)), maxScore);
}

export function getRiskLevelByScore(
  score: number,
  riskLevels?: WsdRiskLevel[]
): WsdRiskLevel {
  if (!Number.isFinite(score) || score < 0) throw new Error("Invalid risk score: expected a finite non-negative value");
  const levels = normalizeRiskLevels(riskLevels);
  const matches = levels.filter((level) => riskRangeMatches(score, level.range));
  if (matches.length !== 1) throw new Error(`Risk level ${matches.length ? "conflict" : "uncovered"} at score ${score}`);
  return matches[0];
}

function riskRangeMatches(score: number, range: WsdRiskLevel["range"]) {
  if (!range) return false;
  const value = range.value;
  if (typeof value === "number" && Number.isFinite(value)) {
    if (range.operator === ">") return score > value;
    if (range.operator === ">=") return score >= value;
    if (range.operator === "<") return score < value;
    if (range.operator === "<=") return score <= value;
  }
  if (range.operator && range.operator !== "rangeInclusive") return false;
  if (!Number.isFinite(range.min) || !Number.isFinite(range.max)) return false;
  const lower = range.min as number;
  const upper = range.max as number;
  return (range.minInclusive === false ? score > lower : score >= lower) &&
    (range.maxInclusive === false ? score < upper : score <= upper);
}

/** Checking every endpoint and each intervening open interval proves unique coverage. */
export function validateRiskLevels(riskLevels?: WsdRiskLevel[], totalMax = DEFAULT_TOTAL_MAX_SCORE): QualityIssue[] {
  const issues: QualityIssue[] = [];
  if (!Number.isFinite(totalMax) || totalMax <= 0) {
    return [{ field: "riskLevels", code: "invalid", message: "Risk score maximum must be finite and positive", ruleId: "RISK-LEVELS" }];
  }
  const levels = normalizeRiskLevels(riskLevels);
  const points = new Set([0, totalMax]);
  for (const level of levels) {
    const range = level.range;
    const validRange = range && (
      ([">", ">=", "<", "<="].includes(range.operator ?? "") && typeof range.value === "number" && Number.isFinite(range.value)) ||
      ((!range.operator || range.operator === "rangeInclusive") && typeof range.min === "number" && typeof range.max === "number" && Number.isFinite(range.min) && Number.isFinite(range.max) && range.min <= range.max)
    );
    if (!validRange) issues.push({ field: "riskLevels", code: "invalid", message: `Invalid range for ${level.name}`, ruleId: "RISK-LEVELS" });
    for (const value of [range?.min, range?.max, range?.value]) {
      if (typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= totalMax) points.add(value);
    }
  }
  const endpoints = [...points].sort((a, b) => a - b);
  const probes = [...endpoints, ...endpoints.slice(1).map((point, i) => (point + endpoints[i]) / 2)].sort((a, b) => a - b);
  for (const score of probes) {
    const count = levels.filter((level) => riskRangeMatches(score, level.range)).length;
    if (count !== 1) issues.push({ field: "riskLevels", code: count ? "rule_conflict" : "rule_uncovered", message: `Risk levels ${count ? "overlap" : "are uncovered"} at ${score}`, ruleId: "RISK-LEVELS" });
  }
  return issues;
}

export function hasPositivePathogenEvidence(input: WsdWarningInput) {
  return [
    input.pcrQpcrResult,
    input.rapidTestResult,
    input.environmentalSampleResult,
    input.pcrQpcrResult_2,
    input.liveFeedResult,
    input.animalQpcrQuantitativeResult,
  ].some(isPositiveLike);
}

export function hasMajorClinicalSignals(input: WsdWarningInput) {
  return (
    asBoolean(input.reducedFeeding) ||
    asBoolean(input.abnormalSwimming ?? input.abnormalSwimmingOrLethargy) ||
    asBoolean(input.whiteSpots) ||
    asBoolean(input.increasedMortality) ||
    asBoolean(input.massMortality)
  );
}

export function detectExtremeConditions(
  input: WsdWarningInput,
  _modelConfig?: WsdWarningModelConfig
): WsdExtremeAlert[] {
  void _modelConfig;
  const alerts: WsdExtremeAlert[] = [];
  const waterTemperatureC = toNumber(input.waterTemperatureC);
  const ph = toNumber(input.ph ?? input.pH);

  if (waterTemperatureC !== undefined && waterTemperatureC > 40) {
    alerts.push({
      field: "waterTemperatureC",
      label: "水温 > 40℃",
      value: waterTemperatureC,
      message: "出现极端高温，应优先复核传感器读数并关注应激风险。",
    });
  }
  if (waterTemperatureC !== undefined && waterTemperatureC < 10) {
    alerts.push({
      field: "waterTemperatureC",
      label: "水温 < 10℃",
      value: waterTemperatureC,
      message: "出现极端低温，应优先复核传感器读数并关注应激风险。",
    });
  }
  if (ph !== undefined && ph > 10) {
    alerts.push({
      field: "ph",
      label: "pH > 10",
      value: ph,
      message: "pH 超过极端阈值，应复核水质数据并关注环境压力。",
    });
  }
  if (ph !== undefined && ph < 6) {
    alerts.push({
      field: "ph",
      label: "pH < 6",
      value: ph,
      message: "pH 低于极端阈值，应复核水质数据并关注环境压力。",
    });
  }

  return alerts;
}

/** Re-evaluate through the common quality gate instead of upgrading unverified legacy state. */
export function applyForcedUpgradeRules(
  result: WsdRiskResult,
  input: WsdWarningInput,
  modelConfig: WsdWarningModelConfig
): WsdRiskResult {
  void result;
  return calculateWsdRisk(input, modelConfig);
}

export function assessWsd(
  rawInput: WsdWarningInput,
  modelConfig: WsdWarningModelConfig,
  context: WsdAssessmentContext = {}
): AssessmentResult {
  return evaluateWsd(rawInput, modelConfig, context).assessment;
}

/** Compatibility output keeps module subtotals; incomplete overall grades stay null. */
export function calculateWsdRisk(
  rawInput: WsdWarningInput,
  modelConfig: WsdWarningModelConfig
): WsdRiskResult {
  const { assessment, modules, input, initialLevel, finalLevel, attentionReasons } = evaluateWsd(rawInput, modelConfig);
  const extremeAlerts = detectExtremeConditions(input, modelConfig);
  return {
    environmentScore: modules.environment.score,
    pathogenScore: modules.pathogen.score,
    clinicalScore: modules.clinical.score,
    pathologyScore: modules.pathology.score,
    baselineScore: modules.baseline.score,
    moduleScores: modules,
    totalScore: assessment.score,
    normalizedRiskIndex: assessment.riskIndex,
    initialRiskLevel: initialLevel,
    finalRiskLevel: finalLevel,
    appliedForcedRules: attentionReasons,
    mainRiskDrivers: Object.values(modules).flatMap((module) => module.drivers).filter((driver) => driver.score > 0).sort((a, b) => b.score - a.score),
    extremeAlerts,
    recommendedActions: assessment.actions,
    samplingRecommended: assessment.minimumAttention !== "none" || asBoolean(input.whiteSpots) || asBoolean(input.increasedMortality),
    reportingRecommended: assessment.minimumAttention === "urgent",
    interpretation: assessment.status === "complete"
      ? `综合风险分为 ${assessment.score}/${assessment.maxScore}，风险指数为 ${assessment.riskIndex}，等级为 ${assessment.level?.label}。专家规则原型结果不等同于实验室确诊或发病概率。`
      : `资料或规则不完整；已知证据小计为 ${assessment.knownScore}/${assessment.maxScore}，完整分数与等级暂不可用。请复核质量问题；最低关注为 ${assessment.minimumAttention}，不等同于确诊。`,
    assessment,
    status: assessment.status,
    knownScore: assessment.knownScore ?? 0,
    minimumAttention: assessment.minimumAttention,
  };
}

const WSD_EXPECTED_FIELDS = [
  "waterTemperatureC", "ph", "farmingEnvironmentType", "species", "farmingMode", "month",
  "pcrQpcrResult", "rapidTestResult", "environmentalSampleResult", "liveFeedResult",
  "pathologyResult", "ishResult", "regionalDiseaseBackground", "historicalWssvPositiveRecord",
  "reducedFeeding", "abnormalSwimming", "pondEdgeAggregation", "whiteSpots", "redBody",
  "softShell", "increasedMortality", "massMortality", "birdAggregation",
];
const WSD_BOOLEAN_FIELDS = new Set([
  "historicalWssvPositiveRecord", "reducedFeeding", "abnormalSwimming", "pondEdgeAggregation",
  "whiteSpots", "redBody", "softShell", "increasedMortality", "massMortality", "birdAggregation",
]);
const WSD_DETECTION_FIELDS = new Set(["pcrQpcrResult", "rapidTestResult", "environmentalSampleResult", "liveFeedResult", "ishResult"]);
const WSD_SOURCE = "/data/models/wsd-warning-model.json";
const WSD_INPUT_ALIASES: Record<string, string> = {
  ph: "pH", abnormalSwimming: "abnormalSwimmingOrLethargy", pathologyResult: "histopathologyResult",
  environmentalSampleResult: "pcrQpcrResult_2", regionalDiseaseBackground: "localDiseaseBackground",
};

function evaluateWsd(rawInput: WsdWarningInput, config: WsdWarningModelConfig, context: WsdAssessmentContext = {}) {
  const issues: QualityIssue[] = [];
  const validRoot = rawInput !== null && typeof rawInput === "object" && !Array.isArray(rawInput);
  const snapshot = validRoot ? { ...rawInput } : {};
  const inputSnapshot = snapshotAssessmentRecord(snapshot);
  if (!validRoot) issues.push({ field: "input", code: "invalid", message: "Input must be an observation object" });
  const input = normalizeInput(snapshot);
  // Canonical fields are the only evidence used after quality validation.
  for (const alias of ["pH", "abnormalSwimmingOrLethargy", "histopathologyResult", "pcrQpcrResult_2", "localDiseaseBackground"]) delete input[alias];
  const now = context.now === undefined ? new Date() : new Date(context.now);
  const validNow = Number.isFinite(now.getTime());
  const assessedAt = validNow ? now.toISOString() : new Date().toISOString();
  const dataMode = context.dataMode ?? "manual";
  const contextSnapshot = snapshotAssessmentRecord({ ...context, requestedNow: context.now, now: assessedAt, dataMode });
  if (!validNow) issues.push({ field: "assessedAt", code: "invalid", message: "Assessment time is invalid" });
  const observedFields: string[] = [];
  const fields = [...WSD_EXPECTED_FIELDS];
  if (!isMissing(input.ctValue)) fields.push("ctValue");
  for (const field of fields) {
    const value = input[field];
    let code: QualityIssue["code"] | undefined;
    if (isMissing(value)) code = "missing";
    else if (typeof value === "string" && ["unknown", "未知", "不详", "未记录"].includes(value.trim().toLowerCase())) code = "unknown";
    else if (WSD_BOOLEAN_FIELDS.has(field)) {
      const state = normalizeObservationBoolean(value);
      if (typeof state === "boolean") input[field] = state;
      else code = state;
    } else if (WSD_DETECTION_FIELDS.has(field) || field === "pathologyResult") {
      const state = field === "pathologyResult" ? normalizePathologyResult(value) : normalizeDetectionResult(value);
      if (["missing", "unknown", "not_tested", "inconclusive", "invalid"].includes(state)) code = state as QualityIssue["code"];
      else input[field] = state;
    } else if (["waterTemperatureC", "ph", "month", "ctValue"].includes(field)) {
      const number = toNumber(value);
      const bounds = field === "ph" ? [0, 14] : field === "month" ? [1, 12] : field === "ctValue" ? [0, 60] : [-5, 60];
      if (number === undefined || typeof value === "boolean" || number < bounds[0] || number > bounds[1] || (field === "month" && !Number.isInteger(number))) code = "invalid";
      else input[field] = number;
    } else if (typeof value !== "string") code = "invalid";
    else if (field === "farmingEnvironmentType" && !["淡水养殖", "海水养殖", "半咸水养殖"].includes(value.trim())) code = "invalid";
    const alias = WSD_INPUT_ALIASES[field];
    const metadata = context.observations?.[field] ??
      (alias && isMissing(snapshot[field]) ? context.observations?.[alias] : undefined);
    if (!code && metadata) {
      if (metadata.scope !== undefined && metadata.scope !== expectedObservationScope(field)) {
        issues.push({ field, code: "scope_mismatch", message: `Observation scope must be ${expectedObservationScope(field)}` });
        code = "scope_mismatch";
      }
      const timestamp = metadata.observedAt === undefined ? undefined : new Date(metadata.observedAt).getTime();
      if ((timestamp !== undefined && !Number.isFinite(timestamp)) ||
        (metadata.maxAgeHours !== undefined && (!Number.isFinite(metadata.maxAgeHours) || metadata.maxAgeHours < 0 || timestamp === undefined)) ||
        (timestamp !== undefined && validNow && timestamp > now.getTime())) {
        issues.push({ field, code: "invalid", message: "Observation time or maximum age is invalid" });
        code = code ?? "invalid";
      } else if (timestamp !== undefined && metadata.maxAgeHours !== undefined && validNow && now.getTime() - timestamp > metadata.maxAgeHours * 3600000) {
        issues.push({ field, code: "stale", message: "Observation exceeds its declared maximum age" });
        code = code ?? "stale";
      }
    }
    if (code) {
      if (!issues.some((issue) => issue.field === field && issue.code === code)) issues.push({ field, code, message: `${field}: ${code}` });
      delete input[field];
    } else if (WSD_EXPECTED_FIELDS.includes(field)) observedFields.push(field);
  }
  if (!isMissing(snapshot.redBodyOrSoftShell)) {
    issues.push({ field: "redBodyOrSoftShell", code: "ambiguous_legacy", message: "Record redBody and softShell separately; the old combined field is not scored", ruleId: "CLIN-010/CLIN-012" });
  }
  // This legacy free-text field has no independent scoring branch or quality denominator.
  // Quantitative evidence is represented by the validated optional ctValue instead.
  delete input.animalQpcrQuantitativeResult;
  const ruleEvaluations: RuleEvaluation[] = [];
  if (input.rapidTestResult === "weak_positive") {
    issues.push({ field: "rapidTestResult", code: "rule_uncovered", message: "The source rapid-test rules do not define a weak-positive score", ruleId: "PATH-010/PATH-012" });
  }
  if (input.ishResult === "weak_positive") {
    issues.push({ field: "ishResult", code: "rule_uncovered", message: "The source ISH rules do not define a weak-positive score", ruleId: "PATHO-004" });
  }
  if (input.ph !== undefined) {
    const evaluation = evaluatePh(input.ph, config);
    ruleEvaluations.push(evaluation);
    if (evaluation.state === "rule_conflict" || evaluation.state === "rule_uncovered") issues.push({ field: "ph", code: evaluation.state, message: `pH source options: ${evaluation.state}`, ruleId: "ENV-002" });
  }
  const maxScore = config.totalMaxScore ?? DEFAULT_TOTAL_MAX_SCORE;
  issues.push(...validateRiskLevels(config.riskLevels, maxScore));
  for (const moduleKey of MODULES) {
    const cap = config.modules?.[moduleKey]?.maxScore;
    if (!Number.isFinite(cap) || cap < 0) issues.push({ field: `modules.${moduleKey}`, code: "invalid", message: "Module maximum must be finite and non-negative" });
  }
  if (MODULES.reduce((sum, module) => sum + (config.modules?.[module]?.maxScore ?? 0), 0) !== maxScore) {
    issues.push({ field: "totalMaxScore", code: "rule_conflict", message: "Module maxima do not sum to total maximum" });
  }
  const modules = {
    environment: scoreEnvironment(input, config), pathogen: scorePathogen(input, config),
    clinical: scoreClinical(input, config), pathology: scorePathology(input, config), baseline: scoreBaseline(input, config),
  };
  const knownScore = Object.values(modules).reduce((sum, module) => sum + module.score, 0);
  const status = observedFields.length === 0 ? "insufficient_data" : issues.length ? "partial" : "complete";
  const { attention, reasons } = minimumAttentionForInput(input);
  const initialLevel = status === "complete" ? getRiskLevelByScore(knownScore, config.riskLevels) : null;
  const levels = normalizeRiskLevels(config.riskLevels);
  let finalLevel = initialLevel;
  if (finalLevel && (attention === "high" || attention === "urgent")) {
    const target = levelByRank(levels, attention === "urgent" ? 3 : 2);
    if (riskRank(target, levels) > riskRank(finalLevel, levels)) finalLevel = target;
  }
  const drivers = Object.values(modules).flatMap((module) => module.drivers).filter((driver) => driver.score > 0).sort((a, b) => b.score - a.score);
  const actions = uniqueStrings([
    ...drivers.map((driver) => driver.recommendedAction).filter((action): action is string => Boolean(action)),
    ...(attention === "urgent" ? ["请尽快采样复核 WSSV，并按当地流程联系水生动物疫病专业人员。"]
      : attention === "high" ? ["建议尽快 PCR/qPCR 复核，并加强现场观察。"]
      : attention === "review" ? ["建议复核异常证据并补充病原检测。"] : []),
    ...(status !== "complete" ? ["请补全或复核质量问题；已知证据小计不能作为完整风险等级。"] : ["继续巡塘并保留水质、症状和检测记录。"]),
  ]);
  const assessment: AssessmentResult = {
    schemaVersion: "1.0", diseaseId: "wsd", dataMode,
    assessedAt, inputSnapshot, contextSnapshot,
    status, model: { id: "wsd-warning-model", version: config.version ?? "unknown", state: "prototype",
      source: [WSD_SOURCE, ...(config.sourceWorkbook ? [`/data/models/${config.sourceWorkbook}`] : [])],
      warnings: ["专家规则原型，尚无真实服务或预测效果验证；风险指数不是发病概率。", ...issues.filter((issue) => issue.field === "riskLevels").map((issue) => issue.message)] },
    quality: { state: status, observedFields, expectedFields: [...WSD_EXPECTED_FIELDS], issues },
    knownScore, maxScore: Number.isFinite(maxScore) && maxScore > 0 ? maxScore : null,
    score: status === "complete" ? knownScore : null,
    riskIndex: status === "complete" ? normalizeRiskIndex(knownScore, maxScore) : null,
    level: finalLevel ? { id: finalLevel.name, label: finalLevel.label, rank: finalLevel.rank } : null,
    minimumAttention: attention,
    drivers: drivers.map((driver) => ({ ruleId: driver.ruleId ?? "UNSPECIFIED", label: driver.label, explanation: driver.explanation, score: driver.score, sourceRefs: driver.sourceRefs ?? [WSD_SOURCE] })),
    actions,
    unsupportedRules: [
      "源配置中依赖自由文本的强制升级条目尚未作为通用表达式执行；最低关注仅沿用已明确的病原、病症和病理组合。",
      "当前未采集的苗种、管理、溶氧、氨氮及其他规则不参与本次计分。",
    ],
    prediction: { state: "not_configured", probability: null, horizonHours: null }, ruleEvaluations,
  };
  return { assessment, modules, input, initialLevel, finalLevel, attentionReasons: reasons };
}

function isMissing(value: unknown) {
  return value === null || value === undefined || (typeof value === "string" && value.trim() === "");
}

/** These are sample-kind defaults only. No site, pond, batch, or validity window is invented. */
function expectedObservationScope(field: string) {
  if (["ph", "waterTemperatureC", "farmingEnvironmentType"].includes(field)) return "pond";
  if (field === "environmentalSampleResult") return "environment";
  if (field === "liveFeedResult") return "feed";
  if (field === "regionalDiseaseBackground") return "regional";
  return "animal";
}

function minimumAttentionForInput(input: WsdWarningInput): { attention: MinimumAttention; reasons: string[] } {
  const pcr = isPositiveLike(input.pcrQpcrResult);
  const reasons: string[] = [];
  if (pcr) reasons.push("PCR/qPCR 阳性：最低关注为高");
  if (pcr && hasMajorClinicalSignals(input)) reasons.push("PCR/qPCR 阳性 + 主要病症异常：最低关注为紧急");
  if (pcr && (isTypicalPathologyPositive(input.pathologyResult) || isPositiveLike(input.ishResult))) reasons.push("PCR/qPCR 阳性 + 典型病理或 ISH 阳性：最低关注为紧急");
  if (asBoolean(input.massMortality) && hasPositivePathogenEvidence(input)) reasons.push("暴发性死亡 + 病原阳性：最低关注为紧急");
  const attention = reasons.some((reason) => reason.includes("紧急")) ? "urgent" : pcr ? "high" :
    (hasPositivePathogenEvidence(input) || isPositiveLike(input.ishResult) || isTypicalPathologyPositive(input.pathologyResult) || hasMajorClinicalSignals(input)) ? "review" : "none";
  return { attention, reasons };
}

/** A deliberately limited numeric grammar: comparisons, closed ranges, and OR only. */
function phConditionMatches(value: number, condition: string): boolean | undefined {
  const terms = condition.replace(/pH/gi, "").replace(/\s/g, "").replace(/≤/g, "<=").replace(/≥/g, ">=").split(/或|\bor\b/i);
  if (!terms.length) return undefined;
  const results = terms.map((term) => {
    const comparison = term.match(/^(<=|>=|<|>)(-?\d+(?:\.\d+)?)$/);
    if (comparison) {
      const boundary = Number(comparison[2]);
      return comparison[1] === "<=" ? value <= boundary : comparison[1] === ">=" ? value >= boundary : comparison[1] === "<" ? value < boundary : value > boundary;
    }
    const range = term.match(/^(-?\d+(?:\.\d+)?)[–—~-](-?\d+(?:\.\d+)?)$/);
    return range ? value >= Number(range[1]) && value <= Number(range[2]) : undefined;
  });
  return results.includes(undefined) ? undefined : results.some(Boolean);
}

function evaluatePh(value: number, config: WsdWarningModelConfig): RuleEvaluation {
  const rule = findRule(config, "environment", "ENV-002");
  const options = rule?.options ?? [];
  const matches = options.map((option) => phConditionMatches(value, option.condition ?? ""));
  const matching = options.filter((_, index) => matches[index] === true);
  const state = matches.includes(undefined) || matching.length > 1 ? "rule_conflict" : matching.length === 0 ? "rule_uncovered" : "matched";
  const score = state === "matched" ? toNumber(matching[0].score) : undefined;
  return { ruleId: "ENV-002", field: "ph", state: state === "matched" && score === undefined ? "rule_uncovered" : state,
    score: score ?? null, matchedOptions: matching.map((option) => option.condition ?? ""), sourceRefs: sourceRefsForRule(rule, "ENV-002") };
}

function normalizeInput(input: WsdWarningInput): WsdWarningInput {
  return {
    ...input,
    ph: input.ph ?? input.pH,
    abnormalSwimming: input.abnormalSwimming ?? input.abnormalSwimmingOrLethargy,
    pathologyResult: input.pathologyResult ?? input.histopathologyResult,
    environmentalSampleResult: input.environmentalSampleResult ?? input.pcrQpcrResult_2,
    regionalDiseaseBackground: input.regionalDiseaseBackground ?? input.localDiseaseBackground,
  };
}

function scoreEnvironment(
  input: WsdWarningInput,
  modelConfig: WsdWarningModelConfig
): WsdModuleScore {
  const drivers: WsdRiskDriver[] = [];
  const waterTemperatureC = toNumber(input.waterTemperatureC);
  const ph = toNumber(input.ph ?? input.pH);

  if (waterTemperatureC !== undefined) {
    if (waterTemperatureC < 26) {
      addDriver(drivers, "environment", "ENV-001", modelConfig, "水温低于 26℃", 30);
    } else if (waterTemperatureC <= 29) {
      addDriver(drivers, "environment", "ENV-001", modelConfig, "水温 26–29℃", 15);
    }
  }

  if (ph !== undefined) {
    const evaluation = evaluatePh(ph, modelConfig);
    if (evaluation.state === "matched" && evaluation.score !== null && evaluation.score > 0)
      addDriver(drivers, "environment", "ENV-002", modelConfig, "pH 水平", evaluation.score);
  }

  if (input.farmingEnvironmentType?.includes("淡水")) {
    addDriver(drivers, "environment", "ENV-003", modelConfig, "淡水养殖环境", 20);
  } else if (input.farmingEnvironmentType?.includes("海水")) {
    addDriver(drivers, "environment", "ENV-003", modelConfig, "海水养殖环境", 10);
  }

  return buildModuleScore("environment", drivers, modelConfig);
}

function scorePathogen(
  input: WsdWarningInput,
  modelConfig: WsdWarningModelConfig
): WsdModuleScore {
  const drivers: WsdRiskDriver[] = [];

  addCategoricalPathogenDriver(drivers, input.pcrQpcrResult, {
    module: "pathogen",
    ruleIds: { weak: "PATH-005", positive: "PATH-006", strong: "PATH-006" },
    weakScore: 50,
    positiveScore: 100,
    label: "PCR/qPCR 检测结果",
    modelConfig,
  });
  addCategoricalPathogenDriver(drivers, input.rapidTestResult, {
    module: "pathogen",
    ruleIds: { positive: "PATH-010", strong: "PATH-012" },
    positiveScore: 60,
    strongScore: 100,
    label: "现场快检结果",
    modelConfig,
  });
  addCategoricalPathogenDriver(drivers, input.environmentalSampleResult, {
    module: "pathogen",
    ruleIds: { weak: "PATH-017", positive: "PATH-018", strong: "PATH-018" },
    weakScore: 50,
    positiveScore: 100,
    label: "环境样品 WSSV 检测结果",
    modelConfig,
  });
  addCategoricalPathogenDriver(drivers, input.liveFeedResult, {
    module: "pathogen",
    ruleIds: { weak: "PATH-023", positive: "PATH-024", strong: "PATH-024" },
    weakScore: 20,
    positiveScore: 50,
    label: "鲜活饵料 WSSV 检测结果",
    modelConfig,
  });

  const ctValue = toNumber(input.ctValue);
  if (ctValue !== undefined) {
    if (ctValue <= 25) {
      addDriver(drivers, "pathogen", "PATH-028", modelConfig, "Ct≤25，高病原载量提示", 100);
    } else if (ctValue < 35) {
      addDriver(drivers, "pathogen", "PATH-027", modelConfig, "25<Ct<35，中等病原载量提示", 50);
    } else {
      addDriver(drivers, "pathogen", "PATH-026", modelConfig, "Ct≥35，低风险或弱信号", 10);
    }
  }

  return buildModuleScore("pathogen", drivers, modelConfig);
}

function scoreClinical(
  input: WsdWarningInput,
  modelConfig: WsdWarningModelConfig
): WsdModuleScore {
  const drivers: WsdRiskDriver[] = [];
  const entries: Array<[boolean, string, string, number]> = [
    [asBoolean(input.reducedFeeding), "CLIN-002", "摄食下降/厌食", 5],
    [asBoolean(input.abnormalSwimming), "CLIN-004", "游动异常/嗜睡/反应迟钝", 5],
    [asBoolean(input.pondEdgeAggregation), "CLIN-006", "池边聚集/水面异常活动", 10],
    [asBoolean(input.whiteSpots), "CLIN-008", "甲壳白斑", 20],
    [asBoolean(input.redBody), "CLIN-010", "体色发红", 10],
    [asBoolean(input.softShell), "CLIN-012", "甲壳变软或易剥脱", 40],
    [asBoolean(input.increasedMortality), "CLIN-014", "死亡增加", 10],
    [asBoolean(input.massMortality), "CLIN-015", "暴发性大规模死亡", 5],
    [asBoolean(input.birdAggregation), "CLIN-017", "鸟类异常聚集捕食", 10],
  ];

  entries.forEach(([active, ruleId, label, score]) => {
    if (active) addDriver(drivers, "clinical", ruleId, modelConfig, label, score);
  });

  return buildModuleScore("clinical", drivers, modelConfig);
}

function scorePathology(
  input: WsdWarningInput,
  modelConfig: WsdWarningModelConfig
): WsdModuleScore {
  const drivers: WsdRiskDriver[] = [];
  const pathology = normalizePathologyResult(input.pathologyResult);

  if (pathology === "typical") {
    addDriver(drivers, "pathology", "PATHO-003", modelConfig, "典型病理阳性", 20);
  } else if (pathology === "suspicious") {
    addDriver(drivers, "pathology", "PATHO-002", modelConfig, "可疑组织病变", 10);
  }

  if (isPositiveLike(input.ishResult)) {
    addDriver(drivers, "pathology", "PATHO-004", modelConfig, "ISH 阳性", 55);
  }

  return buildModuleScore("pathology", drivers, modelConfig);
}

function scoreBaseline(
  input: WsdWarningInput,
  modelConfig: WsdWarningModelConfig
): WsdModuleScore {
  const drivers: WsdRiskDriver[] = [];
  const species = normalizeText(input.species);
  const farmingMode = normalizeText(input.farmingMode);
  const month = Number(input.month);

  if (species.includes("克氏原螯虾")) {
    addDriver(drivers, "baseline", "BASE-004", modelConfig, "克氏原螯虾", 20);
  } else if (
    ["凡纳滨对虾", "斑节对虾", "日本囊对虾", "中国明对虾", "对虾"].some((item) =>
      species.includes(item)
    )
  ) {
    addDriver(drivers, "baseline", "BASE-003", modelConfig, "主要养殖对虾宿主", 20);
  } else if (["罗氏沼虾", "蟹", "甲壳"].some((item) => species.includes(item))) {
    addDriver(drivers, "baseline", "BASE-002", modelConfig, "候选或次要甲壳类宿主", 10);
  }

  if (farmingMode.includes("稻虾")) {
    addDriver(drivers, "baseline", "BASE-008", modelConfig, "稻虾连作", 5);
  } else if (farmingMode.includes("大水面")) {
    addDriver(drivers, "baseline", "BASE-007", modelConfig, "大水面养殖", 10);
  } else if (farmingMode.includes("普通池塘") || farmingMode.includes("池塘")) {
    addDriver(drivers, "baseline", "BASE-006", modelConfig, "普通池塘养殖", 5);
  }

  if (Number.isFinite(month)) {
    if (month >= 5 && month <= 9) {
      addDriver(drivers, "baseline", "BASE-013", modelConfig, "5–9 月主要监测期", 10);
    } else if (month === 4 || month === 10) {
      addDriver(drivers, "baseline", "BASE-012", modelConfig, "季节转换期", 5);
    }
  }

  const background = normalizeText(input.regionalDiseaseBackground);
  if (["疑似", "确诊", "周边", "有"].some((item) => background.includes(item))) {
    addDriver(drivers, "baseline", "BASE-016", modelConfig, "区域存在 WSD 背景", 10);
  } else if (["QAAD", "WAHIS", "国家", "区域"].some((item) => background.includes(item))) {
    addDriver(drivers, "baseline", "BASE-015", modelConfig, "公开报告存在区域级 WSD 背景", 5);
  }

  if (asBoolean(input.historicalWssvPositiveRecord)) {
    addDriver(drivers, "baseline", "BASE-018", modelConfig, "历史 WSSV 阳性记录", 20);
  }

  return buildModuleScore("baseline", drivers, modelConfig);
}

function addCategoricalPathogenDriver(
  drivers: WsdRiskDriver[],
  value: string | undefined,
  options: {
    module: WsdModuleKey;
    ruleIds: { weak?: string; positive?: string; strong?: string };
    weakScore?: number;
    positiveScore: number;
    strongScore?: number;
    label: string;
    modelConfig: WsdWarningModelConfig;
  }
) {
  if (isStrongPositiveLike(value)) {
    addDriver(
      drivers,
      options.module,
      options.ruleIds.strong ?? options.ruleIds.positive,
      options.modelConfig,
      `${options.label}：强阳性`,
      options.strongScore ?? options.positiveScore
    );
  } else if (isPositiveLike(value)) {
    addDriver(
      drivers,
      options.module,
      options.ruleIds.positive,
      options.modelConfig,
      `${options.label}：阳性`,
      options.positiveScore
    );
  } else if (isWeakPositiveLike(value)) {
    if (!options.ruleIds.weak) return;
    addDriver(
      drivers,
      options.module,
      options.ruleIds.weak,
      options.modelConfig,
      `${options.label}：弱阳性`,
      options.weakScore ?? Math.round(options.positiveScore / 2)
    );
  }
}

function addDriver(
  drivers: WsdRiskDriver[],
  module: WsdModuleKey,
  ruleId: string | undefined,
  modelConfig: WsdWarningModelConfig,
  fallbackLabel: string,
  fallbackScore: number
) {
  const rule = ruleId ? findRule(modelConfig, module, ruleId) : undefined;
  // Prefer JSON-provided score/rule metadata. Fallback values are used only
  // where the converted rule remains a text condition instead of an executable expression.
  const score = toNumber(rule?.score) ?? scoreFromRuleOption(rule, fallbackScore) ?? fallbackScore;
  drivers.push({
    module,
    label: rule?.name ?? fallbackLabel,
    score,
    explanation: rule?.riskExplanation ?? rule?.notes ?? fallbackLabel,
    recommendedAction: normalizeRecommendedAction(rule?.recommendedAction),
    ruleId,
    sourceRefs: sourceRefsForRule(rule, ruleId),
  });
}

function buildModuleScore(
  module: WsdModuleKey,
  drivers: WsdRiskDriver[],
  modelConfig: WsdWarningModelConfig
): WsdModuleScore {
  const configuredMax = modelConfig.modules?.[module]?.maxScore;
  const maxScore = Number.isFinite(configuredMax) && configuredMax >= 0 ? configuredMax : 0;
  const rawScore = drivers.reduce((sum, driver) => sum + driver.score, 0);
  return {
    module,
    rawScore,
    maxScore,
    score: capScore(rawScore, maxScore),
    drivers,
  };
}

function findRule(
  modelConfig: WsdWarningModelConfig,
  module: WsdModuleKey,
  ruleId: string
): WsdModelRule | undefined {
  return modelConfig.modules?.[module]?.rules?.find((rule) => rule.id === ruleId);
}

function sourceRefsForRule(rule: WsdModelRule | undefined, ruleId?: string) {
  const knowledge = typeof rule?.knowledgeRefId === "string" ? rule.knowledgeRefId.split(/[;；]/).map((item) => item.trim()).filter((item) => item && item !== "-") : [];
  return [`${WSD_SOURCE}#${ruleId ?? "unmapped"}`, ...knowledge];
}

function scoreFromRuleOption(rule: WsdModelRule | undefined, fallback: number) {
  if (!rule?.options?.length) return fallback;
  const matched = rule.options.find((option) => option.score === fallback);
  return matched?.score ?? fallback;
}

function normalizeRiskLevels(riskLevels?: WsdRiskLevel[]) {
  const levels = riskLevels === undefined ? DEFAULT_RISK_LEVELS : riskLevels.filter((level) => level.enabled !== false);
  return levels.map((level, index) => ({ ...level, rank: index }));
}

function riskRank(level: WsdRiskLevel | null, levels: WsdRiskLevel[]) {
  if (!level) return -1;
  const idx = levels.findIndex((item) => item.name === level.name || item.label === level.label);
  return idx >= 0 ? idx : level.rank ?? 0;
}

function levelByRank(levels: WsdRiskLevel[], rank: number) {
  return levels[Math.min(Math.max(rank, 0), levels.length - 1)];
}

function normalizeRecommendedAction(value: unknown) {
  const text = normalizeText(value);
  if (!text || text.includes("让AI")) return undefined;
  return text;
}

function uniqueStrings(items: string[]) {
  return Array.from(new Set(items));
}

function toNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function normalizeText(value: unknown) {
  return String(value ?? "").trim();
}

function asBoolean(value: unknown) {
  return normalizeObservationBoolean(value) === true;
}

function isPositiveLike(value: unknown) {
  return isPositiveDetection(value);
}

function isWeakPositiveLike(value: unknown) {
  return normalizeDetectionResult(value) === "weak_positive";
}

function isStrongPositiveLike(value: unknown) {
  return normalizeDetectionResult(value) === "strong_positive";
}

function isTypicalPathologyPositive(value: unknown) {
  return normalizePathologyResult(value) === "typical";
}

export function getSupportedWsdModuleKeys() {
  return MODULES;
}
