import type { AssistantMessage, AssistantSource } from "./types";

type Domain = "wsd" | "tilapia";
interface Family { key: string; query: RegExp; document: RegExp; domain?: Domain }
// Each family contributes once. Alias count must not outweigh the requested subject.
const families: Family[] = [
  { key: "wsd", domain: "wsd", query: /白斑病|白斑综合征|\bwssv\b|\bwsd\b|\bwhite\s+spot(?:\s+(?:syndrome|disease))?\b/i, document: /白斑病|白斑综合征|\bwssv\b|\bwsd\b|\bwhite\s+spot\b/i },
  { key: "tilapia", domain: "tilapia", query: /罗非鱼|链球菌|\btilapia\b|\bstreptococc[a-z]*\b|\bsag\b|\bsin\b/i, document: /罗非鱼|链球菌|\btilapia\b|\bstreptococc[a-z]*\b|\bsag\b|\bsin\b/i },
  { key: "temperature", query: /水温|温度|\btemperature\b|\bthermal\b/i, document: /水温|温度|\btemperature\b|\bthermal\b/i },
  { key: "oxygen", query: /溶氧|低氧|\boxygen\b|\bhypoxia\b/i, document: /溶氧|低氧|\boxygen\b|\bhypoxi[a-z]*\b/i },
  { key: "salinity", query: /盐度|\bsalinity\b/i, document: /盐度|\bsalinity\b/i },
  { key: "diagnosis", query: /诊断|确诊|\bdiagnos[a-z]*\b|\bq?pcr\b/i, document: /诊断|确诊|检测|组织病理|\bdiagnos[a-z]*\b|\bq?pcr\b|\bdetection\b|\bish\b/i },
  { key: "clinical", query: /早期(?:观察)?信号|观察信号|症状|临床(?:表现|体征)?|\b(?:early\s+)?(?:clinical\s+)?(?:signs?|symptoms?)\b/i, document: /摄食|厌食|食欲|游动|嗜睡|反应迟钝|池边|体色|红体|甲壳|死亡|临床表现|临床症状|\b(?:clinical\s+)?signs?\b|\bsymptoms?\b|\bletharg[a-z]*\b|\banorexi[a-z]*\b|\bfeeding\b/i },
  { key: "warning", query: /预警(?:系统)?|\bearly\s+warning\b/i, document: /预警|\bearly\s+warning\b/i },
  { key: "ph", query: /酸碱|\bph\b/i, document: /酸碱|\bph\b/i },
];
const ignored = new Set(["what", "when", "where", "which", "with", "about", "does", "please", "could", "would", "tell", "know", "the", "and", "for", "are", "how", "can", "from", "that", "this", "why", "then", "also", "explain", "its", "their", "they", "there", "these", "those", "more", "other", "should", "有什么", "是什么", "为什么", "如何", "怎么", "哪些", "请问", "介绍"]);
function matchedFamilies(query: string) { return families.filter((family) => family.query.test(query)); }
function domains(query: string): Domain[] { return matchedFamilies(query).flatMap((family) => family.domain ? [family.domain] : []); }
function genericTerms(query: string): string[] {
  let text = query.toLowerCase();
  for (const family of families) text = text.replace(new RegExp(family.query.source, "gi"), " ");
  text = text.replace(/(?:为什么|为何|有什么|是什么|有哪些|请问|如何|怎么|怎样|那么|那个|这个|还有|然后|早期|观察|关系|介绍|一下|可以|能否|它们|这些|那些|的|呢|吗|那|这|它|有|与|和)/g, " ");
  const tokens = new Set<string>();
  for (const term of text.match(/[a-z][a-z0-9-]{2,}|[\u4e00-\u9fff]{2,}/g) || []) {
    if (ignored.has(term)) continue;
    if (/^[\u4e00-\u9fff]+$/.test(term)) {
      for (let index = 0; index < term.length - 1; index++) if (!ignored.has(term.slice(index, index + 2))) tokens.add(term.slice(index, index + 2));
    } else tokens.add(term);
  }
  return [...tokens];
}
function tokenIn(text: string, token: string): boolean {
  if (/[\u4e00-\u9fff]/.test(token)) return text.includes(token);
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9])`, "i").test(text);
}
function sourceDomain(source: AssistantSource): Domain[] {
  if (source.kind === "wsd" || source.kind === "tilapia") return [source.kind];
  // Catalogue category is a more precise domain cue than a passing abstract comparison.
  if (source.text.includes("白斑病-")) return ["wsd"];
  if (source.text.includes("罗非鱼链球菌-")) return ["tilapia"];
  return families.filter((family) => family.domain && family.document.test(source.title + "\n" + source.text)).map((family) => family.domain!);
}
function isFollowUp(query: string): boolean {
  const cue = /^(?:那|这|它|该|其|为什么|为何|然后|还有|怎么|如何|能否|可以)|^(?:why|how|what about|and|then|does (?:it|that)|can (?:it|that)|what (?:does|is|are) (?:it|that|this)|is (?:it|that))\b/i.test(query.trim());
  // An intent (diagnosis/oxygen/etc.) does not identify its subject. Any remaining
  // independent words conservatively start a new topic, even if a pronoun is present.
  return cue && genericTerms(query).length === 0;
}
/** Infer only a bounded recent USER topic. Assistant claims never establish retrieval scope. */
export function contextualAssistantQuery(messages: readonly AssistantMessage[]): string {
  const users = messages.filter((message) => message.role === "user").slice(-6);
  const current = users.at(-1)?.content || "";
  if (domains(current).length || !isFollowUp(current)) return current;
  let intent = matchedFamilies(current).some((family) => !family.domain) ? current : undefined;
  for (const previous of users.slice(0, -1).reverse()) {
    const scope = domains(previous.content);
    if (scope.length) return `${scope.map((domain) => domain === "wsd" ? "WSD" : "tilapia").join(" ")}\n${intent ?? previous.content}\n${current}`;
    // A separate independent topic ends the old disease context.
    if (!isFollowUp(previous.content)) break;
    if (!intent && matchedFamilies(previous.content).some((family) => !family.domain)) intent = previous.content;
  }
  return current;
}

export function retrieveAssistantSources(query: string, corpus: readonly AssistantSource[], limit = 6): AssistantSource[] {
  const boundedQuery = query.slice(0, 6000);
  const wanted = matchedFamilies(boundedQuery);
  const scope = wanted.flatMap((family) => family.domain ? [family.domain] : []);
  const topics = wanted.filter((family) => !family.domain);
  const tokens = genericTerms(boundedQuery);
  if (!wanted.length && !tokens.length) return [];
  const candidates = corpus.map((source, index) => {
    const sourceScope = sourceDomain(source);
    if (scope.length && sourceScope.length && !sourceScope.some((domain) => scope.includes(domain))) return { source, score: 0, index };
    // Generic disease labels are excluded from title relevance scoring.
    const title = (source.kind === "literature" ? source.title : source.title.split(" · ").at(-1)!).toLowerCase();
    const text = source.text.toLowerCase();
    const topicScore = topics.reduce((sum, family) => sum + (family.document.test(title) ? 40 : family.document.test(text) ? 10 : 0), 0);
    const lexicalScore = tokens.reduce((sum, token) => sum + (tokenIn(title, token) ? 8 : tokenIn(text, token) ? 2 : 0), 0);
    const domainScore = scope.length && sourceScope.some((domain) => scope.includes(domain)) ? 1 : 0;
    const independentSubjectMatches = scope.length > 0 || !topics.length || tokens.every((token) => tokenIn(title, token) || tokenIn(text, token));
    // A disease alone may retrieve its overview; a specific subject needs a subject hit.
    const score = !independentSubjectMatches || ((topics.length || tokens.length) && !topicScore && !lexicalScore) ? 0 : topicScore + lexicalScore + domainScore;
    return { source, score, index };
  }).filter((item) => item.score > 0).sort((a, b) => b.score - a.score || a.index - b.index);
  const maximum = Math.min(6, Math.max(0, Math.floor(limit)));
  return candidates.slice(0, maximum).map((item) => item.source);
}
