import { createHash } from "node:crypto";
import wsdResource from "@/public/data/models/wsd-warning-model.json";
import { assessWsd, type WsdWarningInput, type WsdWarningModelConfig } from "../wsd-warning-model";
import type { AssessmentContext } from "../warning-assessment";
import type { BaselineItem, ComparisonBaseline, ScoringBranch, ScoringItem, ScoringRubric } from "./types";

type Mapping = { field: string; module: string; ids: string[]; active: string[]; optional?: boolean };
const range = (prefix: string, start: number, end: number) => Array.from({ length: end - start + 1 }, (_, i) => prefix + String(start + i).padStart(3, "0"));
const mapping: Mapping[] = [
  ...["waterTemperatureC", "ph", "farmingEnvironmentType"].map((field, i) => ({ field, module: "environment", ids: range("ENV-", i + 1, i + 1), active: range("ENV-", i + 1, i + 1) })),
  { field: "pcrQpcrResult", module: "pathogen", ids: range("PATH-", 1, 8), active: range("PATH-", 4, 6) },
  { field: "rapidTestResult", module: "pathogen", ids: range("PATH-", 9, 12), active: ["PATH-009", "PATH-010", "PATH-012"] },
  { field: "environmentalSampleResult", module: "pathogen", ids: range("PATH-", 13, 18), active: ["PATH-016", "PATH-017", "PATH-018"] },
  { field: "liveFeedResult", module: "pathogen", ids: range("PATH-", 19, 25), active: ["PATH-022", "PATH-023", "PATH-024"] },
  { field: "ctValue", module: "pathogen", ids: range("PATH-", 26, 40), active: range("PATH-", 26, 28), optional: true },
  ...["reducedFeeding", "abnormalSwimming", "pondEdgeAggregation", "whiteSpots", "redBody", "softShell", "increasedMortality"].map((field, i) => ({ field, module: "clinical", ids: range("CLIN-", i * 2 + 1, i * 2 + 2), active: range("CLIN-", i * 2 + 1, i * 2 + 2) })),
  { field: "massMortality", module: "clinical", ids: ["CLIN-015"], active: ["CLIN-015"] },
  { field: "birdAggregation", module: "clinical", ids: ["CLIN-016", "CLIN-017"], active: ["CLIN-016", "CLIN-017"] },
  { field: "pathologyResult", module: "pathology", ids: range("PATHO-", 1, 3), active: range("PATHO-", 1, 3) },
  { field: "ishResult", module: "pathology", ids: ["PATHO-004"], active: ["PATHO-004"] },
  { field: "species", module: "baseline", ids: range("BASE-", 1, 4), active: range("BASE-", 1, 4) },
  { field: "farmingMode", module: "baseline", ids: range("BASE-", 5, 8), active: range("BASE-", 5, 8) },
  { field: "month", module: "baseline", ids: range("BASE-", 11, 13), active: range("BASE-", 11, 13) },
  { field: "regionalDiseaseBackground", module: "baseline", ids: range("BASE-", 14, 16), active: range("BASE-", 14, 16) },
  { field: "historicalWssvPositiveRecord", module: "baseline", ids: range("BASE-", 17, 18), active: range("BASE-", 17, 18) },
];
export function buildWsdScoringRubric(config: WsdWarningModelConfig): ScoringRubric {
  const all = Object.values(config.modules).flatMap(module => module.rules);
  const items: ScoringItem[] = mapping.map(entry => {
    const rules = all.filter(rule => entry.ids.includes(rule.id ?? ""));
    const branches: ScoringBranch[] = rules.filter(rule => entry.active.includes(rule.id ?? "")).flatMap(rule =>
      rule.options?.length ? rule.options.map((option, i) => ({ id: rule.id + ":" + (option.level ?? i), label: option.label ?? rule.name ?? entry.field, score: option.score ?? 0, condition: option.condition ?? "" }))
        : [{ id: rule.id!, label: rule.name ?? entry.field, score: rule.score ?? 0, condition: rule.condition ?? "" }]);
    // The inherited engine returns zero for a usable input with no active positive driver.
    // This is an explicit implementation branch, not a new scientific source rule.
    if (!branches.some(branch => branch.score === 0)) branches.push({ id: "WSD:" + entry.field + ":none", label: "未触发计分", score: 0, condition: "Usable explicit input with no active scoring driver in the existing implementation." });
    return { id: "WSD:" + entry.field, field: entry.field, label: rules[0]?.name ?? entry.field, module: entry.module, maxScore: Math.max(...branches.map(branch => branch.score), 0), branches,
      supported: true, ...(entry.optional ? { optional: true } : {}), sourceRefs: rules.map(rule => rule.id!),
      sourceRules: rules.map(rule => Object.fromEntries(Object.entries(rule).filter(([key]) => key !== "raw"))) };
  });
  const covered = new Set(items.flatMap(item => item.sourceRules ?? []).map(rule => rule.id));
  if (all.some(rule => !covered.has(rule.id))) throw new Error("Unmapped WSD source rule");
  const body = { id: "wsd-v1.0", version: config.version ?? "1.0", title: "WSD评分标准 v1.0", titleEn: "WSD scoring standard v1.0", status: "prototype" as const, scientificallyValidated: false as const, items,
    modules: Object.entries(config.modules).map(([id, module]) => ({ id, title: id, maxScore: module.maxScore })),
    sources: all.map(rule => ({ id: rule.id!, title: rule.name ?? rule.id!, href: "/data/models/wsd-warning-model.json#" + rule.id })) };
  return { ...body, hash: createHash("sha256").update(JSON.stringify({ body, riskLevels: config.riskLevels, forcedUpgradeRules: config.forcedUpgradeRules, extremeConditions: config.extremeConditions })).digest("hex") };
}
export function aggregateScores(items: { module: string; score: number | null }[], rubric: ScoringRubric): number {
  return rubric.modules.reduce((total, module) => total + Math.min(module.maxScore, items.filter(item => item.module === module.id).reduce((sum, item) => sum + (item.score ?? 0), 0)), 0);
}
const aliases: Record<string, string> = { ph: "pH", abnormalSwimming: "abnormalSwimmingOrLethargy", pathologyResult: "histopathologyResult", environmentalSampleResult: "pcrQpcrResult_2", regionalDiseaseBackground: "localDiseaseBackground" };
export function evaluateWsdBaseline(input: WsdWarningInput, context: AssessmentContext, rubric: ScoringRubric, config: WsdWarningModelConfig = wsdResource as WsdWarningModelConfig): ComparisonBaseline {
  const result = assessWsd(input, config, context);
  const items: BaselineItem[] = rubric.items.map(item => {
    const value = input[item.field] ?? input[aliases[item.field]];
    const inactive = item.optional && (value === undefined || value === null || value === "");
    const issues = result.quality.issues.filter(issue => issue.field === item.field);
    const usable = !inactive && !issues.length && (result.quality.observedFields.includes(item.field) || item.optional && value !== undefined);
    const single = usable ? assessWsd({ [item.field]: value }, config, context) : null;
    const driver = single?.drivers[0];
    const branch = !usable ? undefined : driver
      ? item.branches.find(branch => branch.id === driver.ruleId) ?? item.branches.find(branch => branch.id.startsWith(driver.ruleId + ":") && branch.score === driver.score)
      : item.branches.find(branch => branch.score === 0);
    return { itemId: item.id, module: item.module, label: item.label, inputFields: [item.field], sourceRefs: [...item.sourceRefs],
      status: inactive ? "unsupported" : branch ? "matched" : issues.some(issue => issue.code === "rule_conflict" || issue.code === "rule_uncovered") ? "conflict" : "unknown",
      branchId: branch?.id ?? null, score: branch?.score ?? null,
      reason: inactive ? "Optional Ct was not supplied." : issues.length ? issues.map(issue => issue.code).join(", ") : branch ? branch.condition : "No independently verifiable branch." };
  });
  return { items, knownSubtotal: result.knownScore ?? 0, completeScore: result.score, maxScore: result.maxScore ?? 500, level: result.level,
    dataMode: result.dataMode, quality: { state: result.quality.state, issues: result.quality.issues.map(issue => ({ ...issue })) }, minimumAttention: result.minimumAttention,
    evaluatedCount: items.filter(item => item.score !== null).length, totalCount: items.filter(item => item.status !== "unsupported").length };
}
