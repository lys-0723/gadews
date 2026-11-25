import assert from "node:assert/strict";
import test from "node:test";
import { installDom } from "@/lib/gadews/test-support/dom";
installDom();

test("manual footage controls follow actual playback and locale, then pause on exit", async () => {
  const React = await import("react");
  const { render, screen, fireEvent, cleanup, act } = await import("@testing-library/react");
  const { LocaleProvider, useLocale } = await import("@/components/gadews/locale-provider");
  const { OceanFilm } = await import("./ocean-film");
  let observe: IntersectionObserverCallback = () => {};
  Object.defineProperty(document, "hidden", { configurable: true, value: false });
  Object.defineProperty(window, "matchMedia", { configurable: true, value: (query: string) => ({ matches: query.includes("max-width"), addEventListener() {}, removeEventListener() {} }) });
  Object.defineProperty(globalThis, "IntersectionObserver", { configurable: true, value: class { constructor(fn: IntersectionObserverCallback) { observe = fn; } observe() {} disconnect() {} } });
  const media = window.HTMLMediaElement.prototype;
  const oldPlay = media.play, oldPause = media.pause;
  media.play = function () { Object.defineProperty(this, "paused", { configurable: true, value: false }); this.dispatchEvent(new window.Event("play")); return Promise.resolve(); };
  media.pause = function () { Object.defineProperty(this, "paused", { configurable: true, value: true }); this.dispatchEvent(new window.Event("pause")); };
  function Example() { const { setLocale } = useLocale(); return <><button onClick={() => setLocale("en")}>English</button><OceanFilm /></>; }
  try {
    render(<LocaleProvider initialLocale="zh-CN"><Example /></LocaleProvider>);
    await act(async () => observe([{ isIntersecting: true, intersectionRatio: .8 } as IntersectionObserverEntry], {} as IntersectionObserver));
    assert.ok(screen.getByRole("button", { name: "播放生态影像" }));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "播放生态影像" })));
    assert.ok(screen.getByRole("button", { name: "暂停影像" }));
    fireEvent.click(screen.getByText("English"));
    assert.ok(screen.getByRole("button", { name: "Pause footage" }));
    await act(async () => observe([{ isIntersecting: false, intersectionRatio: 0 } as IntersectionObserverEntry], {} as IntersectionObserver));
    assert.ok(screen.getByRole("button", { name: "Play footage" }));
  } finally { cleanup(); media.play = oldPlay; media.pause = oldPause; delete (document as unknown as { hidden?: boolean }).hidden; }
});
