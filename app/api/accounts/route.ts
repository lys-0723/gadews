import { z } from "zod";
import { hasSameOrigin, readBoundedJson, sharedModelBudget } from "@/lib/gadews/assistant/runtime";
import { createAiAssessmentHandler } from "@/lib/gadews/ai-assessment/handler";
import { AccountError, catalog } from "@/lib/accounts/policy";
import { accountDb } from "@/lib/accounts/storage";
import {
  approve,
  systemGrant,
  assign,
  authorize,
  dashboard,
  login,
  logout,
  register,
  sessionCookie,
  sessionSeconds,
} from "@/lib/accounts/service";
import { errorReply, reply, tokenOf } from "@/lib/accounts/http";
import { previewScore, sampleRequest } from "@/lib/accounts/samples";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 65;
const envelope = z
  .object({
    action: z.enum(["register", "login", "logout", "approve", "systemGrant", "assign", "detail", "preview", "ai"]),
    input: z.unknown().optional(),
  })
  .strict();
const sampleInput = z
  .object({ id: z.string().max(20), locale: z.enum(["zh-CN", "en"]).default("zh-CN") })
  .strict();
const compare = createAiAssessmentHandler({ budget: sharedModelBudget });
export async function GET(request: Request) {
  try {
    const token = tokenOf(request);
    return reply(token ? await dashboard(await accountDb(), token) : null);
  } catch (error) {
    return errorReply(error);
  }
}
export async function POST(request: Request) {
  if (!hasSameOrigin(request)) return reply({ error: { code: "forbidden" } }, 403);
  try {
    const { action, input } = envelope.parse(await readBoundedJson(request));
    const db = await accountDb(),
      token = tokenOf(request);
    if (action === "register") {
      await register(db, input);
      return reply({ registered: true }, 201);
    }
    if (action === "login" || action === "logout") {
      const value = action === "login" ? await login(db, input) : "";
      if (!value) await logout(db, token);
      const response = reply({ ok: true });
      response.cookies.set(sessionCookie, value, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: !!process.env.VERCEL || new URL(request.url).protocol === "https:",
        maxAge: value ? sessionSeconds : 0,
      });
      return response;
    }
    if (action === "approve") {
      await approve(db, token, input);
      return reply({ ok: true });
    }
    if (action === "systemGrant") {
      await systemGrant(db, token, input);
      return reply({ ok: true });
    }
    if (action === "assign") {
      await assign(db, token, input);
      return reply({ ok: true });
    }
    const { id, locale } = sampleInput.parse(input);
    const view = await dashboard(db, token);
    const record = catalog.find((r) => r.id === id);
    if (!record || !view.records.some((r) => r.id === id)) throw new AccountError(403, "record_denied");
    const payload = sampleRequest(record, locale);
    if (action === "detail") return reply({ record, inputVersion: "demo-1", input: payload.input });
    await authorize(db, token, record.model, record.id);
    if (action === "preview") return reply(previewScore(payload));
    const headers = new Headers(request.headers);
    headers.delete("content-length");
    return compare(
      new Request(request.url, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        signal: request.signal,
      }),
    );
  } catch (error) {
    return errorReply(error);
  }
}
