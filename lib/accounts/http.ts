import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AiRuntimeError } from "../gadews/assistant/runtime";
import { AccountError, type Model } from "./policy";
import { authorize, sessionCookie } from "./service";
import { accountDb } from "./storage";
export function tokenOf(request: Request) {
  const entry = (request.headers.get("cookie") ?? "")
    .split(";")
    .map((v) => v.trim())
    .find((v) => v.startsWith(sessionCookie + "="));
  return entry?.slice(sessionCookie.length + 1) ?? "";
}
export function reply(value: unknown, status = 200) {
  return NextResponse.json(value, { status, headers: { "Cache-Control": "private, no-store" } });
}
export function errorReply(error: unknown) {
  if (error instanceof AccountError) return reply({ error: { code: error.code } }, error.status);
  if (error instanceof ZodError || error instanceof SyntaxError || error instanceof AiRuntimeError)
    return reply({ error: { code: "invalid_request" } }, 400);
  return reply({ error: { code: "store_unavailable" } }, 503);
}
export async function modelGate(request: Request, model: Model) {
  try {
    if (!tokenOf(request)) throw new AccountError(401, "login_required");
    await authorize(await accountDb(), tokenOf(request), model);
    return null;
  } catch (error) {
    return errorReply(error);
  }
}
