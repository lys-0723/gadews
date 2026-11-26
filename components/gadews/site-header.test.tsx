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

test("account header reflects the approved session, pending access and expiry", async () => {
  const React = await import("react");
  const { render, screen, fireEvent, cleanup, waitFor } = await import("@testing-library/react");
  const { LocaleProvider } = await import("./locale-provider");
  const { StickyHeader } = await import("./sticky-header");
  const originalFetch = globalThis.fetch;
  const user = { username: "demo.reader", role: "region", country: "A", region: "east" };
  let identity: unknown = { ...user, status: "pending", active: false };
  globalThis.fetch = async () => Response.json(identity);
  try {
    render(<LocaleProvider initialLocale="zh-CN"><StickyHeader /></LocaleProvider>);
    assert.ok(await screen.findByRole("button", { name: "待审批" }));
    assert.ok(!screen.queryByText("区域管理员"));
    identity = { ...user, status: "active", active: true };
    fireEvent(window, new window.Event("gadews:session-changed"));
    const role = await screen.findByRole("button", { name: /区域管理员.*示例国甲 · 东区/ });
    fireEvent.click(role);
    assert.ok(screen.getByText("demo.reader"));
    assert.equal(screen.getByRole("link", { name: "账号管理" }).getAttribute("href"), "/accounts");
    assert.ok(screen.getByRole("button", { name: "退出登录" }));

    identity = null;
    fireEvent(window, new window.Event("gadews:session-changed"));
    await waitFor(() => assert.ok(!screen.queryByText("demo.reader")));
    assert.equal(screen.getByRole("link", { name: "普通用户登录" }).getAttribute("href"), "/login?entry=user");
    assert.equal(screen.getByRole("link", { name: "管理员登录" }).getAttribute("href"), "/login?entry=admin");
  } finally {
    cleanup();
    globalThis.fetch = originalFetch;
  }
});
