"use client";

import { useState } from "react";
import { Copy, ExternalLink } from "lucide-react";
import { useLocale } from "@/components/gadews/locale-provider";
import type { AssistantResult } from "@/lib/gadews/assistant/types";

export function answerPlainText(result: AssistantResult): string {
  return [...result.answer.knowledge.map((paragraph) => `${paragraph.text} [${paragraph.sourceIds.join(", ")}]`), result.answer.general].filter(Boolean).join("\n\n");
}
function sourceHref(href: string): string | undefined {
  if (/^\/data\/[a-zA-Z0-9/_%.#-]+$/.test(href)) return href;
  try { const url = new URL(href); if (["http:", "https:"].includes(url.protocol) && !url.username && !url.password) return url.href; } catch { /* Do not render arbitrary model links. */ }
}
export function AssistantContent({ result, visibleCharacters = Infinity }: { result: AssistantResult; visibleCharacters?: number }) {
  const { t } = useLocale();
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle");
  const paragraphs = result.answer.knowledge.map((paragraph, index) => {
    const before = result.answer.knowledge.slice(0, index).reduce((sum, entry) => sum + entry.text.length, 0);
    const text = paragraph.text.slice(0, Math.max(0, visibleCharacters - before));
    return { ...paragraph, text };
  });
  const general = result.answer.general.slice(0, Math.max(0, visibleCharacters - result.answer.knowledge.reduce((sum, entry) => sum + entry.text.length, 0)));
  async function copy() {
    try { await navigator.clipboard.writeText(answerPlainText(result)); setCopyStatus("copied"); } catch { setCopyStatus("failed"); }
  }
  return <article className="ga-answer">
    <div className="ga-speaker">GADEWS</div>
    {result.answer.knowledge.length > 0 ? <section aria-label={t("知识库依据", "Project evidence")}>
      <h3 className="ga-evidence-label">{t("知识库依据", "Project evidence")}</h3>
      {paragraphs.map((paragraph, index) => paragraph.text ? <p key={index}>{paragraph.text}<span className="ga-citations">{paragraph.sourceIds.map((id) => <span key={id} title={result.sources.find((source) => source.id === id)?.title}>[{result.sources.findIndex((source) => source.id === id) + 1}]</span>)}</span></p> : null)}
    </section> : <p className="ga-insufficient">{t("本次未找到足够的项目知识库依据。", "No sufficient project evidence was found for this question.")}</p>}
    {general && <section className="ga-general" aria-label={t("通用知识补充", "General supplement")}><h3>{t("通用补充 · 未经项目知识库核实", "General supplement · not verified by the project corpus")}</h3><p>{general}</p></section>}
    {result.sources.length > 0 && <details className="ga-sources"><summary>{t("查阅来源", "Sources")} · {result.sources.length}</summary><ol>{result.sources.map((source) => {
      const href = sourceHref(source.href);
      return <li key={source.id}><strong>{source.title}{source.year ? ` (${source.year})` : ""}</strong><span className="ga-source-level">{source.accessLevel}</span><p>{source.limitations}</p><small>{source.id}</small>{href && <a href={href} target="_blank" rel="noopener noreferrer">{t("查阅来源", "Open source")} <ExternalLink size={13} aria-hidden="true" /></a>}</li>;
    })}</ol></details>}
    <div className="ga-answer-actions"><button type="button" onClick={copy}><Copy size={14} aria-hidden="true" />{copyStatus === "copied" ? t("已复制", "Copied") : copyStatus === "failed" ? t("复制失败，请选择正文复制", "Copy failed; select the answer text") : t("复制回答", "Copy answer")}</button></div>
  </article>;
}
