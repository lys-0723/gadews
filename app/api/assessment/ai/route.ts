import { isDeepStrictEqual } from "node:util";
import { createAiAssessmentHandler } from "@/lib/gadews/ai-assessment/handler";
import { sharedModelBudget } from "@/lib/gadews/assistant/runtime";
import { modelGate, reply } from "@/lib/accounts/http";
import { WSD_WORKBENCH_EXAMPLE } from "@/components/gadews/warning-tools/warning-fields";
import { createTilapiaDraftExamplePacket } from "@/lib/gadews/tilapia-assessment";
import { tilapiaExampleToForm, tilapiaFormToInput } from "@/components/gadews/warning-tools/tilapia-form";

export const runtime = "nodejs";
export const maxDuration = 65;
export const POST = createAiAssessmentHandler({
  budget: sharedModelBudget,
  async authorize(request, parsed) {
    const denied = await modelGate(request, parsed.standardId);
    if (denied) return denied;
    // The public workbench only evaluates its built-in public sample online.
    // Restricted records are resolved server-side in the accounts endpoint.
    const packet = createTilapiaDraftExamplePacket();
    const expected =
      parsed.diseaseId === "wsd"
        ? WSD_WORKBENCH_EXAMPLE
        : tilapiaFormToInput(tilapiaExampleToForm(packet.input));
    const context =
      parsed.diseaseId === "wsd"
        ? { dataMode: "example" }
        : { dataMode: "draft-preview", now: packet.context.now, inputProvenance: { exampleDerived: false } };
    if (
      !isDeepStrictEqual(parsed.input, JSON.parse(JSON.stringify(expected))) ||
      !isDeepStrictEqual(parsed.context, context)
    ) {
      return reply({ error: { code: "sample_required" } }, 403);
    }
    return null;
  },
});
