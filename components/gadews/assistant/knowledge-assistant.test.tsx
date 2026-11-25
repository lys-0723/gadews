import assert from "node:assert/strict";
import test from "node:test";
import type { AssistantResult } from "@/lib/gadews/assistant/types";
import { installDom } from "@/lib/gadews/test-support/dom";

installDom();
Object.defineProperty(window, "matchMedia", { configurable: true, value: () => ({ matches: true, addEventListener() {}, removeEventListener() {} }) });
const good: AssistantResult = { answer: { knowledge: [{ text: "Validated WSD prototype statement <img src=x onerror=alert(1)>", sourceIds: ["s1"] }], general: "General health information" }, sources: [{ id: "s1", title: "Abstract source", text: "summary", href: "https://doi.org/10.1000/test", kind: "literature", accessLevel: "目录/摘要", limitations: "未读取全文" }] };
async function setup() {
  const feature = await import("./knowledge-assistant").catch(() => null);
  assert.ok(feature, "global assistant must exist");
  const Assistant = feature.KnowledgeAssistant;
  const React = await import("react");
  const testing = await import("@testing-library/react");
  const { LocaleProvider, useLocale } = await import("@/components/gadews/locale-provider");
  function Toggle() { const { setLocale } = useLocale(); return <button onClick={() => setLocale("en")}>English</button>; }
  function Shell({ route }: { route: string }) { return <LocaleProvider initialLocale="zh-CN"><main>{route}</main><Toggle /><Assistant /></LocaleProvider>; }
  const view = testing.render(<Shell route="home" />);
  testing.fireEvent.click(testing.screen.getByRole("button", { name: "打开知识助手" }));
  return { ...testing, ...view, React, navigate: (route: string) => view.rerender(<Shell route={route} />) };
}

test("draft and answers survive collapse, parent route rerender and locale changes without implicit requests", async (context) => {
  let calls = 0;
  context.mock.method(globalThis, "fetch", async () => { calls++; return Response.json(good); });
  const ui = await setup();
  try {
    ui.fireEvent.change(ui.screen.getByRole("textbox", { name: "输入问题" }), { target: { value: "WSSV?" } });
    ui.navigate("knowledge");
    assert.equal((ui.screen.getByRole("textbox") as HTMLTextAreaElement).value, "WSSV?");
    ui.fireEvent.click(ui.screen.getByRole("button", { name: "收起助手" }));
    ui.fireEvent.click(ui.screen.getByRole("button", { name: "打开知识助手" }));
    assert.equal((ui.screen.getByRole("textbox") as HTMLTextAreaElement).value, "WSSV?");
    ui.fireEvent.click(ui.screen.getByRole("button", { name: "English" }));
    assert.equal((ui.screen.getByRole("textbox", { name: "Your question" }) as HTMLTextAreaElement).value, "WSSV?");
    assert.equal(calls, 0);
    ui.fireEvent.click(ui.screen.getByRole("button", { name: "Send question" }));
    await ui.waitFor(() => assert.ok(ui.screen.getByText(/Validated WSD/)));
    ui.navigate("warning-tools");
    assert.ok(ui.screen.getByText(/Validated WSD/));
    assert.ok(ui.screen.getByText("General supplement · not verified by the project corpus"));
    assert.equal(ui.container.querySelector("img"), null);
    assert.equal(calls, 1);
  } finally { ui.cleanup(); }
});

test("unconfigured response is honest and retry reuses one question with current locale", async (context) => {
  const bodies: { locale: string; messages: unknown[] }[] = [];
  context.mock.method(globalThis, "fetch", async (_url: Parameters<typeof fetch>[0], options?: RequestInit) => {
    bodies.push(JSON.parse(options!.body as string));
    return bodies.length === 1 ? Response.json({ error: { code: "not_configured", message: "private raw message must not display" } }, { status: 503 }) : Response.json(good);
  });
  const ui = await setup();
  try {
    ui.fireEvent.change(ui.screen.getByRole("textbox"), { target: { value: "白斑病" } });
    ui.fireEvent.click(ui.screen.getByRole("button", { name: "发送问题" }));
    await ui.waitFor(() => assert.ok(ui.screen.getByText(/管理员尚未配置/)));
    assert.equal(ui.screen.queryByText(/private raw/), null);
    ui.fireEvent.click(ui.screen.getByRole("button", { name: "English" }));
    ui.fireEvent.click(ui.screen.getByRole("button", { name: "Retry" }));
    await ui.waitFor(() => assert.ok(ui.screen.getByText(/Validated WSD/)));
    assert.equal(ui.screen.getAllByText("白斑病").length, 1);
    assert.equal(bodies[1].locale, "en");
    assert.equal(bodies[1].messages.length, 1);
  } finally { ui.cleanup(); }
});

test("stop and new conversation abort real request and late completion cannot overwrite a new session", async (context) => {
  let resolve!: (response: Response) => void;
  let signal: AbortSignal | undefined;
  context.mock.method(globalThis, "fetch", async (_url: Parameters<typeof fetch>[0], options?: RequestInit) => {
    signal = options!.signal as AbortSignal;
    return new Promise<Response>((done) => { resolve = done; });
  });
  const ui = await setup();
  try {
    ui.fireEvent.change(ui.screen.getByRole("textbox"), { target: { value: "old question" } });
    ui.fireEvent.click(ui.screen.getByRole("button", { name: "发送问题" }));
    ui.fireEvent.click(ui.screen.getByRole("button", { name: "停止请求" }));
    assert.equal(signal?.aborted, true);
    ui.fireEvent.click(ui.screen.getByRole("button", { name: "新对话" }));
    ui.fireEvent.change(ui.screen.getByRole("textbox"), { target: { value: "new draft" } });
    await ui.act(async () => resolve(Response.json(good)));
    assert.equal(ui.screen.queryByText(/Validated WSD/), null);
    assert.equal(ui.screen.queryByText("old question"), null);
    assert.equal((ui.screen.getByRole("textbox") as HTMLTextAreaElement).value, "new draft");
  } finally { ui.cleanup(); }
});

test("failed network permits explicit retry and source UI uses safe actual entry links", async (context) => {
  let calls = 0;
  context.mock.method(globalThis, "fetch", async () => { if (++calls === 1) throw new Error("secret network error"); return Response.json(good); });
  const ui = await setup();
  try {
    ui.fireEvent.change(ui.screen.getByRole("textbox"), { target: { value: "WSSV" } });
    ui.fireEvent.click(ui.screen.getByRole("button", { name: "发送问题" }));
    await ui.waitFor(() => assert.ok(ui.screen.getByRole("button", { name: "重试" })));
    assert.equal(ui.screen.queryByText(/secret network/), null);
    ui.fireEvent.click(ui.screen.getByRole("button", { name: "重试" }));
    await ui.waitFor(() => assert.ok(ui.screen.getByText(/Validated WSD/)));
    const details = ui.container.querySelector("details")!;
    ui.fireEvent.click(details.querySelector("summary")!);
    assert.equal(ui.screen.getByRole("link", { name: /查阅来源/ }).getAttribute("href"), "https://doi.org/10.1000/test");
    assert.ok(ui.screen.getByText("目录/摘要"));
    assert.ok(ui.screen.getByText("未读取全文"));
  } finally { ui.cleanup(); }
});

test("visibility snapshot/event, escape focus restore and existing dialog priority are coordinated", async () => {
  const events: boolean[] = [];
  const listener = (event: Event) => events.push((event as CustomEvent<{open: boolean}>).detail.open);
  window.addEventListener("gadews:assistant-visibility", listener);
  const ui = await setup();
  try {
    assert.equal(document.body.dataset.gadewsAssistantOpen, "true");
    assert.ok(events.includes(true));
    assert.equal(document.activeElement?.tagName, "TEXTAREA");
    ui.fireEvent.keyDown(ui.screen.getByRole("dialog"), { key: "Escape" });
    assert.equal(document.activeElement, ui.screen.getByRole("button", { name: "打开知识助手" }));
    ui.fireEvent.click(ui.screen.getByRole("button", { name: "打开知识助手" }));
    const dialog = document.createElement("div");
    dialog.setAttribute("role", "dialog"); dialog.setAttribute("data-state", "open");
    await ui.act(async () => document.body.append(dialog));
    await ui.waitFor(() => assert.equal(document.body.dataset.gadewsAssistantOpen, "false"));
    assert.equal(ui.screen.queryByRole("button", { name: "打开知识助手" }), null);
    await ui.act(async () => dialog.remove());
    await ui.waitFor(() => assert.ok(ui.screen.getByRole("button", { name: "打开知识助手" })));
  } finally { ui.cleanup(); window.removeEventListener("gadews:assistant-visibility", listener); }
});

test("history retains complete bounded pairs rather than failing after six questions", async () => {
  const { assistantHistory } = await import("./knowledge-assistant");
  const turns = Array.from({ length: 10 }, (_unused, id) => ({ id, question: "q".repeat(1900), result: { ...good, answer: { knowledge: [], general: "a".repeat(5000) } } }));
  const history = assistantHistory(turns, "latest");
  assert.ok(history.length <= 12);
  assert.equal(history.length % 2, 1);
  assert.ok(history.every((message) => message.content.length <= 2000));
  assert.ok(history.reduce((sum, message) => sum + message.content.length, 0) <= 12000);
  assert.equal(history.at(-1)?.content, "latest");
  for (let index = 0; index < history.length - 1; index += 2) assert.deepEqual([history[index].role, history[index + 1].role], ["user", "assistant"]);
});

test("copy uses plain validated answer and unsafe source URLs are never rendered", async () => {
  const React = await import("react");
  const { render, screen, fireEvent, waitFor, cleanup } = await import("@testing-library/react");
  const { AssistantContent } = await import("./assistant-content");
  const { LocaleProvider } = await import("@/components/gadews/locale-provider");
  let copied = "";
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async (text: string) => { copied = text; } } });
  const result = { ...good, sources: [{ ...good.sources[0], href: "javascript:alert(1)" }] } as import("@/lib/gadews/assistant/types").AssistantResult;
  try {
    const view = render(<LocaleProvider initialLocale="zh-CN"><AssistantContent result={result} /></LocaleProvider>);
    assert.equal(view.container.querySelector("a"), null);
    assert.equal(view.container.querySelector("img"), null);
    fireEvent.click(screen.getByRole("button", { name: "复制回答" }));
    await waitFor(() => assert.ok(screen.getByRole("button", { name: "已复制" })));
    assert.match(copied, /Validated WSD.*\[s1\]/);
    assert.match(copied, /General health/);
  } finally { cleanup(); }
});

test("switching reduced motion during local reveal shows full answer without another request", async (context) => {
  const listeners = new Set<() => void>();
  let reduced = false;
  Object.defineProperty(window, "matchMedia", { configurable: true, value: (query: string) => ({ get matches() { return query.includes("reduced-motion") ? reduced : false; }, addEventListener(_event: string, callback: () => void) { listeners.add(callback); }, removeEventListener(_event: string, callback: () => void) { listeners.delete(callback); } }) });
  let calls = 0;
  context.mock.method(globalThis, "fetch", async () => { calls++; return Response.json(good); });
  const ui = await setup();
  try {
    ui.fireEvent.change(ui.screen.getByRole("textbox"), { target: { value: "WSSV" } });
    ui.fireEvent.click(ui.screen.getByRole("button", { name: "发送问题" }));
    await ui.waitFor(() => assert.ok(ui.screen.getByRole("button", { name: "显示全文" })));
    await ui.act(async () => { reduced = true; listeners.forEach((listener) => listener()); });
    assert.ok(ui.screen.queryByRole("button", { name: "显示全文" }) === null, "reduced motion should immediately finish the local reveal");
    assert.ok(ui.screen.getByText(/Validated WSD prototype statement/));
    assert.equal(calls, 1);
  } finally { ui.cleanup(); Object.defineProperty(window, "matchMedia", { configurable: true, value: () => ({ matches: true, addEventListener() {}, removeEventListener() {} }) }); }
});

test("mobile dialog wraps keyboard focus, locks page scroll and releases it on close", async () => {
  const ui = await setup();
  try {
    assert.equal(ui.screen.getByRole("dialog").getAttribute("aria-modal"), "true");
    assert.equal(document.body.style.overflow, "hidden");
    ui.fireEvent.change(ui.screen.getByRole("textbox"), { target: { value: "WSSV" } });
    const send = ui.screen.getByRole("button", { name: "发送问题" });
    const first = ui.screen.getByRole("button", { name: "新对话" });
    send.focus(); ui.fireEvent.keyDown(send, { key: "Tab" });
    assert.ok(document.activeElement === first, "Tab should wrap from final control to first");
    first.focus(); ui.fireEvent.keyDown(first, { key: "Tab", shiftKey: true });
    assert.ok(document.activeElement === send, "Shift+Tab should wrap to final control");
    ui.fireEvent.click(ui.screen.getByRole("button", { name: "收起助手" }));
    assert.equal(document.body.style.overflow, "");
  } finally { ui.cleanup(); }
});

test("retry of an earlier failure sends only its original conversation prefix", async (context) => {
  const bodies: { messages: { role: string; content: string }[] }[] = [];
  context.mock.method(globalThis, "fetch", async (_url: Parameters<typeof fetch>[0], options?: RequestInit) => {
    bodies.push(JSON.parse(options!.body as string));
    return bodies.length === 1 ? Response.json({ error: { code: "upstream_error" } }, { status: 502 }) : Response.json(good);
  });
  const ui = await setup();
  try {
    ui.fireEvent.change(ui.screen.getByRole("textbox"), { target: { value: "earlier WSD question" } });
    ui.fireEvent.click(ui.screen.getByRole("button", { name: "发送问题" }));
    await ui.waitFor(() => assert.ok(ui.screen.getByRole("button", { name: "重试" })));
    ui.fireEvent.change(ui.screen.getByRole("textbox"), { target: { value: "later tilapia question" } });
    ui.fireEvent.click(ui.screen.getByRole("button", { name: "发送问题" }));
    await ui.waitFor(() => assert.ok(ui.screen.getByText(/Validated WSD/)));
    ui.fireEvent.click(ui.screen.getByRole("button", { name: "重试" }));
    await ui.waitFor(() => assert.equal(bodies.length, 3));
    assert.deepEqual(bodies[2].messages, [{ role: "user", content: "earlier WSD question" }]);
  } finally { ui.cleanup(); }
});
