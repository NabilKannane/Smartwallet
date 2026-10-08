import { revalidatePath } from "next/cache";

import { setSetting } from "@/lib/db";
import { extractVerdict } from "@/lib/finance";
import { currentContext } from "@/lib/summary";

const AI = process.env.AI_SERVICE_URL ?? "http://localhost:8000";

export async function POST(req: Request) {
  const { message, sessionId } = (await req.json()) as { message?: string; sessionId?: string };
  const question = (message ?? "").trim();
  if (!question) return Response.json({ error: "empty" }, { status: 400 });

  let res: Response;
  try {
    res = await fetch(`${AI}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: question, context: await currentContext(), session_id: sessionId ?? "web" }),
      signal: AbortSignal.timeout(90_000),
    });
  } catch {
    return Response.json({ error: "unreachable" }, { status: 503 });
  }
  if (!res.ok) return Response.json({ error: "upstream", status: res.status }, { status: 502 });

  const { reply } = (await res.json()) as { reply: string };
  const verdict = extractVerdict(reply);
  if (verdict) {
    await setSetting("dernier_avis", JSON.stringify({ question, verdict, at: new Date().toISOString() }));
    revalidatePath("/");
  }
  return Response.json({ reply, verdict });
}
