import assert from "node:assert/strict";
import test from "node:test";
import { installDom } from "@/lib/gadews/test-support/dom";

class TestResizeObserver { observe() {} unobserve() {} disconnect() {} }
const dom = installDom();
Object.assign(globalThis, { ResizeObserver: TestResizeObserver });
Object.defineProperty(dom.window.HTMLElement.prototype, "getBoundingClientRect", { configurable: true, value: () => ({ width: 800, height: 300, top: 0, left: 0, right: 800, bottom: 300, x: 0, y: 0, toJSON: () => ({}) }) });
Object.assign(globalThis, { DocumentFragment: dom.window.DocumentFragment, requestAnimationFrame: (callback: FrameRequestCallback) => setTimeout(() => callback(performance.now()), 16), cancelAnimationFrame: clearTimeout });

test("NASA site choice and source values survive a language switch without another request", async () => {
  const React = await import("react");
  const { render, screen, fireEvent, waitFor, cleanup } = await import("@testing-library/react");
  const { LocaleProvider, useLocale } = await import("@/components/gadews/locale-provider");
  const { EnvironmentalDataPanel } = await import("./environmental-data-panel");
  function Switch() { const { setLocale } = useLocale(); return <button onClick={() => setLocale("en")}>Language</button>; }
  const previousFetch = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = async () => { requests++; return Response.json(["A", "B"].map(site_id => ({ site_id, site_name: `Original ${site_id}`, country: "Native country", latitude: 20, longitude: 110, date: "2026-01-01", t2m: null, t2m_max: null, t2m_min: null, air_temperature_range: null, precipitation: 2, rh2m: 80, ws2m: 3, source: "NASA POWER", source_url: "https://power.larc.nasa.gov/" }))); };
  try {
    render(<LocaleProvider initialLocale="zh-CN"><Switch /><EnvironmentalDataPanel /></LocaleProvider>);
    await waitFor(() => assert.ok(screen.getByRole("combobox", { name: "选择站点" })));
    await waitFor(() => assert.ok(screen.getByRole("option", { name: "B - Original B" })));
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "B" } });
    assert.ok(screen.getByText(/不是塘口水温/));
    fireEvent.click(screen.getByText("Language"));
    assert.equal((screen.getByRole("combobox", { name: "Select site" }) as HTMLSelectElement).value, "B");
    assert.ok(screen.getByText(/not pond water temperature/));
    assert.ok(screen.getByText(/Missing values/));
    assert.equal(requests, 1);
  } finally { globalThis.fetch = previousFetch; cleanup(); }
});
