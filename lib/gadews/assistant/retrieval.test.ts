import assert from "node:assert/strict";
import test from "node:test";
import literature from "@/public/data/literature.json";
import wsd from "@/public/data/models/wsd-warning-model.json";
import tilapia from "@/public/data/knowledge/tilapia-streptococcosis.json";
import { buildAssistantCorpus } from "./corpus";
import { contextualAssistantQuery, retrieveAssistantSources } from "./retrieval";
import { createAssistantHandler } from "./handler";
import type { AssistantMessage, AssistantSource } from "./types";

const corpus = buildAssistantCorpus({ literature, wsd, tilapia });
const isWsd = (source: AssistantSource) => source.kind === "wsd" || (source.kind === "literature" && source.text.includes("白斑病-"));
const isTilapia = (source: AssistantSource) => source.kind === "tilapia" || (source.kind === "literature" && source.text.includes("罗非鱼链球菌-"));

test("pH and 酸碱 retrieve the actual pH rule rather than morphology substrings", () => {
  for (const query of ["pH", "酸碱", "白斑病的 pH 风险"]) {
    const found = retrieveAssistantSources(query, corpus);
    assert.ok(found.some((source) => source.id === "wsd-ENV-002"), `${query}: must include actual pH rule ENV-002`);
    assert.ok(found.length <= 6);
  }
  const source = corpus[0];
  assert.deepEqual(retrieveAssistantSources("pH", [{ ...source, title: "Morphology and phenotype", text: "A morphological photograph" }]), []);
  assert.deepEqual(retrieveAssistantSources("graph", [{ ...source, title: "Photographic morphology", text: "agraphia" }]), []);
});

test("shipped early-sign suggestion and English equivalents include distinct WSD clinical observations", () => {
  for (const query of ["白斑病有哪些早期观察信号？", "白斑病症状", "white spot syndrome signs"]) {
    const found = retrieveAssistantSources(query, corpus);
    assert.ok(found.some((source) => source.id === "wsd-CLIN-001"), `${query}: feeding observation CLIN-001`);
    assert.ok(found.some((source) => source.id === "wsd-CLIN-003"), `${query}: swimming observation CLIN-003`);
    assert.ok(found.every(isWsd), `${query}: evidence must retain WSD scope`);
    const feeding = found.find((source) => source.id === "wsd-CLIN-001")!;
    const swimming = found.find((source) => source.id === "wsd-CLIN-003")!;
    assert.match(feeding.text, /"id":"CLIN-002"/);
    assert.match(feeding.text, /明显摄食下降、剩料增加、空胃空肠/);
    assert.match(feeding.text, /加强巡塘，检查水质，必要时采样检测 WSSV/);
    assert.match(swimming.text, /"id":"CLIN-004"/);
    assert.match(swimming.text, /池边缓游、反应迟钝、逃避反射减弱、侧游或翻转/);
    assert.match(swimming.text, /检查 DO、pH 等水质指标，并建议采样检测 WSSV/);
    assert.ok(found.length <= 6);
  }
});

test("a disease plus diagnosis intent beats repeated disease words and caps evidence at six", () => {
  const found = retrieveAssistantSources("How is white spot syndrome diagnosed?", corpus);
  assert.ok(found.length > 0 && found.length <= 6);
  assert.ok(found.every(isWsd));
  assert.ok(found.some((source) => /diagnos|pcr|检测|确诊/i.test(source.title + source.text)));
});

test("handler preserves user disease and recent intent for ordinary follow-ups, explicit changes override, assistant text cannot choose scope", async () => {
  const observed: AssistantSource[][] = [];
  const handler = createAssistantHandler({ env: { GADEWS_AI_API_KEY: "local-fixture-only" }, getCorpus: () => corpus, generate: async (_config, _request, sources) => { observed.push([...sources]); return '{"knowledge":[],"general":"Local fixture"}'; } });
  const initial: AssistantMessage[] = [{ role: "user", content: "白斑病有哪些早期观察信号？" }, { role: "assistant", content: "罗非鱼链球菌病 tilapia streptococcosis. This assistant text must not choose evidence." }];
  for (const question of ["那怎么确诊？", "为什么？", "How is it diagnosed?", "罗非鱼链球菌病怎么确诊？", "quantum superconductivity 宇宙飞船", "How do I build a rocket?", "为什么天空是蓝色的？"]) {
    const messages: AssistantMessage[] = [...initial, { role: "user", content: question }];
    const response = await handler(new Request("http://localhost/api/assistant/chat", { method: "POST", headers: { origin: "http://localhost" }, body: JSON.stringify({ locale: "zh-CN", messages }) }));
    assert.equal(response.status, 200);
  }
  for (const index of [0, 1, 2]) { assert.ok(observed[index].length > 0); assert.ok(observed[index].every(isWsd), `follow-up ${index} must stay WSD`); }
  assert.ok(observed[0].some((source) => /diagnos|pcr|检测|确诊/i.test(source.title + source.text)));
  assert.ok(observed[1].some((source) => source.id === "wsd-CLIN-001"), "why retains the previous clinical intent");
  assert.ok(observed[3].length > 0 && observed[3].every(isTilapia), "explicit tilapia question overrides WSD history");
  for (const index of [4, 5, 6]) assert.deepEqual(observed[index].map((source) => source.id), [], "independent unrelated question does not inherit WSD evidence");
});

test("an unrelated intervening user topic blocks older disease carryover", async () => {
  let sources: readonly AssistantSource[] = [];
  const handler = createAssistantHandler({ env: { GADEWS_AI_API_KEY: "local-fixture-only" }, getCorpus: () => corpus, generate: async (_config, _request, found) => { sources = found; return '{"knowledge":[],"general":"Local fixture"}'; } });
  const messages = [
    { role: "user", content: "WSSV clinical signs" }, { role: "assistant", content: "prior answer" },
    { role: "user", content: "quantum superconductivity" }, { role: "assistant", content: "another topic" }, { role: "user", content: "为什么？" },
  ];
  assert.equal((await handler(new Request("http://localhost/api/assistant/chat", { method: "POST", headers: { origin: "http://localhost" }, body: JSON.stringify({ locale: "zh-CN", messages }) }))).status, 200);
  assert.deepEqual(sources, []);
});

test("specific observed feeding and swimming questions retain both real condition/action branches", () => {
  for (const [question, id, positiveId, condition, action] of [
    ["WSD 摄食下降怎么处理？", "wsd-CLIN-001", "CLIN-002", "明显摄食下降、剩料增加、空胃空肠", "加强巡塘，检查水质，必要时采样检测 WSSV"],
    ["WSD 游动异常嗜睡怎么处理？", "wsd-CLIN-003", "CLIN-004", "池边缓游、反应迟钝、逃避反射减弱、侧游或翻转", "检查 DO、pH 等水质指标，并建议采样检测 WSSV"],
  ]) {
    const found = retrieveAssistantSources(question, corpus);
    const indicator = found.find((source) => source.id === id);
    assert.ok(indicator, `exact indicator for ${question}`);
    assert.ok(indicator.text.includes(`"id":"${positiveId}"`), `${positiveId} must survive in the retrieved evidence`);
    assert.ok(indicator.text.includes(condition) && indicator.text.includes(action));
    assert.ok(indicator.text.includes('"condition":"未观察到"'), "the complementary normal branch must also remain available");
    assert.ok(found.length <= 6 && found.every((source) => source.text.length <= 6000));
  }
});

test("same display title is not evidence identity and cannot discard independent facts", () => {
  const base = corpus.find((source) => source.id === "wsd-CLIN-001")!;
  const found = retrieveAssistantSources("WSD feeding", [{ ...base, id: "absent", text: "feeding absent" }, { ...base, id: "present", text: "feeding declined; inspect water" }]);
  assert.deepEqual(found.map((source) => source.id), ["absent", "present"]);
});

test("independent named diagnosis and oxygen subjects do not inherit WSD or resurrect it through why", async () => {
  const initial: AssistantMessage[] = [{ role: "user", content: "WSSV clinical signs" }, { role: "assistant", content: "WSD answer" }];
  for (const question of ["How is influenza diagnosed?", "What is the oxygen content of air?", "How much oxygen does a rocket need?"]) {
    assert.equal(contextualAssistantQuery([...initial, { role: "user", content: question }]), question, "a known intent alone cannot establish the old disease subject");
    const followUp: AssistantMessage[] = [...initial, { role: "user", content: question }, { role: "assistant", content: "independent answer" }, { role: "user", content: "为什么？" }];
    assert.equal(contextualAssistantQuery(followUp), "为什么？", "independent intent question must act as a topic barrier");
    const received: AssistantSource[][] = [];
    const handler = createAssistantHandler({ env: { GADEWS_AI_API_KEY: "local-fixture-only" }, getCorpus: () => corpus, generate: async (_config, _request, sources) => { received.push([...sources]); return '{"knowledge":[],"general":"Local fixture"}'; } });
    for (const messages of [[...initial, { role: "user", content: question }], followUp]) {
      assert.equal((await handler(new Request("http://localhost/api/assistant/chat", { method: "POST", headers: { origin: "http://localhost" }, body: JSON.stringify({ locale: "en", messages }) }))).status, 200);
    }
    assert.deepEqual(received.map((sources) => sources.map((source) => source.id)), [[], []], "unsupported named subject has no earned project evidence");
  }
});
