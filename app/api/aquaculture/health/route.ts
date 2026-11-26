import { NextResponse } from "next/server";
import { authorizeReadRequest } from "@/lib/aquaculture/auth";
import { getAquacultureDatabaseHealth } from "@/lib/aquaculture/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const unauthorized = authorizeReadRequest(request);
  if (unauthorized) return unauthorized;

  try {
    const health = await getAquacultureDatabaseHealth();
    return NextResponse.json(
      { status: "ok", ...health },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Aquaculture database health check failed", error);
    return NextResponse.json(
      { status: "error", error: "Aquaculture database is unavailable" },
      { status: 503 }
    );
  }
}
