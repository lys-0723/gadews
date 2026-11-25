import type { AssistantSource } from "./types";

type Entry = Record<string, unknown>;
const record = (value: unknown): Entry => value && typeof value === "object" && !Array.isArray(value) ? value as Entry : {};
const list = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const string = (value: unknown): string => typeof value === "string" ? value : "";
function hash(value: string) {
  let result = 2166136261;
  for (const char of value) { result ^= char.charCodeAt(0); result = Math.imul(result, 16777619); }
  return (result >>> 0).toString(36);
}
export function safeSourceHref(value: unknown, fallback: string): string {
  if (typeof value !== "string" || /[\u0000-\u0020\u007f]/.test(value)) return fallback;
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password ? url.href : fallback;
  } catch { return fallback; }
}
function doiHref(value: unknown): string | undefined {
  const doi = string(value).replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "");
  return /^10\.\d{4,9}\/[^\s<>]+$/i.test(doi) ? `https://doi.org/${encodeURI(doi).replace(/#/g, "%23").replace(/\?/g, "%3F")}` : undefined;
}

export function buildAssistantCorpus(input: { literature: unknown; wsd: unknown; tilapia: unknown }): AssistantSource[] {
  const sources: AssistantSource[] = [];
  for (const value of list(input.literature)) {
    const item = record(value);
    const title = string(item.Title) || "Literature catalogue entry";
    const file = string(item.file_name);
    const id = `lit-${hash(`${item.collection || ""}:${file}:${title}`)}`;
    const fallback = `/data/literature.json#${id}`;
    const fileHref = file && !/[\/\\]|\.\./.test(file) ? `http://59.110.161.54/literature/${encodeURIComponent(file)}` : fallback;
    sources.push({ id, title, text: [item.Title, item.Authors, item["Journal/Publisher"], item.Category, item.Abstract].filter(Boolean).join("\n").slice(0, 6000), href: doiHref(item.DOI) || fileHref, kind: "literature", accessLevel: "目录/整理摘要 · catalogue / abstract", limitations: "模型仅使用目录元数据和整理摘要，未读取全文。原文入口不代表全文已核实。", ...(typeof item.Pub_Year === "number" ? { year: item.Pub_Year } : {}) });
  }
  const wsd = record(input.wsd);
  for (const ruleModule of Object.values(record(wsd.modules))) {
    const indicators = new Map<string, Entry[]>();
    for (const value of list(record(ruleModule).rules)) {
      const rule = record(value);
      if (!string(rule.id)) continue;
      const key = `${string(rule.name) || rule.id}:${string(rule.knowledgeRefId)}`;
      const branches = indicators.get(key) || [];
      branches.push(rule); indicators.set(key, branches);
    }
    for (const branches of indicators.values()) {
      const render = (entries: Entry[]) => `${wsd.sourceWorkbook || "WSD model"} · ${entries.map((entry) => entry.id).join(", ")}\n${JSON.stringify({ sourceRuleIds: entries.map((entry) => entry.id), branches: entries })}`;
      // Preserve complete original branches, including raw provenance. Split only between
      // branches when a large indicator exceeds the bounded document size.
      const chunks: Entry[][] = [];
      let pending: Entry[] = [];
      for (const branch of branches) {
        if (render([branch]).length > 6000) throw new Error("WSD branch exceeds 6000 character evidence limit");
        if (pending.length && render([...pending, branch]).length > 6000) { chunks.push(pending); pending = []; }
        pending.push(branch);
      }
      if (pending.length) chunks.push(pending);
      for (const [index, chunk] of chunks.entries()) {
        const id = string(chunk[0].id);
        const originalIds = chunk.map((branch) => string(branch.id)).join(", ");
        sources.push({ id: `wsd-${id}`, title: `WSD 白斑病 / white spot syndrome · ${string(chunk[0].name)}${chunks.length > 1 ? ` (${index + 1}/${chunks.length})` : ""}`, text: render(chunk), href: `/data/models/wsd-warning-model.json#${encodeURIComponent(id)}`, kind: "wsd", accessLevel: "规则原型 · rule prototype", limitations: `WSD评分原型，非确诊或发病概率；pH 8.4–8.5源区间交叉，仍待专家校准，不自动修订原规则。本资料保留原规则 ${originalIds}，须按各自条件分别解释。` });
      }
    }
  }
  const tilapia = record(input.tilapia);
  for (const group of ["rules", "triggers", "parameters", "evidence", "sources"] as const) {
    for (const value of list(tilapia[group])) {
      const item = record(value);
      const id = string(item.id);
      if (!id) continue;
      const original = record(item.original);
      const cells = Object.values(record(original.cells)).filter((cell) => cell !== "").join(" | ");
      const refs = list(item.sourceRefs).map((ref) => { const r = record(ref); return `${r.sheet} row ${r.row}`; }).join("; ");
      const title = string(item.name) || string(item.title) || string(item.statement) || cells.split(" | ")[3] || id;
      const fallback = `/data/knowledge/tilapia-streptococcosis.json#${encodeURIComponent(id)}`;
      const limits = [string(item.limitations), group === "rules" || group === "triggers" || group === "parameters" ? "草案禁用/候选参数，未专家签署、未校准、未现场或预测性能验证；不输出发病概率或确诊。" : "保留原来源访问层级；事实适用条件见工作簿，未读取未提供的全文。"].filter(Boolean).join(" ");
      const normalized = Object.fromEntries(Object.entries(item).filter(([key]) => key !== "original"));
      sources.push({ id: `tilapia-${group}-${id}`, title: `罗非鱼链球菌病 / tilapia streptococcosis · ${title.slice(0, 180)}`, text: [`${record(tilapia.source).workbookName || "tilapia workbook"} · ${refs}`, JSON.stringify(normalized), cells].join("\n").slice(0, 6000), href: group === "sources" ? doiHref(item.doi) || safeSourceHref(item.url, fallback) : fallback, kind: "tilapia", accessLevel: string(item.accessLevel) || "未签署草案 · unsigned draft", limitations: limits });
    }
  }
  return sources;
}
