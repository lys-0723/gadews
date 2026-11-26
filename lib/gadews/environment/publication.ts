import "server-only";
import initial from "@/public/data/environment/snapshot.json";
import { schema, type Snapshot } from "@/lib/gadews/environment/snapshot";

const seed = schema.parse(initial);
const published = "https://raw.githubusercontent.com/lys-0723/gadews/environment-data/forecasts-v2.json";
let latest: Snapshot = seed;
export async function readEnvironment() {
  let origin: "bundled" | "cached" | "published" = latest === seed ? "bundled" : "cached";
  try {
    const response = await fetch(published, { next: { revalidate: 600 }, signal: AbortSignal.timeout(5000) });
    if (response.ok) {
      const candidate = schema.parse(await response.json());
      if (Date.parse(candidate.publishedAt) >= Date.parse(latest.publishedAt)) {
        latest = candidate;
        origin = "published";
      }
    }
  } catch {
    /* Serve the most recent validated local version while the upstream cache is unavailable. */
  }
  return { snapshot: latest, origin, asOf: Date.now() };
}
