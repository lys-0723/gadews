import { z } from "zod";
import { AiRuntimeError, createModelBudget, hasSameOrigin, readBoundedJson, runModelCall, type ModelBudget } from "./runtime";
import { readAssistantConfig, type AssistantConfig } from "./config";
import { generateAssistantText } from "./provider";
import { parseAssistantReply } from "./reply";
import { contextualAssistantQuery, retrieveAssistantSources } from "./retrieval";
import type { AssistantErrorCode, AssistantRequest, AssistantSource } from "./types";

const requestSchema = z.object({ locale: z.enum(["zh-CN", "en"]), messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(2000).refine((text) => text.trim().length > 0) }).strict()).min(1).max(12) }).strict().refine((value) => value.messages.at(-1)?.role === "user" && value.messages.reduce((sum, message) => sum + message.content.length, 0) <= 12000);
const messages: Record<AssistantErrorCode, string> = {
  login_required: "Sign in to use the model.", model_denied: "Model access has not been granted.",
  invalid_request: "问题格式无效，请缩短内容后重试。 Invalid request; shorten the conversation.",
  body_too_large: "请求过大。 Request exceeds 64 KiB.",
  forbidden: "仅接受本站发起的请求。 Same-origin requests required.",
  not_configured: "知识助手尚未配置，需由站点管理员在服务端配置。 Assistant is not configured on the server.",
  rate_limited: "请求频繁，请稍后重试。 Too many requests; try again shortly.",
  busy: "助手当前繁忙，请稍后重试。 Assistant is busy; try again shortly.",
  cancelled: "请求已停止。 Request cancelled.",
  timeout: "回答超时，请重试。 Answer timed out; please retry.",
  invalid_answer: "回答未通过来源校验，请重试。 Answer failed source validation; please retry.",
  upstream_error: "模型服务暂时不可用，请重试。 Model service is unavailable; please retry.",
};
function fail(status: number, code: AssistantErrorCode): Response {
  return Response.json({ error: { code, message: messages[code] } }, { status, headers: { "cache-control": "no-store", ...(status === 429 ? { "retry-after": "60" } : {}) } });
}
interface Dependencies {
  env?: Record<string, string | undefined>;
  getCorpus: () => readonly AssistantSource[];
  generate?: (config: AssistantConfig, request: AssistantRequest, sources: readonly AssistantSource[], signal: AbortSignal) => Promise<string>;
  now?: () => number;
  budget?: ModelBudget;
  /** Short injected deadline for deterministic local tests; production always uses 40 s. */
  timeoutMs?: number;
}
export function createAssistantHandler(dependencies: Dependencies) {
  const env = dependencies.env ?? process.env;
  const generate = dependencies.generate ?? generateAssistantText;
  const budget = dependencies.budget ?? createModelBudget(dependencies.now);
  return async (request: Request): Promise<Response> => {
    if (request.method !== "POST") return fail(400, "invalid_request");
    if (!hasSameOrigin(request)) return fail(403, "forbidden");
    if (request.signal.aborted) return fail(499, "cancelled");
    let input: AssistantRequest;
    try { input = requestSchema.parse(await readBoundedJson(request)); } catch (error) { return request.signal.aborted ? fail(499, "cancelled") : fail(error instanceof AiRuntimeError && error.code === "body_too_large" ? 413 : 400, error instanceof AiRuntimeError && error.code === "body_too_large" ? "body_too_large" : "invalid_request"); }
    let config: AssistantConfig;
    try { config = readAssistantConfig(env); } catch { return fail(503, "not_configured"); }
    if (!config.apiKey) return fail(503, "not_configured");
    try {
      const retrieved = retrieveAssistantSources(contextualAssistantQuery(input.messages), dependencies.getCorpus());
      const text = await runModelCall(request, budget, env, dependencies.timeoutMs ?? 40000, signal => generate(config, input, retrieved, signal));
      try { return Response.json(parseAssistantReply(text, retrieved), { headers: { "cache-control": "no-store" } }); }
      catch { return fail(502, "invalid_answer"); }
    } catch (error) {
      if (error instanceof AiRuntimeError) {
        const status = error.code === "timeout" ? 504 : error.code === "cancelled" ? 499 : 429;
        return fail(status, error.code);
      }
      return fail(502, "upstream_error");
    }
  };
}
