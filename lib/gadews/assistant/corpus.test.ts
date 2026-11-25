import assert from "node:assert/strict";
import test from "node:test";
import literature from "@/public/data/literature.json";
import wsd from "@/public/data/models/wsd-warning-model.json";
import tilapia from "@/public/data/knowledge/tilapia-streptococcosis.json";

async function feature() {
  const corpus = await import("./corpus").catch(() => null);
  const retrieval = await import("./retrieval").catch(() => null);
  assert.ok(corpus && retrieval, "corpus builder and bilingual retrieval must exist");
  return { ...corpus, ...retrieval };
}

test("real corpus includes all 165 abstracts and retains stable identities, safe exact links and provenance", async () => {
  const { buildAssistantCorpus } = await feature();
  const input = { literature, wsd, tilapia };
  const sources = buildAssistantCorpus(input);
  assert.equal(sources.filter((s) => s.kind === "literature").length, 165);
  assert.equal(new Set(sources.map((s) => s.id)).size, sources.length);
  assert.deepEqual(sources, buildAssistantCorpus(input));
  assert.ok(sources.every((s) => s.text.length <= 6000 && s.title && s.href));
  const first = sources.find((s) => s.kind === "literature")!;
  assert.match(first.accessLevel, /摘要|abstract/i);
  assert.match(first.limitations, /全文/);
  assert.match(first.href, /2023|doi/);
  const ph = sources.find((s) => s.id === "wsd-ENV-002")!;
  assert.match(ph.text, /8.4–8.5/);
  assert.match(ph.limitations, /原型/);
  const parameter = sources.find((s) => s.id === "tilapia-parameters-P01")!;
  assert.match(parameter.text, /30|24/);
  assert.match(parameter.text, /14_参数与验证.*2/);
  assert.match(parameter.limitations, /未签署|未校准/);
  assert.ok(sources.some((s) => s.id === "tilapia-evidence-E01"));
});

test("bilingual aliases retrieve disease evidence, cap at six and return no unrelated evidence", async () => {
  const { buildAssistantCorpus, retrieveAssistantSources } = await feature();
  const corpus = buildAssistantCorpus({ literature, wsd, tilapia });
  for (const q of ["白斑病", "WSSV", "white spot syndrome", "罗非鱼链球菌病", "tilapia streptococcosis"]) {
    const found = retrieveAssistantSources(q, corpus);
    assert.ok(found.length > 0 && found.length <= 6, q);
  }
  assert.deepEqual(retrieveAssistantSources("quantum superconductivity 宇宙飞船", corpus), []);
  assert.deepEqual(retrieveAssistantSources("", corpus), []);
  const base = { ...corpus[0], text: "salinity" };
  const found = retrieveAssistantSources("salinity", [{ ...base, id: "body", title: "Other" }, { ...base, id: "title", title: "Salinity" }]);
  assert.equal(found[0].id, "title");
});

test("unsafe imported DOI and URL cannot become source hyperlinks", async () => {
  const { buildAssistantCorpus } = await feature();
  const sources = buildAssistantCorpus({ literature: [{ Title: "Unsafe", Abstract: "Test", DOI: "javascript:alert(1)", file_name: "../../unsafe.pdf" }], wsd: {}, tilapia: { sources: [{ id: "bad", title: "Bad", url: "javascript:alert(1)" }] } });
  assert.ok(sources.every((s) => s.href.startsWith("/data/") || /^https?:\/\//.test(s.href)));
  assert.ok(sources.every((s) => !s.href.includes("..")));
});

test("grouped WSD indicators preserve every original branch and exact source IDs within bounded documents", async () => {
  const { buildAssistantCorpus } = await feature();
  const sources = buildAssistantCorpus({ literature: [], wsd, tilapia: {} }).filter((source) => source.kind === "wsd");
  for (const ruleModule of Object.values(wsd.modules)) for (const rule of ruleModule.rules) {
    assert.ok(sources.some((source) => source.text.includes(`"id":"${rule.id}"`)), `original WSD branch ${rule.id} must survive`);
  }
  const feeding = sources.find((source) => source.id === "wsd-CLIN-001")!;
  assert.ok(feeding.text.includes('"id":"CLIN-001"') && feeding.text.includes('"id":"CLIN-002"'), "one feeding document must carry both original condition branches");
  assert.ok(sources.every((source) => source.text.length <= 6000));
});

test("oversized single WSD branch fails explicitly instead of silently losing condition text", async () => {
  const { buildAssistantCorpus } = await feature();
  assert.throws(() => buildAssistantCorpus({ literature: [], tilapia: {}, wsd: { modules: { clinical: { rules: [{ id: "CLIN-LONG", name: "Oversized", condition: "x".repeat(6001) }] } } } }), /WSD.*6000/);
});
