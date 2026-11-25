import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import * as wsd from "./wsd-warning-model";
import { normalizeDetectionResult, normalizePathologyResult } from "./wsd-evidence";

const config = JSON.parse(readFileSync("public/data/models/wsd-warning-model.json", "utf8")) as wsd.WsdWarningModelConfig;
const completeInput: wsd.WsdWarningInput = {
  waterTemperatureC: 30, ph: 8.2, farmingEnvironmentType: "半咸水养殖",
  species: "其他甲壳类", farmingMode: "工厂化养殖", month: 1,
  pcrQpcrResult: "negative", rapidTestResult: "negative",
  environmentalSampleResult: "negative", liveFeedResult: "negative",
  pathologyResult: "negative", ishResult: "negative",
  regionalDiseaseBackground: "无", historicalWssvPositiveRecord: false,
  reducedFeeding: false, abnormalSwimming: false, pondEdgeAggregation: false,
  whiteSpots: false, redBody: false, softShell: false, increasedMortality: false,
  massMortality: false, birdAggregation: false,
};
const validLevels: wsd.WsdRiskLevel[] = [
  { name: "low", label: "Low", range: { min: 0, max: 120, minInclusive: true, maxInclusive: false } },
  { name: "medium", label: "Medium", range: { min: 120, max: 220, minInclusive: true, maxInclusive: false } },
  { name: "high", label: "High", range: { min: 220, max: 320, minInclusive: true, maxInclusive: false } },
  { name: "urgent", label: "Urgent", range: { operator: ">=", value: 320 } },
];
const validConfig = { ...config, riskLevels: validLevels };

function assess(input: wsd.WsdWarningInput, model = config, context?: wsd.WsdAssessmentContext) {
  assert.equal(typeof wsd.assessWsd, "function", "共同评估入口应已实现");
  return wsd.assessWsd(input, model, context);
}

test("否定病理和检测文字不产生阳性分或典型病理升级", () => {
  for (const pathologyResult of ["未见典型病变", "非典型病变", "阴性"]) {
    const result = wsd.calculateWsdRisk({ pcrQpcrResult: "阳性", pathologyResult }, config);
    assert.equal(result.pathologyScore, 0);
    assert.equal(result.appliedForcedRules.some((rule) => rule.includes("典型病理")), false);
  }
  assert.equal(wsd.hasPositivePathogenEvidence({ pcrQpcrResult: "未发现阳性" }), false);
  assert.equal(wsd.hasPositivePathogenEvidence({ pcrQpcrResult: "positive" }), true);
});

test("红体与软壳独立计分，旧混合字段不猜测", () => {
  for (const [input, expected] of [
    [{ redBody: true }, 10], [{ softShell: true }, 40],
    [{ redBody: true, softShell: true }, 50], [{ redBodyOrSoftShell: true }, 0],
  ] as const) {
    assert.equal(wsd.calculateWsdRisk(input, config).clinicalScore, expected);
  }
  assert.ok(assess({ redBodyOrSoftShell: true }).quality.issues.some((issue) => issue.code === "ambiguous_legacy"));
});

test("pH按原选项完整匹配，空档与交叉不计确定分", () => {
  for (const [ph, score] of [[7.7, 30], [7.8, 15], [7.9, 15], [8, 0], [8.2, 0], [8.399, 0], [8.71, 30]]) {
    assert.equal(wsd.calculateWsdRisk({ ph }, config).environmentScore, score);
  }
  for (const ph of [7.75, 7.95, 8.4, 8.49, 8.5, 8.6, 8.7]) {
    const result = assess({ ph });
    assert.equal(result.knownScore, 0);
    assert.ok(result.quality.issues.some((issue) => issue.field === "ph" && issue.code === (ph < 8 ? "rule_uncovered" : "rule_conflict")));
    assert.equal(result.score, null);
  }
});

test("等级比较保持真实端点且不回退最高等级", () => {
  const levels = [{ name: "urgent", label: "Urgent", range: { operator: ">", value: 320 } }];
  assert.throws(() => wsd.getRiskLevelByScore(320, levels), /uncovered|未覆盖/i);
  assert.equal(wsd.getRiskLevelByScore(321, levels).name, "urgent");
  for (const invalid of [NaN, Infinity, -1]) assert.throws(() => wsd.getRiskLevelByScore(invalid, levels));
  assert.throws(() => wsd.getRiskLevelByScore(120, config.riskLevels), /conflict|交叉|冲突/i);
  assert.equal(wsd.getRiskLevelByScore(120, validLevels).name, "medium");
  assert.equal(wsd.validateRiskLevels(validLevels, 500).length, 0);
  const issues = wsd.validateRiskLevels(config.riskLevels, 500);
  for (const boundary of [120, 220, 320]) assert.ok(issues.some((issue) => issue.message.includes(String(boundary))));
});

test("无核心输入与部分输入分别输出质量，不伪造低风险", () => {
  const empty = assess({});
  assert.equal(empty.status, "insufficient_data");
  assert.equal(empty.quality.observedFields.length, 0);
  assert.equal(empty.quality.expectedFields.length, 23);
  assert.equal(empty.knownScore, 0);
  assert.equal(empty.minimumAttention, "none");
  for (const value of [empty.score, empty.riskIndex, empty.level]) assert.equal(value, null);
  const partial = assess({ reducedFeeding: false });
  assert.equal(partial.status, "partial");
  assert.deepEqual(partial.quality.observedFields, ["reducedFeeding"]);
  const legacy = wsd.calculateWsdRisk({}, config);
  assert.equal(legacy.totalScore, null);
  assert.equal(legacy.finalRiskLevel, null);
});

test("完整观察仍暴露原等级冲突，只有独立合法测试配置可完整分级", () => {
  const original = assess(completeInput);
  assert.equal(original.status, "partial");
  assert.equal(original.quality.observedFields.length, 23);
  assert.equal(original.knownScore, 10);
  assert.equal(original.score, null);
  assert.ok(original.quality.issues.some((issue) => issue.field === "riskLevels" && issue.code === "rule_conflict"));
  const complete = assess(completeInput, validConfig);
  assert.equal(complete.status, "complete");
  assert.equal(complete.score, 10);
  assert.equal(complete.riskIndex, 2);
  assert.equal(complete.level?.id, "low");
});

test("质量原因分别保留，未知和未测不作为有效观察", () => {
  const result = assess({
    waterTemperatureC: NaN, ph: Infinity, month: 99, ctValue: -1,
    pcrQpcrResult: "unknown", rapidTestResult: "not_tested",
    environmentalSampleResult: "inconclusive", liveFeedResult: "invalid",
    reducedFeeding: "unknown", redBody: "not a boolean",
  });
  assert.equal(result.status, "insufficient_data");
  for (const code of ["invalid", "unknown", "not_tested", "inconclusive"]) {
    assert.ok(result.quality.issues.some((issue) => issue.code === code));
  }
  assert.equal(result.knownScore, 0);
  for (const input of [{ ph: -1 }, { ph: 15 }, { waterTemperatureC: 61 }, { waterTemperatureC: -6 }, { month: 1.5 }, { ctValue: 61 }]) {
    assert.ok(assess(input).quality.issues.some((issue) => issue.code === "invalid"));
  }
});

test("时效和样本范围不合格排除证据且不抵消另一项有效证据", () => {
  const result = assess({ pcrQpcrResult: "positive", pathologyResult: "typical", ishResult: "positive", redBody: true }, config, {
    now: new Date("2026-10-28T12:00:00Z"),
    observations: {
      pcrQpcrResult: { observedAt: "2026-10-26T12:00:00Z", maxAgeHours: 24, scope: "animal" },
      pathologyResult: { scope: "environment" },
    },
  });
  assert.ok(result.quality.issues.some((issue) => issue.field === "pcrQpcrResult" && issue.code === "stale"));
  assert.ok(result.quality.issues.some((issue) => issue.field === "pathologyResult" && issue.code === "scope_mismatch"));
  assert.equal(result.knownScore, 65);
  assert.equal(result.minimumAttention, "review");
  assert.equal(result.assessedAt, "2026-10-28T12:00:00.000Z");
  const retained = assess({ pcrQpcrResult: "positive", rapidTestResult: "positive" }, config, {
    observations: { rapidTestResult: { scope: "environment" } },
  });
  assert.equal(retained.minimumAttention, "high");
  assert.equal(retained.knownScore, 90);
});

test("明确病原组合支持独立最低关注，来源与预测边界可追溯", () => {
  const high = assess({ pcrQpcrResult: "positive", pathologyResult: "未见典型病变" });
  assert.equal(high.minimumAttention, "high");
  for (const pathologyResult of ["typical", "典型病理阳性", "typical_positive"]) {
    assert.equal(assess({ pcrQpcrResult: "positive", pathologyResult }).minimumAttention, "urgent");
  }
  assert.equal(assess({ pcrQpcrResult: "positive", whiteSpots: true }).minimumAttention, "urgent");
  const example = assess({ pcrQpcrResult: "positive" }, config, { dataMode: "example" });
  assert.equal(example.schemaVersion, "1.0");
  assert.equal(example.diseaseId, "wsd");
  assert.equal(example.dataMode, "example");
  assert.deepEqual(example.inputSnapshot, { pcrQpcrResult: "positive" });
  assert.equal(example.model.version, "1.0");
  assert.equal(example.model.state, "prototype");
  assert.ok(example.model.source.length > 0);
  assert.ok(example.drivers.every((driver) => driver.ruleId && driver.sourceRefs.length > 0));
  assert.deepEqual(example.prediction, { state: "not_configured", probability: null, horizonHours: null });
});

test("非法根输入和时间元数据产生问题，输入快照不随原对象修改", () => {
  for (const input of [null, [], "positive"]) {
    assert.ok(assess(input as unknown as wsd.WsdWarningInput).quality.issues.some((issue) => issue.field === "input" && issue.code === "invalid"));
  }
  const input = { pcrQpcrResult: "positive" };
  const result = assess(input, config, { observations: { pcrQpcrResult: { observedAt: "bad-date", maxAgeHours: 24 } } });
  assert.equal(result.knownScore, 0);
  assert.ok(result.quality.issues.some((issue) => issue.field === "pcrQpcrResult" && issue.code === "invalid"));
  input.pcrQpcrResult = "negative";
  assert.equal(result.inputSnapshot.pcrQpcrResult, "positive");
});

test("继承属性名称不是检测或病理枚举且不能算有效观察", () => {
  for (const value of ["constructor", "__proto__", "toString", "hasOwnProperty"]) {
    assert.equal(normalizeDetectionResult(value), "invalid");
    assert.equal(normalizePathologyResult(value), "invalid");
    const result = assess({ ...completeInput, pcrQpcrResult: value }, validConfig);
    assert.equal(result.status, "partial");
    assert.ok(result.quality.issues.some((issue) => issue.field === "pcrQpcrResult" && issue.code === "invalid"));
    assert.equal(result.level, null);
  }
});

test("ISH弱阳性没有源评分档，必须报告未覆盖而不能完整低风险", () => {
  const result = assess({ ...completeInput, ishResult: "weak_positive" }, validConfig);
  assert.equal(result.status, "partial");
  assert.equal(result.score, null);
  assert.equal(result.level, null);
  assert.ok(result.quality.issues.some((issue) => issue.field === "ishResult" && issue.code === "rule_uncovered"));
  assert.equal(result.drivers.some((driver) => driver.ruleId === "PATHO-004"), false);
  assert.equal(result.inputSnapshot.ishResult, "weak_positive");
});

test("显式空等级或全部禁用不会悄悄启用默认等级", () => {
  assert.throws(() => wsd.getRiskLevelByScore(10, []), /uncovered/i);
  assert.ok(wsd.validateRiskLevels([], 500).some((issue) => issue.code === "rule_uncovered"));
  const disabled = validLevels.map((level) => ({ ...level, enabled: false }));
  assert.equal(assess(completeInput, { ...config, riskLevels: disabled }).status, "partial");
});

test("弱阳性保留原分数，无弱阳性配置的快检不得凭空造分", () => {
  for (const [input, ruleId, score] of [
    [{ pcrQpcrResult: "weak_positive" }, "PATH-005", 50],
    [{ environmentalSampleResult: "weak_positive" }, "PATH-017", 50],
    [{ liveFeedResult: "weak_positive" }, "PATH-023", 20],
    [{ rapidTestResult: "strong_positive" }, "PATH-012", 100],
    [{ pathologyResult: "suspicious" }, "PATHO-002", 10],
  ] as const) {
    const result = assess(input);
    assert.equal(result.drivers.find((driver) => driver.ruleId === ruleId)?.score, score);
  }
  const weakRapid = assess({ rapidTestResult: "weak_positive" });
  assert.equal(weakRapid.knownScore, 0);
  assert.ok(weakRapid.quality.issues.some((issue) => issue.field === "rapidTestResult" && issue.code === "rule_uncovered"));
});

test("错误模块上限不让已知小计变成NaN", () => {
  const result = assess({ redBody: true }, {
    ...config, modules: { ...config.modules, clinical: { ...config.modules.clinical, maxScore: NaN } },
  });
  assert.equal(result.status, "partial");
  assert.ok(Number.isFinite(result.knownScore));
  assert.ok(result.quality.issues.some((issue) => issue.field === "modules.clinical" && issue.code === "invalid"));
});

test("别名检测过期不能经旧字段重新触发关注，期限端点保持有效", () => {
  const expired = assess({ pcrQpcrResult_2: "positive", massMortality: true }, config, {
    now: "2026-10-28T12:00:00Z", observations: { environmentalSampleResult: { observedAt: "2026-10-26T12:00:00Z", maxAgeHours: 24 } },
  });
  assert.equal(expired.minimumAttention, "review");
  assert.equal(expired.knownScore, 5);
  const atExpiry = assess({ pcrQpcrResult: "positive" }, config, {
    now: "2026-10-28T12:00:00Z", observations: { pcrQpcrResult: { observedAt: "2026-10-27T12:00:00Z", maxAgeHours: 24 } },
  });
  assert.equal(atExpiry.knownScore, 90);
  assert.equal(atExpiry.minimumAttention, "high");
  assert.equal(atExpiry.quality.issues.some((issue) => issue.code === "stale"), false);
  const noWindow = assess({ pcrQpcrResult: "positive" }, config, {
    now: "2026-10-28T12:00:00Z", observations: { pcrQpcrResult: { observedAt: "2020-01-01T00:00:00Z" } },
  });
  assert.equal(noWindow.minimumAttention, "high");
  assert.equal(noWindow.quality.issues.some((issue) => issue.code === "stale"), false);
});

test("pH执行配置每个选项的运算符与分数，保留三重命中轨迹", () => {
  const custom = {
    ...validConfig,
    modules: { ...config.modules, environment: { ...config.modules.environment, rules: config.modules.environment.rules.map((rule) => rule.id === "ENV-002" ? {
      ...rule, options: [{ condition: "pH<8.0", score: 11 }, { condition: "pH≥8.0", score: 3 }],
    } : rule) } },
  };
  assert.equal(assess({ ph: 8 }, custom).knownScore, 3);
  assert.equal(assess({ ph: 7.9 }, custom).knownScore, 11);
  assert.equal(assess({ ph: 8.5 }).ruleEvaluations?.[0].matchedOptions.length, 3);
});

test("旧强制升级入口对输入重新校验，不沿用与无效输入不符的完整等级", () => {
  const complete = wsd.calculateWsdRisk(completeInput, validConfig);
  const invalid = wsd.applyForcedUpgradeRules(complete, null as unknown as wsd.WsdWarningInput, validConfig);
  assert.equal(invalid.status, "insufficient_data");
  assert.equal(invalid.finalRiskLevel, null);
  const negative = wsd.applyForcedUpgradeRules(complete, { pcrQpcrResult: "未发现阳性", pathologyResult: "未见典型病变" }, validConfig);
  assert.equal(negative.minimumAttention, "none");
  assert.equal(negative.finalRiskLevel, null);
});

test("别名观察元数据沿用原字段，不能遗漏它已声明的过期状态", () => {
  const result = assess({ pcrQpcrResult_2: "positive", massMortality: true }, config, {
    now: "2026-10-28T12:00:00Z",
    observations: { pcrQpcrResult_2: { observedAt: "2026-10-26T12:00:00Z", maxAgeHours: 24 } },
  });
  assert.equal(result.minimumAttention, "review");
  assert.equal(result.knownScore, 5);
  assert.ok(result.quality.issues.some((issue) => issue.field === "environmentalSampleResult" && issue.code === "stale"));
});
