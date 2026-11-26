"use client";

import { useWorkbenchText } from "./workbench-locale";

export function OriginalSource({ text, language }: { text: string; language?: string }) {
  const w = useWorkbenchText();
  return <details className="mt-3 rounded-xl border border-slate-200 bg-white p-3 text-sm">
    <summary className="cursor-pointer font-semibold text-slate-700">{w(language === "zh-CN" ? "Original source text (Chinese)" : "Original engine wording")}</summary>
    <p className="mt-2 whitespace-pre-wrap break-words leading-7 text-slate-700" lang={language}>{text}</p>
  </details>;
}
