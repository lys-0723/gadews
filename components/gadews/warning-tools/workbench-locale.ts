"use client";

import { useLocale } from "@/components/gadews/locale-provider";
import { workbenchText } from "@/lib/gadews/i18n/workbench-copy";

export function useWorkbenchText() {
  const { locale } = useLocale();
  return (text: string) => workbenchText(locale, text);
}
