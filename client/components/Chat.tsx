"use client";

import { ArrowUp, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import Markdown from "react-markdown";

import type { ChatMessage } from "@/lib/db";
import { ACTION_HREF, actionMessage, parseActions, type Verdict } from "@/lib/finance";

import { useSymbole } from "./Currency";
import { useToast } from "./Toast";

type ErrorKind = "unreachable" | "busy" | "upstream";

type Msg = ChatMessage | { role: "error"; kind: ErrorKind; question: string };

function errorKind(code: unknown): ErrorKind {
  return code === "unreachable" || code === "busy" ? code : "upstream";
}

const VERDICT_NOTE: Record<Verdict, string> = {
  Acheter: "Ton budget l’encaisse.",
  Attendre: "Possible, mais pas maintenant.",
  Éviter: "Ce mois-ci, ça ferait mal.",
};

export function Chat({
  conversationId: sessionId,
  initialMessages,
  suggestions,
  initialQuestion = "",
}: {
  conversationId: string;
  initialMessages: ChatMessage[];
  suggestions: string[];
  initialQuestion?: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [msgs, setMsgs] = useState<Msg[]>(initialMessages);
  const symbole = useSymbole();
  const [draft, setDraft] = useState(initialQuestion);
  const [busy, setBusy] = useState(false);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const firstScroll = useRef(true);

  useEffect(() => {
    // On défile dans la conversation seulement, pas la page. À l'ouverture : directement en bas.
    const el = transcriptRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: firstScroll.current ? "instant" : "smooth" });
    firstScroll.current = false;
  }, [msgs, busy]);

  const ask = useCallback(
    async (question: string, retry = false) => {
      const q = question.trim();
      if (!q || busy) return;
      setBusy(true);
      setDraft("");
      setMsgs((m) => (retry ? m.filter((x) => x.role !== "error") : [...m, { role: "user", text: q }]));
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: q, sessionId }),
        });
        const data = await res.json();
        if (!res.ok) {
          setMsgs((m) => [...m, { role: "error", kind: errorKind(data.error), question: q }]);
        } else {
          setMsgs((m) => [...m, { role: "assistant", text: data.reply, verdict: data.verdict }]);
          for (const a of parseActions(data.actions)) {
            toast({ message: actionMessage(a), action: { label: "Voir", href: ACTION_HREF[a.target] } });
          }
          // L'échange est enregistré : on fixe la conversation dans l'URL et on met l'historique à jour.
          router.replace(`/assistant?c=${sessionId}`, { scroll: false });
        }
      } catch {
        setMsgs((m) => [...m, { role: "error", kind: "unreachable", question: q }]);
      } finally {
        setBusy(false);
        inputRef.current?.focus();
      }
    },
    [busy, sessionId, router, toast],
  );

  return (
    <section className="chat" aria-label="Conversation avec l’assistant">
      <div ref={transcriptRef} className="transcript" aria-live="polite">
        {msgs.length === 0 && (
          <div className="a">
            <p>
              Dis-moi ce que tu veux acheter et combien ça coûte. Je regarde ce qu’il te reste ce mois-ci et je te réponds
              <strong> Acheter</strong>, <strong>Attendre</strong> ou <strong>Éviter</strong>, chiffres à l’appui.
            </p>
            <div className="suggestions">
              {suggestions.map((s) => (
                <button key={s} type="button" className="suggestion" onClick={() => ask(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {msgs.map((m, i) => {
          if (m.role === "user") return <p key={i} className="q">{m.text}</p>;
          if (m.role === "error")
            return (
              <div key={i} className="error-slip" role="alert">
                {m.kind === "unreachable" ? (
                  <>
                    <p>
                      <strong>Le service IA ne répond pas.</strong> Lance-le dans un terminal, puis réessaie :
                    </p>
                    <pre className="m-0 overflow-x-auto rounded-ticket bg-plate p-3 font-mono text-[0.8rem] text-vfd">
                      {"cd agent\n.venv\\Scripts\\activate\npython main.py"}
                    </pre>
                  </>
                ) : m.kind === "busy" ? (
                  <p>
                    <strong>Le modèle IA est surchargé en ce moment.</strong> C’est temporaire : réessaie dans quelques
                    instants.
                  </p>
                ) : (
                  <p>
                    <strong>Le service IA a renvoyé une erreur.</strong> Vérifie ta clé GOOGLE_API_KEY dans agent/.env, puis réessaie.
                  </p>
                )}
                <div>
                  <button type="button" className="btn btn-ghost" onClick={() => ask(m.question, true)} disabled={busy}>
                    <RotateCcw size={15} aria-hidden /> Réessayer
                  </button>
                </div>
              </div>
            );
          return (
            <div key={i} className="a">
              <div className="md">
                <Markdown>{m.text}</Markdown>
              </div>
              {m.verdict && (
                <div className="verdict-stub">
                  <span className={`verdict-word v-${m.verdict}`}>{m.verdict}</span>
                  <span>{VERDICT_NOTE[m.verdict]}</span>
                </div>
              )}
            </div>
          );
        })}

        {busy && (
          <p className="thinking" role="status">
            <i />
            <i />
            <i /> L’assistant fait le calcul…
          </p>
        )}
      </div>

      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault();
          ask(draft);
        }}
      >
        <label className="field flex-1">
          <span className="sr-only">Ta question</span>
          <textarea
            ref={inputRef}
            autoFocus={Boolean(initialQuestion)}
            className="textarea"
            rows={2}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                ask(draft);
              }
            }}
            placeholder={`Ex. : Est-ce que je peux m’acheter un ordinateur à 900 ${symbole} ?`}
          />
        </label>
        <button className="btn btn-primary" type="submit" disabled={busy || !draft.trim()}>
          <ArrowUp size={16} strokeWidth={2.5} aria-hidden /> Demander
        </button>
      </form>
    </section>
  );
}

export function ServiceStatus() {
  const [up, setUp] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    const check = () =>
      fetch("/api/health")
        .then((r) => r.json())
        .then((d) => alive && setUp(Boolean(d.up)))
        .catch(() => alive && setUp(false));
    check();
    const t = setInterval(check, 15_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);
  return (
    <span className={`status${up === true ? " is-up" : up === false ? " is-down" : ""}`} role="status">
      {up === null ? "Vérification du service IA…" : up ? "Service IA en ligne" : "Service IA hors ligne"}
    </span>
  );
}
