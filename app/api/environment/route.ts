import { readEnvironment } from "@/lib/gadews/environment/publication";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  return Response.json(await readEnvironment(), {
    headers: { "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600" },
  });
}
