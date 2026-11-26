import assert from "node:assert/strict";
import test from "node:test";
import { installDom } from "@/lib/gadews/test-support/dom";

installDom();

async function introFeature() {
  const feature = await import("./hero-intro").catch(() => null);
  assert.ok(feature, "the non-blocking hero introduction must exist");
  return feature;
}

function motionPreference(initial: boolean) {
  let reduced = initial;
  const listeners = new Set<() => void>();
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: () => ({
      get matches() { return reduced; },
      addEventListener(_event: string, listener: () => void) { listeners.add(listener); },
      removeEventListener(_event: string, listener: () => void) { listeners.delete(listener); },
    }),
  });
  Object.defineProperty(document, "hidden", { configurable: true, value: false });
  return (next: boolean) => {
    reduced = next;
    listeners.forEach((listener) => listener());
  };
}

test("server-rendered titles retain complete Chinese and English text without JavaScript", async () => {
  const React = await import("react");
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { getByRole } = await import("@testing-library/dom");
  const { HeroTitle } = await introFeature();
  for (const lines of [
    ["感知水域变化，", "守护同一健康。"],
    ["A changing ocean.", "A shared future."],
  ] as const) {
    const container = document.createElement("div");
    container.innerHTML = renderToStaticMarkup(<HeroTitle lines={lines} />);
    const heading = getByRole(container, "heading", { level: 1, name: lines.join(" ") });
    assert.equal(heading.id, "hero-title");
    assert.notEqual(heading.getAttribute("data-intro-state"), "running");
    const semanticLines = heading.querySelectorAll(".hero-title-full");
    assert.deepEqual([...semanticLines].map((line) => line.textContent), [...lines]);
    assert.equal(heading.querySelectorAll('[aria-hidden="true"]').length, 2);
  }
});

test("each real title character appears in reading order with preserved spaces and a bounded reveal", async (context) => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  const React = await import("react");
  const { render, screen, cleanup, act } = await import("@testing-library/react");
  const { HeroTitle } = await introFeature();
  motionPreference(false);
  try {
    render(<HeroTitle lines={["A changing ocean.", "A shared future."]} />);
    const heading = screen.getByRole("heading", { name: "A changing ocean. A shared future." });
    assert.equal(heading.dataset.introState, "running");
    const layers = [...heading.querySelectorAll<HTMLElement>(".hero-title-letters")];
    assert.deepEqual(layers.map((layer) => layer.textContent), ["A changing ocean.", "A shared future."]);
    const characters = layers.flatMap((layer) => [...layer.children] as HTMLElement[]);
    const delays = characters.map((character) => Number.parseFloat(character.style.animationDelay));
    assert.equal(characters.filter((character) => character.textContent === " ").length, 4);
    assert.ok(delays.every((delay, index) => index === 0 || delay > delays[index - 1]));
    assert.ok(delays[0] >= 400, "the short wordmark opening precedes the title");
    assert.ok(delays.at(-1)! < 2300, "both title lines must finish within 2.5 seconds");
    await act(async () => context.mock.timers.tick(2500));
    assert.equal(heading.dataset.introState, "complete");
  } finally {
    cleanup();
    context.mock.timers.reset();
  }
});

test("changing language finishes the current reveal and never restarts it", async (context) => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  const React = await import("react");
  const { render, screen, cleanup } = await import("@testing-library/react");
  const { HeroTitle } = await introFeature();
  motionPreference(false);
  try {
    const view = render(<HeroTitle lines={["感知水域变化，", "守护同一健康。"]} />);
    assert.equal(screen.getByRole("heading").dataset.introState, "running");
    view.rerender(<HeroTitle lines={["A changing ocean.", "A shared future."]} />);
    assert.equal(screen.getByRole("heading", { name: "A changing ocean. A shared future." }).dataset.introState, "complete");
    view.rerender(<HeroTitle lines={["感知水域变化，", "守护同一健康。"]} />);
    assert.equal(screen.getByRole("heading").dataset.introState, "complete");
  } finally {
    cleanup();
    context.mock.timers.reset();
  }
});

test("reduced motion shows complete content immediately and also ends an active opening", async () => {
  const React = await import("react");
  const { render, screen, cleanup, act } = await import("@testing-library/react");
  const { HeroIntro, HeroTitle } = await introFeature();
  const reduce = motionPreference(true);
  try {
    const view = render(<><HeroIntro /><HeroTitle lines={["感知水域变化，", "守护同一健康。"]} /></>);
    assert.equal(screen.getByRole("heading").dataset.introState, "complete");
    assert.equal(view.container.querySelector<HTMLElement>(".hero-opening")?.dataset.introState, "complete");
    cleanup();
    reduce(false);
    const active = render(<><HeroIntro /><HeroTitle lines={["感知水域变化，", "守护同一健康。"]} /></>);
    assert.equal(screen.getByRole("heading").dataset.introState, "running");
    await act(async () => reduce(true));
    assert.equal(screen.getByRole("heading").dataset.introState, "complete");
    assert.equal(active.container.querySelector<HTMLElement>(".hero-opening")?.dataset.introState, "complete");
    await act(async () => reduce(false));
    assert.equal(screen.getByRole("heading").dataset.introState, "complete");
  } finally { cleanup(); }
});

test("the decorative opening ends promptly while navigation remains usable", async (context) => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  const React = await import("react");
  const { render, screen, cleanup, act, fireEvent } = await import("@testing-library/react");
  const { HeroIntro } = await introFeature();
  motionPreference(false);
  let followed = false;
  try {
    const view = render(<><HeroIntro /><a href="#reports" onClick={() => { followed = true; }}>探索全球报告</a></>);
    const opening = view.container.querySelector<HTMLElement>(".hero-opening");
    assert.equal(opening?.getAttribute("aria-hidden"), "true");
    assert.equal(opening?.dataset.introState, "running");
    assert.equal(opening?.querySelectorAll('a, button, input, [tabindex]').length, 0);
    const link = screen.getByRole("link", { name: "探索全球报告" });
    link.focus();
    fireEvent.click(link);
    assert.equal(document.activeElement, link);
    assert.equal(followed, true);
    await act(async () => context.mock.timers.tick(1700));
    assert.equal(opening?.dataset.introState, "complete");
  } finally {
    cleanup();
    context.mock.timers.reset();
  }
});
