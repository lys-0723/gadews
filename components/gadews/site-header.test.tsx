import assert from "node:assert/strict";
import test from "node:test";
import { installDom } from "@/lib/gadews/test-support/dom";
installDom();

test("shared navigation offers Home and language switching and restores menu focus on Escape", async () => {
  const React = await import("react");
  const { render, screen, fireEvent, cleanup, within } = await import("@testing-library/react");
  const { LocaleProvider } = await import("./locale-provider");
  const { StickyHeader } = await import("./sticky-header");
  try {
    render(<LocaleProvider initialLocale="zh-CN"><StickyHeader /></LocaleProvider>);
    assert.ok(screen.getByRole("link", { name: "GADEWS 首页" }));
    const menu = screen.getByRole("button", { name: "打开导航菜单" });
    fireEvent.click(menu);
    const navigation = within(screen.getByRole("navigation", { name: "移动导航" }));
    assert.equal(navigation.getByRole("link", { name: "首页" }).getAttribute("href"), "/");
    fireEvent.keyDown(document, { key: "Escape" });
    assert.equal(menu.getAttribute("aria-expanded"), "false");
    assert.equal(document.activeElement, menu);
    fireEvent.click(screen.getByRole("button", { name: "English" }));
    assert.ok(screen.getByRole("link", { name: "GADEWS Home" }));
    assert.equal(document.documentElement.lang, "en");
  } finally { cleanup(); }
});
