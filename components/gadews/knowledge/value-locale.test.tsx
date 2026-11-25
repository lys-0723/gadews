import assert from "node:assert/strict";
import test from "node:test";
import { installDom } from "@/lib/gadews/test-support/dom";
installDom();
Object.defineProperty(globalThis, "requestAnimationFrame", { configurable: true, value: (callback: FrameRequestCallback) => setTimeout(() => callback(0), 0) });
Object.defineProperty(globalThis, "cancelAnimationFrame", { configurable: true, value: clearTimeout });

test("project pathway keeps its selected workshop and photograph when the language changes", async () => {
  const React = await import("react"); const { render, screen, fireEvent, cleanup } = await import("@testing-library/react");
  const { LocaleProvider, useLocale } = await import("@/components/gadews/locale-provider"); const { default: Page } = await import("@/app/why-gadews-matters/page");
  function Switch() { const { setLocale } = useLocale(); return <button onClick={() => setLocale("en")}>Test language</button>; }
  try {
    render(<LocaleProvider initialLocale="zh-CN"><Switch /><Page /></LocaleProvider>);
    fireEvent.mouseDown(screen.getByRole("tab", { name: "罗马研讨会" }), { button: 0, ctrlKey: false });
    assert.ok(screen.getByRole("img", { name: "罗马 EWS 研讨会合影" }));
    fireEvent.click(screen.getByRole("button", { name: "Test language" }));
    assert.equal(screen.getByRole("tab", { name: "Rome workshop" }).getAttribute("aria-selected"), "true");
    assert.ok(screen.getByRole("img", { name: "Group photo from the Rome EWS workshop" }));
    assert.ok(screen.getByText(/Real database and device integration/));
  } finally { cleanup(); }
});
