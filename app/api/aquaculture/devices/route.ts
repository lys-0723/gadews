import { NextResponse } from "next/server";
import { authorizeReadRequest } from "@/lib/aquaculture/auth";
import { queryAquacultureDevices } from "@/lib/aquaculture/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const unauthorized = authorizeReadRequest(request);
  if (unauthorized) return unauthorized;

  try {
    const devices = await queryAquacultureDevices();
    return NextResponse.json(
      { data: devices, count: devices.length },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Failed to query aquaculture devices", error);
    return NextResponse.json(
      { error: "Failed to query aquaculture devices" },
      { status: 500 }
    );
  }
}
