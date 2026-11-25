import { timingSafeEqual } from "node:crypto";

function readPresentedSecret(request: Request): string | null {
  const authorization = request.headers.get("authorization");
  if (authorization?.toLowerCase().startsWith("bearer ")) {
    return authorization.slice(7).trim();
  }
  return (
    request.headers.get("x-api-key") ??
    request.headers.get("x-collector-secret")
  );
}

function secretsMatch(presented: string | null, expected: string): boolean {
  if (!presented) return false;
  const left = Buffer.from(presented);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function authorizeReadRequest(request: Request): Response | null {
  const expected = process.env.AQUACULTURE_API_KEY?.trim();
  if (!expected) {
    if (process.env.NODE_ENV === "production") {
      return Response.json(
        { error: "AQUACULTURE_API_KEY is not configured" },
        { status: 503 }
      );
    }
    return null;
  }

  if (!secretsMatch(readPresentedSecret(request), expected)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

export function authorizeCollectorRequest(request: Request): Response | null {
  const expected = process.env.COLLECTOR_SECRET?.trim();
  if (!expected) {
    return Response.json(
      { error: "COLLECTOR_SECRET is not configured" },
      { status: 503 }
    );
  }
  if (!secretsMatch(readPresentedSecret(request), expected)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
