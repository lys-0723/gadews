import assert from "node:assert/strict";
import test from "node:test";
import { installDom } from "@/lib/gadews/test-support/dom";

const dom = installDom();
Object.assign(globalThis, { DocumentFragment: dom.window.DocumentFragment, requestAnimationFrame: (callback: FrameRequestCallback) => setTimeout(() => callback(performance.now()), 16), cancelAnimationFrame: clearTimeout });

test("public source error is translated and retry keeps its actual callback", async () => {
  const React = await import("react");
  const { render, screen, fireEvent, cleanup } = await import("@testing-library/react");
  const { LocaleProvider, useLocale } = await import("@/components/gadews/locale-provider");
  const { PublicSourceStatus } = await import("./public-source-status");
  function Switch() { const { setLocale } = useLocale(); return <button onClick={() => setLocale("en")}>Language</button>; }
  let retries = 0;
  try {
    render(<LocaleProvider initialLocale="zh-CN"><Switch /><PublicSourceStatus title="WOAH WAHIS" state="error" error="Failed to load snapshot (500)" rejectedCount={2} retry={() => retries++} /></LocaleProvider>);
    assert.ok(screen.getByText(/静态快照/));
    fireEvent.click(screen.getByRole("button", { name: "重试 WOAH WAHIS" }));
    assert.equal(retries, 1);
    fireEvent.click(screen.getByText("Language"));
    assert.ok(screen.getByText(/Static snapshot/));
    assert.ok(screen.getByRole("button", { name: "Retry WOAH WAHIS" }));
    assert.ok(screen.getByText(/2 invalid records skipped/));
  } finally { cleanup(); }
});

test("map filters retain stable values while accessible labels switch language", async () => {
  const React = await import("react");
  const { render, screen, fireEvent, cleanup } = await import("@testing-library/react");
  const { LocaleProvider, useLocale } = await import("@/components/gadews/locale-provider");
  const { LayerControlPanel } = await import("./layer-control-panel");
  function Example() {
    const { setLocale } = useLocale();
    const [disease, setDisease] = React.useState<import("./woah-wahis-layer").DiseaseFilter>("all");
    const [status, setStatus] = React.useState<import("./qaad-surveillance-layer").QaadStatusFilter>("priority");
    return <><button onClick={() => setLocale("en")}>Language</button><LayerControlPanel layers={{ boundaries:false,waterSystems:false,farmDensity:false,sst:false,chlorophyll:false,rainfall:false,heatmap:false,cases:false,coverage:false,wahis:true,qaad:true }} onToggle={() => {}} diseaseFilter={disease} onDiseaseFilterChange={setDisease} qaadStatusFilter={status} onQaadStatusFilterChange={setStatus} /></>;
  }
  try {
    render(<LocaleProvider initialLocale="zh-CN"><Example /></LocaleProvider>);
    assert.ok(screen.getByRole("checkbox", { name: "区域监测演示", description: /查找试点周边/ }));
    fireEvent.change(screen.getByRole("combobox", { name: "病种筛选" }), { target:{ value:"WSD" } });
    fireEvent.change(screen.getByRole("combobox", { name: "QAAD 状态筛选" }), { target:{ value:"no_information" } });
    fireEvent.click(screen.getByText("Language"));
    assert.ok(screen.getByRole("checkbox", { name: "Regional monitoring demo", description: /near a sample site/ }));
    assert.equal((screen.getByRole("combobox", { name: "Disease filter" }) as HTMLSelectElement).value, "WSD");
    assert.equal((screen.getByRole("combobox", { name: "QAAD status filter" }) as HTMLSelectElement).value, "no_information");
    assert.ok(screen.getByText(/not outbreak events/));
  } finally { cleanup(); }
});

test("reversed event dates keep the active report results until corrected or reset", async () => {
  const React = await import("react");
  const { render, screen, fireEvent, cleanup } = await import("@testing-library/react");
  const { LocaleProvider } = await import("../locale-provider");
  const { HistoryFilters } = await import("./history-filters");
  const { allHistory } = await import("@/lib/gadews/history-reports");
  function Example() {
    const [scope, setScope] = React.useState(allHistory);
    return <><HistoryFilters scope={scope} countries={[]} years={[]} diseases={[]} onChange={setScope} onReset={() => setScope(allHistory)} />
      <output data-testid="effective">{scope.from}–{scope.to}</output></>;
  }
  try {
    render(<LocaleProvider initialLocale="zh-CN"><Example /></LocaleProvider>);
    const from = screen.getByLabelText("自"), to = screen.getByLabelText("至");
    const change = (el: HTMLElement, value: string) => fireEvent.change(el, {target: {value}});
    change(from, "2016-07-27");
    change(to, "2016-07-26");
    assert.match(screen.getByRole("alert").textContent ?? "", /上一次有效日期/);
    assert.equal(screen.getByTestId("effective").textContent, "2016-07-27–");
    change(to, "2016-07-27");
    assert.equal(screen.queryByRole("alert"), null);
    assert.equal(screen.getByTestId("effective").textContent, "2016-07-27–2016-07-27");
    change(from, "2025-01-01");
    fireEvent.click(screen.getByRole("button", {name: "重置报告筛选"}));
    assert.equal((from as HTMLInputElement).value, "");
    assert.equal((to as HTMLInputElement).value, "");
    assert.equal(screen.getByTestId("effective").textContent, "–");
  } finally { cleanup(); }
});
