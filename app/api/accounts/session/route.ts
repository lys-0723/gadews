import { errorReply, reply, tokenOf } from "@/lib/accounts/http";
import { AccountError } from "@/lib/accounts/policy";
import { sessionIdentity } from "@/lib/accounts/service";
import { accountDb } from "@/lib/accounts/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const token = tokenOf(request);
    return reply(token ? await sessionIdentity(await accountDb(), token) : null);
  } catch (error) {
    if (error instanceof AccountError && error.code === "login_required") return reply(null);
    return errorReply(error);
  }
}
