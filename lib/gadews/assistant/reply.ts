import { z } from "zod";
import type { AssistantResult, AssistantSource } from "./types";

const schema = z.object({
  knowledge: z.array(z.object({ text: z.string().trim().min(1).max(4000), sourceIds: z.array(z.string().trim().min(1).max(160)).min(1).max(3) }).strict()).max(6),
  general: z.string().trim().max(8000),
}).strict();
export function parseAssistantReply(text: string, retrieved: readonly AssistantSource[]): AssistantResult {
  if (text.length > 24000) throw new Error("Invalid assistant answer");
  const answer = schema.parse(JSON.parse(text));
  if (!answer.knowledge.length && !answer.general) throw new Error("Empty assistant answer");
  const whitelist = new Map(retrieved.map((source) => [source.id, source]));
  const ids = new Set<string>();
  for (const paragraph of answer.knowledge) {
    paragraph.sourceIds = [...new Set(paragraph.sourceIds)];
    for (const id of paragraph.sourceIds) {
      if (!whitelist.has(id)) throw new Error("Invalid assistant citation");
      ids.add(id);
    }
  }
  return { answer, sources: [...ids].map((id) => whitelist.get(id)!) };
}
