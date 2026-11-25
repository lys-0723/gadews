"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { chooseText, LOCALE_COOKIE, type BilingualCopy, type Locale } from "@/lib/gadews/i18n/locale";

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (zh: string, en: string) => string;
}

// Standalone historical components retain their original English contract.
// The product root always supplies an explicit initialLocale.
const LocaleContext = createContext<LocaleContextValue>({ locale: "en", setLocale: () => {}, t: (_zh, en) => en });

export function LocaleProvider({ initialLocale = "zh-CN", children }: { initialLocale?: Locale; children: ReactNode }) {
  const [locale, updateLocale] = useState<Locale>(initialLocale);
  const setLocale = useCallback((next: Locale) => {
    updateLocale(next);
    try { document.cookie = `${LOCALE_COOKIE}=${next}; Path=/; Max-Age=31536000; SameSite=Lax`; } catch { /* Session switching works when storage is unavailable. */ }
  }, []);
  useEffect(() => { document.documentElement.lang = locale; }, [locale]);
  const value = useMemo(() => ({ locale, setLocale, t: (zh: string, en: string) => chooseText(locale, zh, en) }), [locale, setLocale]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() { return useContext(LocaleContext); }
export function useCopy<C extends BilingualCopy>(copy: C) {
  const { locale } = useLocale();
  return (key: keyof C) => chooseText(locale, copy[key][0], copy[key][1]);
}
