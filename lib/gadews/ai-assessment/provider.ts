import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";
import type { AssistantConfig } from "../assistant/config";
export interface ScoringPrompt { system: string; prompt: string; }
export async function generateScoringText(config: AssistantConfig, prompt: ScoringPrompt, signal: AbortSignal): Promise<string> {
  const provider = createOpenAI({ apiKey: config.apiKey, baseURL: config.baseURL });
  const model = config.protocol === "responses" ? provider.responses(config.model) : provider.chat(config.model);
  const result = await generateText({ model, system: prompt.system, prompt: prompt.prompt, maxOutputTokens: 6000, maxRetries: 0, abortSignal: signal });
  return result.text;
}
