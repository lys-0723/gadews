import { modelGate } from "@/lib/accounts/http";
import { sharedModelBudget } from "@/lib/gadews/assistant/runtime";
import { assistantCorpus } from "@/lib/gadews/assistant/corpus-data";
import { createAssistantHandler } from "@/lib/gadews/assistant/handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 45;
const chat = createAssistantHandler({ budget: sharedModelBudget, getCorpus: () => assistantCorpus });

export async function POST(request: Request) {
  return (await modelGate(request, "knowledge-chat-v1")) ?? chat(request);
}
