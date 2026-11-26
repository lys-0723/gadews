import { z } from "zod";
import { aggregateScores } from "./wsd-rubric";
import type { ComparisonBaseline, ProposalValidation, ScoringDifference, ScoringProposal, ScoringRubric } from "./types";

const itemSchema = z.object({
  itemId: z.string().min(1).max(100), branchId: z.string().min(1).max(100).nullable(),
  status: z.enum(["matched", "unknown", "conflict", "unsupported"]),
  score: z.number().finite().min(0).max(1000).nullable(), reason: z.string().min(1).max(120),
}).strict().refine(item => item.status === "matched" ? item.score !== null && item.branchId !== null : item.score === null && item.branchId === null);
const schema = z.object({ items: z.array(itemSchema).min(1).max(32), generalSupplement: z.string().max(2000) }).strict();
export function validateScoringProposal(text: string, rubric: ScoringRubric, baseline: ComparisonBaseline): { proposal: ScoringProposal; validation: ProposalValidation; differences: ScoringDifference[] } {
  if (text.length > 60000) throw new Error("Scoring answer exceeds limit");
  const proposal = schema.parse(JSON.parse(text));
  const seen = new Set<string>(), differences: ScoringDifference[] = [];
  const verified: { module: string; score: number | null }[] = [];
  for (const row of proposal.items) {
    const item = rubric.items.find(item => item.id === row.itemId);
    if (!item || seen.has(row.itemId)) throw new Error("Unknown or duplicate criterion");
    seen.add(row.itemId);
    const branch = item.branches.find(branch => branch.id === row.branchId);
    if (row.branchId !== null && !branch) throw new Error("Unknown criterion branch");
    const expected = baseline.items.find(item => item.itemId === row.itemId);
    if (!expected) throw new Error("No independently verifiable criterion");
    if (branch && branch.score !== row.score) differences.push({ itemId: row.itemId, code: "invalid_points", message: "Proposed points differ from this standard branch." });
    else if (row.status !== expected.status || row.branchId !== expected.branchId || row.score !== expected.score) differences.push({ itemId: row.itemId, code: "condition_mismatch", message: "Proposed branch or state differs from the independently checked input." });
    else verified.push({ module: item.module, score: row.score });
  }
  for (const item of rubric.items) if (!seen.has(item.id)) differences.push({ itemId: item.id, code: "missing_item", message: "The model omitted this applicable criterion." });
  const complete = differences.length === 0 && baseline.completeScore !== null;
  return { proposal, differences, validation: {
    state: differences.length ? "needs_review" : complete ? "consistent" : "partial",
    knownSubtotal: aggregateScores(verified, rubric), completeScore: complete ? baseline.completeScore : null,
    level: complete ? baseline.level : null,
  } };
}
