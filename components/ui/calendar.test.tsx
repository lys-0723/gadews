import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost" });
Object.defineProperties(globalThis, {
  window: { value: dom.window, configurable: true },
  document: { value: dom.window.document, configurable: true },
  navigator: { value: dom.window.navigator, configurable: true },
  HTMLElement: { value: dom.window.HTMLElement, configurable: true },
  Node: { value: dom.window.Node, configurable: true },
  getComputedStyle: { value: dom.window.getComputedStyle.bind(dom.window), configurable: true },
});

test("controlled single selection, navigation and forwarded props", async () => {
  const React = await import("react");
  const { render, screen, cleanup } = await import("@testing-library/react");
  const { default: userEvent } = await import("@testing-library/user-event");
  const { Calendar } = await import("./calendar");
  function Controlled() {
    const [selected, setSelected] = React.useState<Date>();
    return <Calendar mode="single" defaultMonth={new Date(2026, 9, 1)} selected={selected} onSelect={setSelected} disabled={{ dayOfWeek: [0] }} data-testid="calendar" showOutsideDays={false} />;
  }
  try {
    render(<Controlled />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Thursday, October 15th, 2026/i }));
    assert.ok(screen.getByRole("button", { name: /October 15th, 2026, selected/i }));
    assert.equal((screen.getByRole("button", { name: /Sunday, October 18th/i }) as HTMLButtonElement).disabled, true);
    await user.click(screen.getByRole("button", { name: /next month/i }));
    assert.ok(screen.getByText("November 2026"));
    await user.click(screen.getByRole("button", { name: /previous month/i }));
    assert.ok(screen.getByText("October 2026"));
    assert.ok(screen.getByTestId("calendar"));
  } finally { cleanup(); }
});

test("controlled range selects both endpoints", async () => {
  const React = await import("react");
  const { render, screen, cleanup } = await import("@testing-library/react");
  const { default: userEvent } = await import("@testing-library/user-event");
  const { Calendar } = await import("./calendar");
  function ControlledRange() {
    const [selected, setSelected] = React.useState<import("react-day-picker").DateRange>();
    return <Calendar mode="range" defaultMonth={new Date(2026, 9, 1)} selected={selected} onSelect={setSelected} />;
  }
  try {
    render(<ControlledRange />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Thursday, October 15th, 2026/i }));
    await user.click(screen.getByRole("button", { name: /Tuesday, October 20th, 2026/i }));
    assert.ok(screen.getByRole("button", { name: /October 15th, 2026, selected/i }));
    assert.ok(screen.getByRole("button", { name: /October 20th, 2026, selected/i }));
  } finally { cleanup(); }
});

test("mobile subscription updates at the breakpoint and unsubscribes", async () => {
  const { renderHook, act, cleanup } = await import("@testing-library/react");
  const { useIsMobile } = await import("@/hooks/use-mobile");
  const listeners = new Set<() => void>();
  const original = Object.getOwnPropertyDescriptor(window, "matchMedia");
  const width = Object.getOwnPropertyDescriptor(window, "innerWidth");
  Object.defineProperty(window, "innerWidth", { value: 1440, configurable: true });
  Object.defineProperty(window, "matchMedia", { configurable: true, value: () => ({
    addEventListener: (_event: string, callback: () => void) => listeners.add(callback),
    removeEventListener: (_event: string, callback: () => void) => listeners.delete(callback),
  }) });
  try {
    const hook = renderHook(useIsMobile);
    assert.equal(hook.result.current, false);
    act(() => {
      Object.defineProperty(window, "innerWidth", { value: 390, configurable: true });
      listeners.forEach((notify) => notify());
    });
    assert.equal(hook.result.current, true);
    hook.unmount();
    assert.equal(listeners.size, 0);
  } finally {
    cleanup();
    if (original) Object.defineProperty(window, "matchMedia", original);
    else Reflect.deleteProperty(window, "matchMedia");
    if (width) Object.defineProperty(window, "innerWidth", width);
  }
});
