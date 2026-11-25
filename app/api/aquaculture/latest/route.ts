import { NextResponse } from "next/server";
import { authorizeReadRequest } from "@/lib/aquaculture/auth";
import { queryLatestAquacultureObservations } from "@/lib/aquaculture/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const unauthorized = authorizeReadRequest(request);
  if (unauthorized) return unauthorized;

  try {
    const url = new URL(request.url);
    const observations = await queryLatestAquacultureObservations(
      url.searchParams.get("siteId") ?? undefined
    );
    return NextResponse.json(
      { data: observations, count: observations.length },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Failed to query latest aquaculture observations", error);
    return NextResponse.json(
      { error: "Failed to query latest aquaculture observations" },
      { status: 500 }
    );
  }
}
