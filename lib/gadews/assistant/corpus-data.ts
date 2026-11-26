// This module is only imported by the server route. The explicit boundary prevents client bundling.
import "server-only";
import literature from "@/public/data/literature.json";
import wsd from "@/public/data/models/wsd-warning-model.json";
import tilapia from "@/public/data/knowledge/tilapia-streptococcosis.json";
import { buildAssistantCorpus } from "./corpus";

export const assistantCorpus = buildAssistantCorpus({ literature, wsd, tilapia });
