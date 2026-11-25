import { sharedModelBudget } from "@/lib/gadews/assistant/runtime";
import { assistantCorpus } from "@/lib/gadews/assistant/corpus-data";
import { createAssistantHandler } from "@/lib/gadews/assistant/handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 45;
export const POST = createAssistantHandler({ budget: sharedModelBudget, getCorpus: () => assistantCorpus });
