import { z } from "zod";
import { monitoringFeedSchema, type MonitoringFeed } from "./monitoring-types";
export interface PublishedMonitoringFeed extends MonitoringFeed { deviceKey: string; }
export type MonitoringPublication = { status: "closed" | "invalid" } | { status: "published"; feeds: PublishedMonitoringFeed[] };
const publicationSchema = z.object({
  publish: z.literal(true),
  feeds: z.array(monitoringFeedSchema.extend({
    deviceKey: z.string().trim().min(1).max(128).refine((value) => !/[\u0000-\u001f\u007f]/.test(value)),
    unitVerificationRef: monitoringFeedSchema.shape.unitVerificationRef.optional().default(null),
  }).strict()).min(1).max(32),
}).strict();

export function readMonitoringPublication(env: Record<string, string | undefined>): MonitoringPublication {
  const raw = env.GADEWS_MONITORING_PUBLIC_FEEDS_JSON;
  if (!raw?.trim()) return { status: "closed" };
  try {
    const value: unknown = JSON.parse(raw);
    const parsed = publicationSchema.safeParse(value);
    if (!parsed.success || new Set(parsed.data.feeds.map((feed) => feed.id)).size !== parsed.data.feeds.length) return { status: "invalid" };
    return { status: "published", feeds: parsed.data.feeds };
  } catch {
    return { status: "invalid" };
  }
}
