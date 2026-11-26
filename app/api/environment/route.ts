import initial from "@/public/data/environment/snapshot.json";
import { schema, type Snapshot } from "@/lib/gadews/environment/snapshot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const seed = schema.parse(initial);
const published = "https://raw.githubusercontent.com/lys-0723/gadews/environment-data/snapshot.json";
let latest: Snapshot = seed;
export async function GET() {
  let origin: "bundled" | "published" = latest === seed ? "bundled" : "published";
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
  return Response.json(
    { snapshot: latest, origin, asOf: Date.now() },
    { headers: { "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600" } },
  );
}
