import assert from "node:assert/strict";
import test from "node:test";
import { installDom } from "@/lib/gadews/test-support/dom";
installDom();
for (const key of ["MutationObserver", "CustomEvent", "NodeFilter", "HTMLInputElement", "HTMLButtonElement", "Element", "Event", "KeyboardEvent"]) Object.defineProperty(globalThis, key, { configurable: true, value: (window as unknown as Record<string, unknown>)[key] });

const papers = [
  { Title: "Shrimp virus evidence", Authors: "A. Author", "Journal/Publisher": "Aquaculture", Pub_Year: 2024, DOI: "10.1000/shrimp", Abstract: "Original English abstract, unchanged.", Category: "白斑病-病原学", file_name: "shrimp.pdf", collection: "wssv" },
  { Title: "Earlier shrimp study", Authors: "B. Author", "Journal/Publisher": "Fish Research", Pub_Year: 2020, DOI: "", Abstract: "Earlier original abstract.", Category: "白斑病-临床诊断", file_name: "older.pdf", collection: "wssv" },
  { Title: "Tilapia bacteria evidence", Authors: "C. Author", "Journal/Publisher": "Aquaculture", Pub_Year: 2023, DOI: "10.1000/fish", Abstract: "Tilapia original abstract.", Category: "罗非鱼链球菌-预防控制", file_name: "fish.pdf", collection: "streptococcosis" },
];

test("switching language preserves collection query, search, category, order, list view and open original-paper details", async () => {
  const React = await import("react");
  const { render, screen, fireEvent, within, waitFor, cleanup } = await import("@testing-library/react");
  const { SearchParamsContext } = await import("next/dist/shared/lib/hooks-client-context.shared-runtime");
  const { LocaleProvider, useLocale } = await import("@/components/gadews/locale-provider");
  const { default: Page } = await import("@/app/knowledge-bank/literature/page");
  function Switch() { const { locale, setLocale } = useLocale(); return <button onClick={() => setLocale(locale === "en" ? "zh-CN" : "en")}>Test language</button>; }
  const original = globalThis.fetch;
  globalThis.fetch = async () => Response.json(papers);
  try {
    render(<SearchParamsContext.Provider value={new URLSearchParams("collection=streptococcosis")}><LocaleProvider initialLocale="zh-CN"><Switch /><Page /></LocaleProvider></SearchParamsContext.Provider>);
    assert.ok(await screen.findByRole("button", { name: /预防控制 \(1\)/ }));
    fireEvent.change(screen.getByRole("searchbox", { name: "检索文献" }), { target: { value: "bacteria" } });
    fireEvent.click(screen.getByRole("button", { name: /预防控制 \(1\)/ }));
    fireEvent.change(screen.getByRole("combobox", { name: "年份排序" }), { target: { value: "year_asc" } });
    fireEvent.click(screen.getByRole("button", { name: "列表视图" }));
    fireEvent.click(screen.getByRole("button", { name: "Tilapia bacteria evidence" }));
    assert.ok(screen.getByRole("dialog"));
    fireEvent.click(screen.getByRole("button", { name: "Test language" }));
    assert.equal((screen.getByRole("searchbox", { name: "Search literature" }) as HTMLInputElement).value, "bacteria");
    assert.equal((screen.getByRole("combobox", { name: "Sort by year" }) as HTMLSelectElement).value, "year_asc");
    assert.equal(screen.getByRole("button", { name: "List view" }).getAttribute("aria-pressed"), "true");
    assert.equal(screen.getByRole("button", { name: /Prevention and control \(1\)/ }).getAttribute("aria-pressed"), "true");
    const dialog = within(screen.getByRole("dialog"));
    assert.ok(dialog.getByText("Tilapia original abstract."));
    assert.ok(dialog.getByText("Original source text"));
    assert.equal(dialog.getByRole("link", { name: "Full text" }).getAttribute("href"), "http://59.110.161.54/literature/fish.pdf");
    assert.equal(dialog.getByRole("link", { name: "DOI link" }).getAttribute("href"), "https://doi.org/10.1000/fish");
    fireEvent.keyDown(document, { key: "Escape" });
    assert.ok(!screen.queryByRole("dialog"));
    await waitFor(() => assert.equal(document.activeElement?.textContent, "Tilapia bacteria evidence"));
  } finally { globalThis.fetch = original; cleanup(); }
});

test("translated empty state keeps a usable clear-search action and year sorting changes actual results", async () => {
  const React = await import("react"); const { render, screen, fireEvent, cleanup } = await import("@testing-library/react");
  const { SearchParamsContext } = await import("next/dist/shared/lib/hooks-client-context.shared-runtime");
  const { LocaleProvider } = await import("@/components/gadews/locale-provider"); const { default: Page } = await import("@/app/knowledge-bank/literature/page");
  const original = globalThis.fetch; globalThis.fetch = async () => Response.json(papers);
  try {
    render(<SearchParamsContext.Provider value={new URLSearchParams("collection=wssv")}><LocaleProvider initialLocale="en"><Page /></LocaleProvider></SearchParamsContext.Provider>);
    await screen.findByRole("button", { name: "Shrimp virus evidence" });
    fireEvent.change(screen.getByRole("combobox", { name: "Sort by year" }), { target: { value: "year_asc" } });
    assert.equal(screen.getAllByRole("article")[0].querySelector("h3")?.textContent, "Earlier shrimp study");
    fireEvent.change(screen.getByRole("searchbox", { name: "Search literature" }), { target: { value: "absent" } });
    assert.ok(screen.getByText("No papers found."));
    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    assert.equal(screen.getAllByRole("article").length, 2);
  } finally { globalThis.fetch = original; cleanup(); }
});

test("a failed collection load exposes localized retry and actually retries the resource", async () => {
  const React = await import("react"); const { render, screen, fireEvent, cleanup } = await import("@testing-library/react");
  const { LocaleProvider } = await import("@/components/gadews/locale-provider"); const { LiteratureOverview } = await import("./literature-overview");
  const original = globalThis.fetch; let attempts = 0; globalThis.fetch = async () => ++attempts === 1 ? new Response("Unavailable", { status: 503 }) : Response.json(papers);
  try {
    render(<LocaleProvider initialLocale="zh-CN"><LiteratureOverview /></LocaleProvider>);
    fireEvent.click(await screen.findByRole("button", { name: "重试" }));
    assert.ok(await screen.findByText("Shrimp virus evidence"));
    assert.equal(attempts, 2);
  } finally { globalThis.fetch = original; cleanup(); }
});
