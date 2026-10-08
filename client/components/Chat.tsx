"use client";

import { ArrowUp, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import Markdown from "react-markdown";

import type { Verdict } from "@/lib/finance";

type Msg =
  | { role: "user"; text: string }
  | { role: "assistant"; text: string; verdict: Verdict | null }
  | { role: "error"; kind: "unreachable" | "upstream"; question: string };

const STORE = "fm-chat";

const VERDICT_NOTE: Record<Verdict, string> = {
  Acheter: "Ton budget l’encaisse.",
  Attendre: "Possible, mais pas maintenant.",
  Éviter: "Ce mois-ci, ça ferait mal.",
};

function useSessionId() {
  const [id, setId] = useState("web");
  useEffect(() => {
    try {
      let v = sessionStorage.getItem("fm-session");
      if (!v) {
        v = `web-${Math.random().toString(36).slice(2, 10)}`;
        sessionStorage.setItem("fm-session", v);
      }
      setId(v);
    } catch {
      /* stockage indisponible : session par défaut */
    }
  }, []);
  return id;
}

export function Chat({ suggestions }: { suggestions: string[] }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [restored, setRestored] = useState(false);
  const sessionId = useSessionId();
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORE);
      if (raw) setMsgs(JSON.parse(raw));
    } catch {
      /* rien à restaurer */
    }
    setRestored(true);
  }, []);

  useEffect(() => {
    // Avant la restauration, msgs vaut [] : l'écrire effacerait la conversation sauvegardée.
    if (restored) {
      try {
        sessionStorage.setItem(STORE, JSON.stringify(msgs));
      } catch {
        /* ignore */
      }
    }
    endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [msgs, busy, restored]);

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
          setMsgs((m) => [...m, { role: "error", kind: data.error === "unreachable" ? "unreachable" : "upstream", question: q }]);
        } else {
          setMsgs((m) => [...m, { role: "assistant", text: data.reply, verdict: data.verdict }]);
        }
      } catch {
        setMsgs((m) => [...m, { role: "error", kind: "unreachable", question: q }]);
      } finally {
        setBusy(false);
        inputRef.current?.focus();
      }
    },
    [busy, sessionId],
  );

  return (
    <section className="chat" aria-label="Conversation avec l’assistant">
      <div className="transcript" aria-live="polite">
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
                      {"cd ai-service\n.venv\\Scripts\\activate\npython agent.py"}
                    </pre>
                  </>
                ) : (
                  <p>
                    <strong>Le service IA a renvoyé une erreur.</strong> Vérifie ta clé GOOGLE_API_KEY dans ai-service/.env, puis réessaie.
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
        <div ref={endRef} />
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
            placeholder="Ex. : Est-ce que je peux m’acheter un ordinateur à 900 € ?"
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
