import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { installDom } from "@/lib/gadews/test-support/dom";
installDom();

test("locale switching preserves independent drafts, literal numeric text, actual results and disabled outdated export", async () => {
  const React = await import("react"); const { render, screen, within, waitFor, cleanup } = await import("@testing-library/react"); const { default: userEvent } = await import("@testing-library/user-event");
  const { LocaleProvider, useLocale } = await import("@/components/gadews/locale-provider"); const { WarningWorkbench } = await import("./warning-workbench");
  function Switch() { const { locale, setLocale } = useLocale(); return <button onClick={() => setLocale(locale === "en" ? "zh-CN" : "en")}>Switch language</button>; }
  const wsd = JSON.parse(await readFile("public/data/models/wsd-warning-model.json", "utf8")); const knowledge = JSON.parse(await readFile("public/data/knowledge/tilapia-streptococcosis.json", "utf8")); const original = globalThis.fetch;
  globalThis.fetch = async (url) => Response.json(String(url).includes("tilapia") ? knowledge : wsd);
  const downloads: Blob[] = []; const create = URL.createObjectURL; const revoke = URL.revokeObjectURL; const click = window.HTMLAnchorElement.prototype.click;
  URL.createObjectURL = (blob) => { downloads.push(blob as Blob); return "blob:locale"; }; URL.revokeObjectURL = () => {}; window.HTMLAnchorElement.prototype.click = () => {};
  try {
    render(<LocaleProvider initialLocale="en"><Switch /><WarningWorkbench /></LocaleProvider>); const user = userEvent.setup();
    await waitFor(() => assert.equal((screen.getByRole("button", { name: "Evaluate WSD" }) as HTMLButtonElement).disabled, false));
    await user.click(screen.getByRole("button", { name: "Load WSD example" })); await user.click(screen.getByRole("button", { name: "Evaluate WSD" })); await user.click(screen.getByRole("button", { name: "Download JSON" }));
    const first = JSON.parse(await downloads.at(-1)!.text());
    await user.click(screen.getByRole("button", { name: "Switch language" }));
    assert.ok(screen.getByRole("button", { name: "评估 WSD" })); assert.ok(screen.getByText("质量与规则问题", { exact: false }));
    await user.click(screen.getByRole("button", { name: "下载 JSON" })); assert.deepEqual(JSON.parse(await downloads.at(-1)!.text()), first);
    await user.clear(screen.getByLabelText("塘口 pH")); await user.type(screen.getByLabelText("塘口 pH"), "7.02");
    assert.equal((screen.getByRole("button", { name: "下载 JSON" }) as HTMLButtonElement).disabled, true);
    await user.click(screen.getByRole("button", { name: "罗非鱼链球菌病" })); const tilapia = within(screen.getByRole("region", { name: "罗非鱼工作区" }));
    await user.type(tilapia.getByLabelText("批次 ID"), "kept-batch");
    await waitFor(() => assert.equal((tilapia.getByRole("button", { name: "评估罗非鱼" }) as HTMLButtonElement).disabled, false));
    await user.click(tilapia.getByRole("button", { name: "评估罗非鱼" })); await user.click(tilapia.getByRole("button", { name: "下载 JSON" })); const tilapiaBefore = JSON.parse(await downloads.at(-1)!.text());
    await user.click(screen.getByRole("button", { name: "Switch language" }));
    assert.ok(tilapia.getByText("Draft rules disabled")); await user.click(tilapia.getByRole("button", { name: "Download JSON" })); assert.deepEqual(JSON.parse(await downloads.at(-1)!.text()), tilapiaBefore);
    assert.equal((within(screen.getByRole("region", { name: "Tilapia workspace" })).getByLabelText("Batch ID") as HTMLInputElement).value, "kept-batch");
    await user.click(screen.getByRole("button", { name: "WSD / white spot disease" }));
    assert.equal((screen.getByLabelText("Pond pH") as HTMLInputElement).value, "7.02"); assert.ok(screen.getByText(/This result is outdated/)); assert.equal((screen.getByRole("button", { name: "Download JSON" }) as HTMLButtonElement).disabled, true);
  } finally { globalThis.fetch = original; URL.createObjectURL = create; URL.revokeObjectURL = revoke; window.HTMLAnchorElement.prototype.click = click; cleanup(); }
});

test("Chinese draft assessment explains disabled rules and preserves the 13 supported / 9 unsupported register", async () => {
  const React = await import("react"); const { render, screen, waitFor, cleanup } = await import("@testing-library/react"); const { default: userEvent } = await import("@testing-library/user-event"); const { LocaleProvider } = await import("@/components/gadews/locale-provider"); const { TilapiaRiskModel } = await import("./tilapia-risk-model");
  const original = globalThis.fetch; const knowledge = JSON.parse(await readFile("public/data/knowledge/tilapia-streptococcosis.json", "utf8")); globalThis.fetch = async () => Response.json(knowledge);
  try {
    render(<LocaleProvider initialLocale="zh-CN"><TilapiaRiskModel /></LocaleProvider>); const user = userEvent.setup();
    await waitFor(() => assert.equal((screen.getByRole("button", { name: "评估罗非鱼" }) as HTMLButtonElement).disabled, false));
    assert.ok(screen.getByText(/13 项支持.*9 项未支持/)); await user.click(screen.getByRole("button", { name: "评估罗非鱼" }));
    assert.ok(screen.getByText("草案规则已禁用")); assert.equal(document.querySelectorAll('[data-rule-id]').length, 22); assert.ok(screen.getAllByText(/草案仅在显式模拟中执行/).length > 0);
    assert.ok(screen.getByText(/原始工作簿行、证据与来源/));
  } finally { globalThis.fetch = original; cleanup(); }
});

test("all four demo scenario snapshots and manual state survive locale changes without replacing canonical evidence", async () => {
  const React = await import("react"); const { render, screen, within, waitFor, cleanup } = await import("@testing-library/react"); const { default: userEvent } = await import("@testing-library/user-event");
  const { LocaleProvider, useLocale } = await import("@/components/gadews/locale-provider"); const { WarningWorkbench } = await import("./warning-workbench");
  function Switch() { const { locale, setLocale } = useLocale(); return <button onClick={() => setLocale(locale === "en" ? "zh-CN" : "en")}>Switch language</button>; }
  const config = JSON.parse(await readFile("public/data/models/wsd-warning-model.json", "utf8")); const original = globalThis.fetch; globalThis.fetch = async () => Response.json(config);
  const downloads: Blob[] = []; const create = URL.createObjectURL; const revoke = URL.revokeObjectURL; const click = window.HTMLAnchorElement.prototype.click;
  URL.createObjectURL = (blob) => { downloads.push(blob as Blob); return "blob:scenario-locale"; }; URL.revokeObjectURL = () => {}; window.HTMLAnchorElement.prototype.click = () => {};
  try {
    render(<LocaleProvider initialLocale="en"><Switch /><WarningWorkbench /></LocaleProvider>); const user = userEvent.setup();
    await user.type(screen.getByLabelText("Pond pH"), "7.02"); await user.click(screen.getByRole("button", { name: "Run monitoring demo" })); await screen.findByText("29 °C");
    const demo = within(screen.getByRole("region", { name: "WSD demo workspace" }));
    for (const [id, temperature, ph] of [["demo-usable", "29", "8.2"], ["demo-partial", "29", ""], ["demo-stale", "", ""], ["demo-unverified", "", ""]] as const) {
      await user.selectOptions(screen.getByLabelText("Monitoring feed"), id); await waitFor(() => assert.equal((screen.getByRole("button", { name: "Refresh observation" }) as HTMLButtonElement).disabled, false));
      await user.click(demo.getByRole("button", { name: "Load demo observation into WSD" })); await user.click(demo.getByRole("button", { name: "Evaluate WSD" })); await user.click(demo.getByRole("button", { name: "Download JSON" })); const before = JSON.parse(await downloads.at(-1)!.text());
      await user.click(screen.getByRole("button", { name: "Switch language" }));
      const translated = within(screen.getByRole("region", { name: "WSD 演示工作区" }));
      assert.equal((translated.getByLabelText("塘口水温 (°C)") as HTMLInputElement).value, temperature); assert.equal((translated.getByLabelText("塘口 pH") as HTMLInputElement).value, ph);
      assert.ok(translated.getAllByText("示例数据").length > 0); await user.click(translated.getByRole("button", { name: "下载 JSON" }));
      assert.deepEqual(JSON.parse(await downloads.at(-1)!.text()), before); assert.equal(before.result.contextSnapshot.inputProvenance.demoSession.scenarioId, id);
      await user.click(screen.getByRole("button", { name: "Switch language" }));
    }
    await user.clear(demo.getByLabelText("Pond pH")); await user.type(demo.getByLabelText("Pond pH"), "7.02"); await user.click(screen.getByRole("button", { name: "Switch language" }));
    assert.equal((within(screen.getByRole("region", { name: "WSD 演示工作区" })).getByRole("button", { name: "下载 JSON" }) as HTMLButtonElement).disabled, true);
    await user.click(screen.getByRole("button", { name: "已发布观测" })); assert.equal((within(screen.getByRole("region", { name: "WSD 工作区" })).getByLabelText("塘口 pH") as HTMLInputElement).value, "7.02");
  } finally { globalThis.fetch = original; URL.createObjectURL = create; URL.revokeObjectURL = revoke; window.HTMLAnchorElement.prototype.click = click; cleanup(); }
});

test("locale display keeps blank, invalid, stale and conflicting quality codes and scientific result fields unchanged", async () => {
  const React = await import("react"); const { render, screen, cleanup } = await import("@testing-library/react"); const { default: userEvent } = await import("@testing-library/user-event");
  const { LocaleProvider, useLocale } = await import("@/components/gadews/locale-provider"); const { AssessmentResultPanel } = await import("./assessment-result-panel"); const { assessWsd } = await import("@/lib/gadews/wsd-warning-model");
  function Switch() { const { locale, setLocale } = useLocale(); return <button onClick={() => setLocale(locale === "en" ? "zh-CN" : "en")}>Switch language</button>; }
  const config = JSON.parse(await readFile("public/data/models/wsd-warning-model.json", "utf8"));
  const cases = [assessWsd({}, config), assessWsd({ ph: "oops" } as unknown as Parameters<typeof assessWsd>[0], config), assessWsd({ ph: 8.5 }, config), assessWsd({ ph: 8.2 }, config, { now: "2026-10-29T12:00:00Z", observations: { ph: { observedAt: "2026-10-28T12:00:00Z", maxAgeHours: 1, scope: "pond" } } })];
  assert.ok(cases.some((r) => r.quality.issues.some((i) => i.code === "invalid"))); assert.ok(cases.some((r) => r.quality.issues.some((i) => i.code === "stale"))); assert.ok(cases.some((r) => r.quality.issues.some((i) => i.code === "rule_conflict")));
  for (const result of cases) {
    const snapshot = structuredClone(result);
    try {
      render(<LocaleProvider initialLocale="en"><Switch /><AssessmentResultPanel result={result} /></LocaleProvider>); const user = userEvent.setup(); await user.click(screen.getByRole("button", { name: "Switch language" }));
      assert.ok(screen.getByText("质量与规则问题", { exact: false })); assert.ok(screen.getAllByText(/缺失|非法|过期|冲突/).length > 0); assert.deepEqual(result, snapshot);
      assert.equal(document.querySelector('[data-assessment-status]')?.getAttribute("data-assessment-status"), result.status);
    } finally { cleanup(); }
  }
});

test("tilapia explicit draft simulation keeps events, source traces, numeric draft and unavailable prediction through translation", async () => {
  const React = await import("react"); const { render, screen, waitFor, cleanup } = await import("@testing-library/react"); const { default: userEvent } = await import("@testing-library/user-event"); const { LocaleProvider, useLocale } = await import("@/components/gadews/locale-provider"); const { TilapiaRiskModel } = await import("./tilapia-risk-model");
  function Switch() { const { locale, setLocale } = useLocale(); return <button onClick={() => setLocale(locale === "en" ? "zh-CN" : "en")}>Switch language</button>; }
  const knowledge = JSON.parse(await readFile("public/data/knowledge/tilapia-streptococcosis.json", "utf8")); const original = globalThis.fetch; globalThis.fetch = async () => Response.json(knowledge);
  const downloads: Blob[] = []; const create = URL.createObjectURL; const revoke = URL.revokeObjectURL; const click = window.HTMLAnchorElement.prototype.click;
  URL.createObjectURL = (blob) => { downloads.push(blob as Blob); return "blob:tilapia-locale"; }; URL.revokeObjectURL = () => {}; window.HTMLAnchorElement.prototype.click = () => {};
  try {
    render(<LocaleProvider initialLocale="en"><Switch /><TilapiaRiskModel /></LocaleProvider>); const user = userEvent.setup();
    await waitFor(() => assert.equal((screen.getByRole("button", { name: "Evaluate tilapia" }) as HTMLButtonElement).disabled, false)); await user.click(screen.getByRole("button", { name: "Load tilapia draft example" })); await user.click(screen.getByRole("button", { name: "Evaluate tilapia" })); await user.click(screen.getByRole("button", { name: "Download JSON" })); const before = JSON.parse(await downloads.at(-1)!.text());
    assert.equal(before.result.status, "draft_preview"); assert.equal(before.result.prediction.probability, null); assert.ok(before.result.events.length > 0);
    const eventTypes = [...document.querySelectorAll('[data-event-type]')].map((el) => el.getAttribute("data-event-type")); const ruleIds = [...document.querySelectorAll('[data-rule-id]')].map((el) => el.getAttribute("data-rule-id"));
    await user.click(screen.getByRole("button", { name: "Switch language" })); assert.ok(screen.getByText("草案预览")); assert.ok(screen.getByText("独立事件"));
    assert.deepEqual([...document.querySelectorAll('[data-event-type]')].map((el) => el.getAttribute("data-event-type")), eventTypes); assert.deepEqual([...document.querySelectorAll('[data-rule-id]')].map((el) => el.getAttribute("data-rule-id")), ruleIds);
    await user.click(screen.getByRole("button", { name: "下载 JSON" })); assert.deepEqual(JSON.parse(await downloads.at(-1)!.text()), before);
    await user.clear(screen.getByLabelText("溶解氧（mg/L）")); await user.type(screen.getByLabelText("溶解氧（mg/L）"), "0.05"); await user.click(screen.getByRole("button", { name: "Switch language" }));
    assert.equal((screen.getByLabelText("Dissolved oxygen (mg/L)") as HTMLInputElement).value, "0.05"); assert.equal((screen.getByRole("button", { name: "Download JSON" }) as HTMLButtonElement).disabled, true); assert.ok(screen.getByText("Draft simulation"));
  } finally { globalThis.fetch = original; URL.createObjectURL = create; URL.revokeObjectURL = revoke; window.HTMLAnchorElement.prototype.click = click; cleanup(); }
});

test("unregistered source labels remain verbatim even when they match Object prototype names", async () => {
  const { workbenchText } = await import("@/lib/gadews/i18n/workbench-copy");
  for (const label of ["constructor", "__proto__", "toString", "Unregistered observation source"]) {
    assert.equal(workbenchText("zh-CN", label), label); assert.equal(workbenchText("en", label), label);
  }
});

test("Chinese real tilapia draft fixture translates the record label while retaining professional record identity", async () => {
  const React = await import("react"); const { render, screen, cleanup } = await import("@testing-library/react");
  const { LocaleProvider } = await import("@/components/gadews/locale-provider"); const { TilapiaTracePanel } = await import("./tilapia-trace-panel");
  const { assessTilapia, createTilapiaDraftExamplePacket } = await import("@/lib/gadews/tilapia-assessment");
  const knowledge = JSON.parse(await readFile("public/data/knowledge/tilapia-streptococcosis.json", "utf8")); const packet = createTilapiaDraftExamplePacket(); const result = assessTilapia(packet.input, knowledge, packet.context); const original = structuredClone(result);
  assert.ok(result.events.some((event) => event.recordId === "fixture-confirmation"));
  try {
    render(<LocaleProvider initialLocale="zh-CN"><TilapiaTracePanel result={result} /></LocaleProvider>);
    assert.ok(screen.getByText(/记录: fixture-confirmation/)); assert.equal(screen.queryByText(/Record: fixture-confirmation/), null); assert.deepEqual(result, original);
  } finally { cleanup(); }
});

test("Chinese generated scope explanations translate all five canonical scopes without changing actual engine issues", async () => {
  const { generatedText, qualityPresentation } = await import("@/lib/gadews/i18n/workbench-evidence"); const { assessWsd } = await import("@/lib/gadews/wsd-warning-model");
  const config = JSON.parse(await readFile("public/data/models/wsd-warning-model.json", "utf8"));
  const cases = [
    ["ph", 8.2, "pond", "塘口"], ["pcrQpcrResult", "positive", "animal", "养殖动物"], ["environmentalSampleResult", "positive", "environment", "环境"], ["liveFeedResult", "positive", "feed", "饵料"], ["regionalDiseaseBackground", "QAAD/WAHIS区域背景", "regional", "区域"],
  ] as const;
  for (const [field, value, code, label] of cases) {
    const result = assessWsd({ [field]: value }, config, { observations: { [field]: { scope: "mismatched-scope" } } }); const original = structuredClone(result); const issue = result.quality.issues.find((item) => item.field === field && item.code === "scope_mismatch"); assert.ok(issue);
    assert.equal(issue.message, `Observation scope must be ${code}`); assert.equal(generatedText("zh-CN", issue.message), `观测范围须为${label}。`); assert.equal(qualityPresentation("zh-CN", issue), `观测范围须为${label}。`); assert.equal(generatedText("en", issue.message), issue.message); assert.deepEqual(result, original);
  }
});
