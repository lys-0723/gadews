"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { ArrowUp, Maximize2, MessageCircle, Minimize2, Minus, Plus, Square } from "lucide-react";
import { useLocale } from "@/components/gadews/locale-provider";
import type { AssistantErrorCode, AssistantMessage, AssistantResult } from "@/lib/gadews/assistant/types";
import { AssistantContent, answerPlainText } from "./assistant-content";

interface Turn { id: number; question: string; result?: AssistantResult; error?: AssistantErrorCode }
type Phase = "idle" | "requesting" | "revealing";
const externalDialogs = '[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"], dialog[open]';
function publishVisibility(open: boolean) {
  document.body.dataset.gadewsAssistantOpen = String(open);
  window.dispatchEvent(new window.CustomEvent("gadews:assistant-visibility", { detail: { open } }));
}
/** Keep complete recent question/answer pairs. A returned answer can exceed the input limit. */
export function assistantHistory(turns: readonly Turn[], question: string): AssistantMessage[] {
  const pairs = turns.filter((turn) => turn.result).slice(-5).flatMap((turn): AssistantMessage[] => [
    { role: "user", content: turn.question.slice(0, 2000) },
    { role: "assistant", content: answerPlainText(turn.result!).slice(0, 2000) },
  ]);
  while (pairs.reduce((sum, message) => sum + message.content.length, question.length) > 12000 && pairs.length) pairs.splice(0, 2);
  return [...pairs, { role: "user", content: question }];
}
export function KnowledgeAssistant() {
  const { locale, t } = useLocale();
  const [open, setOpen] = useState(false);
  const [wide, setWide] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [draft, setDraft] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [visible, setVisible] = useState(Infinity);
  const [revealingId, setRevealingId] = useState<number | null>(null);
  const requestId = useRef(0);
  const nextTurn = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const revealTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const launcher = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const panel = useRef<HTMLElement>(null);
  const messages = useRef<HTMLDivElement>(null);
  const restore = useRef<HTMLElement | null>(null);
  const pendingFocus = useRef(false);
  const clearReveal = useCallback(() => { if (revealTimer.current) clearInterval(revealTimer.current); revealTimer.current = null; }, []);

  useEffect(() => {
    const media = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const finish = () => {
      if (!media?.matches) return;
      clearReveal(); setVisible(Infinity);
      setPhase((current) => current === "revealing" ? "idle" : current);
    };
    media?.addEventListener("change", finish);
    return () => media?.removeEventListener("change", finish);
  }, [clearReveal]);
  useEffect(() => {
    const media = window.matchMedia?.("(max-width: 560px)");
    const update = () => setMobile(media?.matches ?? false);
    update(); media?.addEventListener("change", update);
    return () => media?.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    const inspect = () => {
      const found = [...document.querySelectorAll<HTMLElement>(externalDialogs)].some((element) => !element.closest("[data-gadews-assistant]"));
      setBlocked(found);
      if (found) setOpen(false);
    };
    inspect();
    const observer = new window.MutationObserver(inspect);
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["data-state", "role", "open"] });
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    publishVisibility(open);
    if (open) input.current?.focus();
    else if (pendingFocus.current) {
      pendingFocus.current = false;
      const target = restore.current?.isConnected && restore.current.matches("button, a[href], input, textarea, [tabindex]") && !restore.current.closest("[data-gadews-assistant]") ? restore.current : launcher.current;
      if (!document.querySelector(externalDialogs)) target?.focus();
    }
    return () => publishVisibility(false);
  }, [open]);
  useEffect(() => {
    if (!open || !mobile) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [open, mobile]);
  useEffect(() => {
    const show = () => {
      if (document.querySelector(externalDialogs)) return;
      restore.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setOpen(true);
    };
    window.addEventListener("gadews:open-assistant", show);
    return () => window.removeEventListener("gadews:open-assistant", show);
  }, []);
  useEffect(() => () => { requestId.current++; controller.current?.abort(); clearReveal(); publishVisibility(false); }, [clearReveal]);
  useEffect(() => {
    const scroller = messages.current;
    if (scroller && scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 240) scroller.scrollTop = scroller.scrollHeight;
  }, [turns, phase, visible]);

  function show() { restore.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; setOpen(true); }
  function close() { pendingFocus.current = true; setOpen(false); }
  function stop() {
    requestId.current++; controller.current?.abort(); controller.current = null; clearReveal();
    setPhase("idle"); setVisible(Infinity);
    setTurns((current) => current.map((turn) => !turn.result && !turn.error ? { ...turn, error: "cancelled" } : turn));
  }
  function fresh() { stop(); setTurns([]); setDraft(""); input.current?.focus(); }
  function showFull() { clearReveal(); setVisible(Infinity); setPhase("idle"); }
  function errorText(code: AssistantErrorCode) {
    switch (code) {
      case "not_configured": return t("本站管理员尚未配置知识助手。请稍后再试，无需在浏览器提供密钥。", "The site administrator has not configured the assistant. No API key is needed in your browser.");
      case "cancelled": return t("请求已停止。可以重试或提出新问题。", "Request stopped. Retry or ask a new question.");
      case "timeout": return t("回答超时，请稍后重试。", "The answer timed out. Please retry.");
      case "busy": case "rate_limited": return t("请求较多，请稍后重试。", "Too many requests. Please try again shortly.");
      case "invalid_answer": return t("回答未通过来源校验，请重试。", "The answer failed source validation. Please retry.");
      case "invalid_request": case "body_too_large": return t("问题过长或格式有误，请缩短后重试。", "The question is too long or invalid. Please shorten it.");
      default: return t("暂时无法取得回答，请检查网络后重试。", "Could not get an answer. Check your connection and retry.");
    }
  }
  async function ask(question: string, retryId?: number) {
    const clean = question.trim();
    if (!clean || clean.length > 2000 || phase === "requesting") return;
    clearReveal(); controller.current?.abort();
    const currentRequest = ++requestId.current;
    const id = retryId ?? ++nextTurn.current;
    const abortController = new AbortController(); controller.current = abortController;
    const retryIndex = retryId === undefined ? -1 : turns.findIndex((turn) => turn.id === retryId);
    const history = assistantHistory(retryIndex < 0 ? turns : turns.slice(0, retryIndex), clean);
    setTurns((current) => retryId ? current.map((turn) => turn.id === retryId ? { id, question: clean } : turn) : [...current, { id, question: clean }]);
    if (!retryId) setDraft("");
    setPhase("requesting"); setVisible(Infinity);
    try {
      const response = await fetch("/api/assistant/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ locale, messages: history }), signal: abortController.signal, cache: "no-store" });
      const body = await response.json();
      if (currentRequest !== requestId.current) return;
      if (!response.ok) {
        const allowed: AssistantErrorCode[] = ["not_configured", "invalid_request", "body_too_large", "forbidden", "rate_limited", "busy", "cancelled", "timeout", "invalid_answer", "upstream_error"];
        const code: AssistantErrorCode = allowed.includes(body?.error?.code) ? body.error.code : "upstream_error";
        setTurns((current) => current.map((turn) => turn.id === id ? { ...turn, error: code } : turn));
        setPhase("idle"); return;
      }
      const result = body as AssistantResult;
      if (!result?.answer || !Array.isArray(result.answer.knowledge) || typeof result.answer.general !== "string" || !Array.isArray(result.sources)) throw new Error("Invalid response");
      setTurns((current) => current.map((turn) => turn.id === id ? { ...turn, result } : turn));
      const total = result.answer.knowledge.reduce((sum, paragraph) => sum + paragraph.text.length, result.answer.general.length);
      if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches || total === 0) { setPhase("idle"); return; }
      setRevealingId(id); setVisible(0); setPhase("revealing");
      let count = 0;
      revealTimer.current = setInterval(() => {
        if (currentRequest !== requestId.current) { clearReveal(); return; }
        count += 18;
        setVisible(count);
        if (count >= total) { clearReveal(); setVisible(Infinity); setPhase("idle"); }
      }, 24);
    } catch {
      if (currentRequest !== requestId.current) return;
      setTurns((current) => current.map((turn) => turn.id === id ? { ...turn, error: abortController.signal.aborted ? "cancelled" : "upstream_error" } : turn));
      setPhase("idle");
    } finally { if (currentRequest === requestId.current) controller.current = null; }
  }
  function keyboard(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") { event.preventDefault(); close(); }
    if (event.key === "Tab" && mobile) {
      const controls = [...panel.current!.querySelectorAll<HTMLElement>('button:not([disabled]), textarea, a[href], summary')].filter((element) => !element.hidden && getComputedStyle(element).display !== "none");
      const first = controls[0], last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  }
  return <div className="ga-assistant-root" data-gadews-assistant>
    <button ref={launcher} type="button" className="ga-launcher" hidden={open || blocked} aria-label={t("打开知识助手", "Open knowledge assistant")} aria-expanded={open} aria-controls="gadews-assistant-panel" onClick={show}><span><MessageCircle aria-hidden="true" size={22} /></span>{t("知识助手", "Ask GADEWS")}</button>
    {open && !blocked && <aside ref={panel} id="gadews-assistant-panel" className={`ga-panel${wide ? " ga-wide" : ""}`} role="dialog" aria-modal={mobile} aria-labelledby="gadews-assistant-title" onKeyDown={keyboard}>
      <header className="ga-header"><div className="ga-emblem"><MessageCircle aria-hidden="true" size={25} /></div><h2 id="gadews-assistant-title">{t("GADEWS 知识助手", "GADEWS Assistant")}</h2><div className="ga-head-actions"><button type="button" aria-label={t("新对话", "New conversation")} title={t("新对话", "New conversation")} onClick={fresh}><Plus size={19} aria-hidden="true" /></button><button type="button" className="ga-expand" aria-label={wide ? t("恢复宽度", "Restore width") : t("放大阅读", "Expand reading")} onClick={() => setWide(!wide)}>{wide ? <Minimize2 size={17} aria-hidden="true" /> : <Maximize2 size={17} aria-hidden="true" />}</button><button type="button" aria-label={t("收起助手", "Close assistant")} onClick={close}><Minus size={21} aria-hidden="true" /></button></div></header>
      <div ref={messages} className="ga-messages" aria-label={t("本次对话", "Current conversation")} aria-busy={phase === "requesting"}>
        {!turns.length && <div className="ga-welcome"><div className="ga-welcome-mark"><MessageCircle size={30} aria-hidden="true" /></div><h3>{t("关于水生动物健康，\n你想了解什么？", "What would you like to know about aquatic health?")}</h3><p>{t("从文献摘要和项目资料中查找依据，也可以补充一般知识。", "Find evidence in literature abstracts and project materials, with clearly marked general information.")}</p><div className="ga-suggestions">{[t("白斑病有哪些早期观察信号？", "What are early signs of white spot disease?"), t("罗非鱼链球菌病与水温有什么关系？", "How is tilapia streptococcosis related to water temperature?")].map((question) => <button type="button" key={question} onClick={() => { setDraft(question); input.current?.focus(); }}>{question}<span aria-hidden="true">↗</span></button>)}</div><p className="ga-welcome-note">{t("按来源区分摘要、规则原型和未签署草案。回答不代替实验室诊断。", "Sources distinguish abstracts, prototypes and unsigned drafts. Answers do not replace laboratory diagnosis.")}</p></div>}
        {turns.map((turn) => <div className="ga-turn" key={turn.id}><p className="ga-question">{turn.question}</p>{turn.result && <AssistantContent result={turn.result} visibleCharacters={turn.id === revealingId ? visible : Infinity} />}{turn.error && <div className="ga-error" role="alert"><p>{errorText(turn.error)}</p><button type="button" onClick={() => void ask(turn.question, turn.id)} disabled={phase === "requesting"}>{t("重试", "Retry")}</button></div>}</div>)}
        {phase === "requesting" && <p className="ga-status" role="status"><span aria-hidden="true" />{t("正在检索并生成回答…", "Retrieving evidence and generating an answer…")}</p>}
        {phase === "revealing" && <p className="ga-status" role="status">{t("回答已校验，正在逐字显示。", "Answer validated. Revealing text.")}</p>}
      </div>
      <div className="ga-composer-wrap"><form className="ga-composer" onSubmit={(event) => { event.preventDefault(); void ask(draft); }}><textarea ref={input} aria-label={t("输入问题", "Your question")} placeholder={t("输入你想了解的问题…", "Ask about aquatic animal health…")} rows={2} maxLength={2000} value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void ask(draft); } }} /><div className="ga-composer-actions"><span>{draft.length}/2000</span>{phase === "requesting" ? <button type="button" className="ga-stop" aria-label={t("停止请求", "Stop request")} onClick={stop}><Square size={14} aria-hidden="true" />{t("停止", "Stop")}</button> : phase === "revealing" ? <button type="button" className="ga-stop" onClick={showFull}>{t("显示全文", "Show full answer")}</button> : <button type="submit" className="ga-send" aria-label={t("发送问题", "Send question")} disabled={!draft.trim()}><ArrowUp size={20} aria-hidden="true" /></button>}</div></form><p className="ga-session-note">{t("仅保留本次会话 · 刷新后清空", "This session only · cleared on refresh")}</p></div>
    </aside>}
  </div>;
}
