export type Locale = "zh-CN" | "en";
export const LOCALE_COOKIE = "gadews-language";
export type BilingualCopy = Readonly<Record<string, readonly [zh: string, en: string]>>;

export function readLocalePreference(cookieHeader: string | null): Locale {
  const raw = cookieHeader?.split(";").map(part => part.trim()).find(part => part.startsWith(`${LOCALE_COOKIE}=`))?.slice(LOCALE_COOKIE.length + 1);
  try { return raw && decodeURIComponent(raw) === "en" ? "en" : "zh-CN"; } catch { return "zh-CN"; }
}

export function chooseText(locale: Locale, zh: string, en: string): string {
  return locale === "zh-CN" ? zh : en;
}

export function copyText<C extends BilingualCopy>(locale: Locale, copy: C, key: keyof C): string {
  const pair = copy[key];
  return chooseText(locale, pair[0], pair[1]);
}
