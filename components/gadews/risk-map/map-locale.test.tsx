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
    fireEvent.change(screen.getByRole("combobox", { name: "病种筛选" }), { target:{ value:"WSD" } });
    fireEvent.change(screen.getByRole("combobox", { name: "QAAD 状态筛选" }), { target:{ value:"no_information" } });
    fireEvent.click(screen.getByText("Language"));
    assert.equal((screen.getByRole("combobox", { name: "Disease filter" }) as HTMLSelectElement).value, "WSD");
    assert.equal((screen.getByRole("combobox", { name: "QAAD status filter" }) as HTMLSelectElement).value, "no_information");
    assert.ok(screen.getByText(/not outbreak events/));
  } finally { cleanup(); }
});
