import { revalidatePath } from "next/cache";

import { appendMessages, setSetting } from "@/lib/db";
import { ACTION_HREF, conversationTitle, extractVerdict, isConversationId, parseActions } from "@/lib/finance";
import { currentContext } from "@/lib/summary";

const AI = process.env.AI_SERVICE_URL ?? "http://localhost:8000";

export async function POST(req: Request) {
  const { message, sessionId } = (await req.json()) as { message?: string; sessionId?: string };
  const question = (message ?? "").trim();
  if (!question) return Response.json({ error: "empty" }, { status: 400 });
  if (!isConversationId(sessionId)) return Response.json({ error: "session" }, { status: 400 });

  let res: Response;
  try {
    res = await fetch(`${AI}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: question, context: await currentContext(), session_id: sessionId }),
      signal: AbortSignal.timeout(90_000),
    });
  } catch {
    return Response.json({ error: "unreachable" }, { status: 503 });
  }
  // 503 : le modèle Gemini est surchargé (temporaire), le service lui-même fonctionne.
  if (res.status === 503) return Response.json({ error: "busy" }, { status: 503 });
  if (!res.ok) return Response.json({ error: "upstream", status: res.status }, { status: 502 });

  const data = (await res.json()) as { reply: string; actions?: unknown };
  const reply = data.reply;
  const actions = parseActions(data.actions);
  const verdict = extractVerdict(reply);
  await appendMessages(sessionId, conversationTitle(question), [
    { role: "user", text: question },
    { role: "assistant", text: reply, verdict },
  ]);
  if (verdict) {
    await setSetting("dernier_avis", JSON.stringify({ question, verdict, at: new Date().toISOString() }));
    revalidatePath("/");
  }
  // L'agent a modifié des données : les pages qui les affichent doivent être recalculées.
  for (const target of new Set(actions.map((a) => a.target))) revalidatePath(ACTION_HREF[target]);
  revalidatePath("/assistant");
  return Response.json({ reply, verdict, actions });
}
