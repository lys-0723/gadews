import assert from "node:assert/strict";
import test from "node:test";
import { installDom } from "@/lib/gadews/test-support/dom";

installDom();

test("locale preference accepts only supported values and malformed cookies remain usable", async () => {
  const { readLocalePreference } = await import("./locale");
  assert.equal(readLocalePreference(null), "zh-CN");
  assert.equal(readLocalePreference("other=en; gadews-language=en"), "en");
  assert.equal(readLocalePreference("gadews-language=zh-CN"), "zh-CN");
  assert.equal(readLocalePreference("gadews-language=%ZZ"), "zh-CN");
  assert.equal(readLocalePreference("gadews-language=es"), "zh-CN");
});

test("changing locale updates copy and document language without remounting editable content", async () => {
  const React = await import("react");
  const { render, screen, fireEvent, cleanup } = await import("@testing-library/react");
  const { LocaleProvider, useLocale } = await import("@/components/gadews/locale-provider");
  function Example() {
    const { locale, setLocale, t } = useLocale();
    const [value, setValue] = React.useState("");
    return <><button onClick={() => setLocale(locale === "en" ? "zh-CN" : "en")}>Language</button><label>{t("水温", "Water temperature")}<input value={value} onChange={e => setValue(e.target.value)} /></label></>;
  }
  try {
    render(<LocaleProvider initialLocale="zh-CN"><Example /></LocaleProvider>);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "7.02" } });
    fireEvent.click(screen.getByText("Language"));
    assert.equal((screen.getByLabelText("Water temperature") as HTMLInputElement).value, "7.02");
    assert.equal(document.documentElement.lang, "en");
    assert.match(document.cookie, /gadews-language=en/);
  } finally { cleanup(); }
});

test("blocked preference storage does not prevent a session language switch", async () => {
  const React = await import("react");
  const { render, screen, fireEvent, cleanup } = await import("@testing-library/react");
  const { LocaleProvider, useLocale } = await import("@/components/gadews/locale-provider");
  function Example() { const { setLocale, t } = useLocale(); return <button onClick={() => setLocale("en")}>{t("切换", "Switched")}</button>; }
  Object.defineProperty(document, "cookie", { configurable: true, get: () => "", set: () => { throw new Error("blocked"); } });
  try { render(<LocaleProvider initialLocale="zh-CN"><Example /></LocaleProvider>); fireEvent.click(screen.getByRole("button")); assert.ok(screen.getByText("Switched")); }
  finally { delete (document as unknown as { cookie?: string }).cookie; cleanup(); }
});
