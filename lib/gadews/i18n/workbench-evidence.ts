import type { Locale } from "./locale";
import type { AssessmentDriver, QualityIssue } from "../warning-assessment";
import { workbenchCopy, workbenchText } from "./workbench-copy";

const combinedReasonCopy = Object.entries(workbenchCopy)
  .filter(([source, copy]) => source.length > 30 && source !== copy[0])
  .sort((a, b) => b[0].length - a[0].length);

/** Stable engine identities select display explanations. Source wording stays available separately. */
export const wsdRuleEnglish: Record<string, readonly [string, string]> = {
  "ENV-001": ["Water temperature", "Source observations associate temperatures below 26°C with higher WSSV detection (about 20.0%), and above 29°C with lower detection (about 10.7%). Temperature alone cannot establish disease."],
  "ENV-002": ["pH", "The source pH intervals overlap at 8.4–8.5 and need expert review. Conflicting intervals do not produce a determinate score."],
  "ENV-003": ["Culture environment", "Source detection rates differ between freshwater, marine and brackish culture. Host composition may explain this association; freshwater itself is not established as the cause."],
  "PATH-005": ["Seed / broodstock WSSV test", "The source weak-positive rule contributes evidence for review; it does not establish a clinical diagnosis."],
  "PATH-006": ["Seed / broodstock WSSV test", "The source positive rule contributes pathogen evidence; clinical confirmation requires separate review."],
  "PATH-010": ["Rapid test", "Positive rapid screening suggests possible WSSV exposure or infection and requires laboratory confirmation."],
  "PATH-012": ["Rapid test", "The source strong-positive rapid-test branch contributes pathogen evidence for laboratory review."],
  "PATH-017": ["Water / sediment WSSV test", "The source weak-positive environmental branch contributes environmental pathogen evidence, separate from animal confirmation."],
  "PATH-018": ["Water / sediment WSSV test", "Environmental WSSV evidence is retained separately from evidence of infection in animals."],
  "PATH-023": ["Live-feed WSSV test", "Weak-positive live-feed evidence indicates a possible pathogen introduction route requiring review."],
  "PATH-024": ["Live-feed WSSV test", "WSSV detection in live feed indicates a possible feed-borne pathogen introduction risk."],
  "PATH-026": ["Animal qPCR quantity", "The source Ct ≥35 branch represents a low or weak signal; assay interpretation still requires review."],
  "PATH-027": ["Animal qPCR quantity", "The source 25<Ct<35 branch represents a moderate pathogen-load signal."],
  "PATH-028": ["Animal qPCR quantity", "The source Ct ≤25 branch represents a high pathogen-load signal."],
  "CLIN-002": ["Reduced feeding", "Reduced feeding is a nonspecific early signal and can also arise from water quality, oxygen or weather changes."],
  "CLIN-004": ["Abnormal swimming / lethargy", "Abnormal behavior is nonspecific and may also reflect hypoxia, poisoning or other diseases."],
  "CLIN-006": ["Pond-edge aggregation", "Aggregation indicates a group abnormality but requires water-quality and pathogen evidence."],
  "CLIN-008": ["White spots on the carapace", "White spots are a classic WSD sign, but alkalinity or bacterial conditions can look similar; laboratory confirmation is required."],
  "CLIN-010": ["Red body", "Red body is nonspecific and may relate to WSD, Vibrio infection, toxins or stress."],
  "CLIN-012": ["Loose / easily peeled shell", "Loose shell indicates an abnormal condition but has low specificity; review other signs and WSSV tests."],
  "CLIN-014": ["Increased mortality", "Increased mortality indicates disease or severe stress and requires prompt investigation of WSSV and other causes."],
  "CLIN-015": ["Acute mass mortality", "Mass mortality is an emergency signal rather than an early signal."],
  "CLIN-017": ["Abnormal bird aggregation", "Bird aggregation may indicate weak or dead shrimp at the surface; it is not specific to WSD."],
  "PATHO-002": ["Suspicious tissue lesions", "Abnormal pathology does not directly confirm WSD and requires pathogen evidence."],
  "PATHO-003": ["Nuclear enlargement / inclusions", "Typical lesions support WSD-related pathology; PCR/qPCR or ISH confirmation is still recommended."],
  "PATHO-004": ["ISH positive", "ISH localizes WSSV nucleic acid in tissue and provides strong diagnostic support."],
  "BASE-002": ["Candidate / secondary crustacean host", "These hosts may carry infection, but are generally not the highest-priority primary hosts."],
  "BASE-003": ["Major cultured shrimp host", "Major cultured shrimp are susceptible hosts of concern; exposure can cause substantial losses. Susceptibility is not infection."],
  "BASE-004": ["Red swamp crayfish host", "Source monitoring identifies relatively high WSSV detection in red swamp crayfish, warranting attention."],
  "BASE-006": ["Pond culture", "Weather, water sources and management fluctuations contribute to the source background risk."],
  "BASE-007": ["Large-waterbody culture", "Susceptible hosts or regional positive signals merit attention in large-waterbody culture."],
  "BASE-008": ["Rice–crayfish rotation", "The source flags possible host reservoirs and sustained environmental exposure in rice–crayfish rotation."],
  "BASE-012": ["Seasonal transition", "Seasonal transitions may bring temperature changes and environmental fluctuations."],
  "BASE-013": ["May–September monitoring period", "Source observations concentrate in May–September, with higher detection in some months; this is background context."],
  "BASE-015": ["Public regional WSD background", "A public regional report does not establish occurrence in a specific pond."],
  "BASE-016": ["Nearby WSD background", "Nearby events require review of water connections, distance and culture density."],
  "BASE-018": ["Historical WSSV-positive record", "Historical positivity may indicate persistent management, environmental or residual-pathogen risk."],
};

export const tilapiaRuleEnglish: Record<string, readonly [string, string]> = {
  "TST-WARN-001": ["Weather preparedness", "A valid weather warning prompts preparation without changing case status."],
  "TST-WARN-002": ["SAG high-temperature attention", "Temperature and duration require explicit candidate parameters and a complete exposure window; missing evidence stays unknown."],
  "TST-WARN-003": ["Prioritize low oxygen", "Low oxygen or verified respiratory distress prompts water-quality response while disease investigation stays separate."],
  "TST-WARN-004": ["Review combined environmental stress", "At least two independent, time-aligned environmental stresses prompt review; correlated indicators are not counted twice."],
  "TST-WARN-005": ["Investigate contact exposure", "Verified contact requires time alignment with the assessed unit."],
  "TST-WARN-006": ["Review introduced / breeding batches", "Missing origin and valid pathogen detection produce separate review tasks."],
  "TST-WARN-007": ["Detection in fish without signs", "Valid fish-tissue positivity with explicit absence of signs is detection, not clinical confirmation."],
  "TST-WARN-008": ["Environmental DNA clue", "Valid environmental DNA positivity indicates an exposure clue; an unvalidated matrix remains a research result."],
  "TST-WARN-009": ["Nonspecific feeding abnormality", "Abnormal feeding requires investigation; other infection evidence can support suspected-case review."],
  "TST-WARN-010": ["Triage neurological / eye signs", "Verified clinical abnormality prompts suspected-case review; pathogen identity stays unknown until testing."],
  "TST-WARN-011": ["Rapid mortality investigation", "Verified abnormal mortality prompts investigation; no denominator means no mortality rate."],
  "TST-WARN-012": ["Existing confirmed streptococcosis event", "Compatible clinical/pathology evidence, valid fish-tissue detection and professional confirmation are all required."],
  "TST-WARN-013": ["Mixed SAG / SIN detection", "Independent valid positives for SAG and SIN establish mixed detection; causality requires separate assessment."],
  "TST-WARN-014": ["Laboratory QC failure", "Failed quality controls invalidate only that test; it cannot support positive or negative branches."],
  "TST-WARN-015": ["Persistent abnormality after a negative test", "A single negative test with persistent abnormality requires continued investigation, without automatic clearance."],
  "TST-WARN-016": ["ST283 public-health review", "Reliable SAG ST283 typing with passed controls prompts risk communication; serotype III alone is insufficient."],
  "TST-WARN-017": ["SIN handling precautions", "Valid SIN detection and a handling task prompt protection against puncture injuries."],
  "TST-WARN-018": ["Review disease after vaccination", "Vaccination does not automatically exclude infection; review clinical evidence and vaccine records."],
  "TST-WARN-019": ["Restocking review", "Incomplete recovery checks stay pending until a professional review updates them."],
  "TST-WARN-020": ["Missing / stale evidence", "Missing required evidence makes only the dependent branch unknown; other established events remain present."],
  "TST-WARN-021": ["Response to a linked regional event", "Verified contact and actual time alignment support targeted monitoring; country centroids remain background only."],
  "TST-WARN-022": ["Evidence identity / diagnostic conflict", "Unresolved conflicts require review; majority voting cannot establish confirmation."],
};

export function rulePresentation(locale: Locale, id: string, originalLabel: string, originalExplanation: string, disease: "wsd" | "tilapia" = "wsd") {
  const copy = (disease === "wsd" ? wsdRuleEnglish : tilapiaRuleEnglish)[id];
  return locale === "en" && copy ? { label: copy[0], explanation: copy[1] } : { label: originalLabel, explanation: originalExplanation };
}

export function qualityPresentation(locale: Locale, issue: QualityIssue): string {
  // Code is the stable semantic identity; full original detail is still available.
  const translated = generatedText(locale, issue.message);
  if (locale === "en" || translated !== issue.message) return translated;
  return `${issue.field}：${workbenchText(locale, issue.code)}`;
}

const observationScopeLabels: Readonly<Record<string, string>> = {
  pond: "塘口", animal: "养殖动物", environment: "环境", feed: "饵料", regional: "区域",
};

export function generatedText(locale: Locale, text: string): string {
  const exact = workbenchText(locale, text);
  if (exact !== text) return exact;
  if (locale === "en") return text;
  const riskBoundary = /^Risk levels (overlap|are uncovered) at (.+)$/.exec(text);
  if (riskBoundary) return `风险等级在 ${riskBoundary[2]} 处分界${riskBoundary[1] === "overlap" ? "重叠" : "未覆盖"}，需要复核。`;
  const riskRange = /^Invalid range for (.+)$/.exec(text);
  if (riskRange) return `${workbenchText(locale, riskRange[1])}的分值范围无效。`;
  const ph = /^pH source options: (rule_conflict|rule_uncovered)$/.exec(text);
  if (ph) return `pH 来源选项：${workbenchText(locale, ph[1])}。`;
  const scope = /^Observation scope must be (.+)$/.exec(text);
  if (scope) return `观测范围须为${Object.hasOwn(observationScopeLabels, scope[1]) ? observationScopeLabels[scope[1]] : scope[1]}。`;
  if (text.startsWith("Input check: ")) return `输入检查：${generatedText(locale, text.slice(13))}`;
  const marked = /^Observation was marked (invalid|stale); it is not fresh valid evidence\.$/.exec(text);
  if (marked) return `观测已标为${workbenchText(locale, marked[1])}，不属于新鲜有效证据。`;
  const detection = /^(SAG|SIN) fish-tissue detection$/.exec(text);
  if (detection) return `${detection[1]} 鱼体组织检出`;
  const conflict = /^(.*): (.*); preserve each original finding and resolve through a linked professional record\.$/.exec(text);
  if (conflict) return `${conflict[1]}：${workbenchText(locale, conflict[2])}；保留每项原始结果，通过关联专业记录解决。`;
  // Engine combines deterministic reason sentences. Match longest phrases first,
  // without changing scientific values or attempting to translate source quotes.
  let translated = text;
  for (const [source, copy] of combinedReasonCopy) translated = translated.split(source).join(copy[0]);
  return translated;
}

export function driverPresentation(locale: Locale, driver: AssessmentDriver) {
  return rulePresentation(locale, driver.ruleId, driver.label, driver.explanation);
}
