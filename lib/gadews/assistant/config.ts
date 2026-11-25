export interface AssistantConfig {
  apiKey: string;
  baseURL: string;
  model: string;
  protocol: "responses" | "chat-completions";
}
export function readAssistantConfig(env: Record<string, string | undefined>): AssistantConfig {
  const protocol = env.GADEWS_AI_PROTOCOL || "responses";
  if (protocol !== "responses" && protocol !== "chat-completions") throw new Error("Invalid assistant configuration");
  const baseURL = env.GADEWS_AI_BASE_URL || "https://ai.allrealai.com/v1";
  const url = new URL(baseURL);
  if (url.username || url.password || url.search || url.hash || !(url.protocol === "https:" || (url.protocol === "http:" && ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)))) throw new Error("Invalid assistant configuration");
  const model = env.GADEWS_AI_MODEL || "deepseek-v4.1-flash-1017";
  if (!model.trim() || model.length > 200 || /[\r\n]/.test(model)) throw new Error("Invalid assistant configuration");
  return { apiKey: (env.GADEWS_AI_API_KEY || "").trim(), baseURL: baseURL.replace(/\/$/, ""), model, protocol };
}
