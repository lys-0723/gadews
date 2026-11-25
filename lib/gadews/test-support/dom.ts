import { JSDOM } from "jsdom";

export function installDom() {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost" });
  Object.defineProperties(globalThis, {
    window: { value: dom.window, configurable: true },
    self: { value: dom.window, configurable: true },
    document: { value: dom.window.document, configurable: true },
    navigator: { value: dom.window.navigator, configurable: true },
    HTMLElement: { value: dom.window.HTMLElement, configurable: true },
    Node: { value: dom.window.Node, configurable: true },
    getComputedStyle: { value: dom.window.getComputedStyle.bind(dom.window), configurable: true },
  });
  return dom;
}
