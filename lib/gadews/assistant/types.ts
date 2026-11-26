/** Shared wire types only. Never import corpus-data or server configuration into clients. */
export interface AssistantSource {
  id: string;
  title: string;
  text: string;
  href: string;
  kind: "literature" | "wsd" | "tilapia";
  accessLevel: string;
  limitations: string;
  year?: number;
}
export interface AssistantMessage { role: "user" | "assistant"; content: string }
export interface AssistantAnswer { knowledge: { text: string; sourceIds: string[] }[]; general: string }
export interface AssistantResult { answer: AssistantAnswer; sources: AssistantSource[] }
export interface AssistantRequest { locale: "zh-CN" | "en"; messages: AssistantMessage[] }
export type AssistantErrorCode = "login_required" | "model_denied" | "invalid_request" | "body_too_large" | "forbidden" | "not_configured" | "rate_limited" | "busy" | "cancelled" | "timeout" | "invalid_answer" | "upstream_error";
