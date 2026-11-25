import { createAiAssessmentHandler } from "@/lib/gadews/ai-assessment/handler";
import { sharedModelBudget } from "@/lib/gadews/assistant/runtime";
export const runtime = "nodejs";
export const maxDuration = 65;
export const POST = createAiAssessmentHandler({ budget: sharedModelBudget });
