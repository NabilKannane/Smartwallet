"use client";

import { X } from "lucide-react";
import { useRef, useState, useTransition } from "react";

import { disconnectMcpClient } from "@/lib/actions";
import type { McpClient } from "@/lib/finance";

import { ClaudeLogo, McpLogo, OpenAILogo } from "./BrandLogos";
import { CopyButton } from "./CopyButton";
import { useToast } from "./Toast";

const LOGOS = { claude: ClaudeLogo, openai: OpenAILogo, mcp: McpLogo };

export interface Integration {
  id: McpClient;
  logo: keyof typeof LOGOS;
  name: string;
  description: string;
  steps: React.ReactNode[];
}

function Logo({ logo }: Pick<Integration, "logo">) {
  const Svg = LOGOS[logo];
  return (
    <span className="integration-logo">
      <Svg />
    </span>
  );
}

function IntegrationCard({
  item,
  connected,
  onShow,
}: {
  item: Integration;
  connected: boolean;
  onShow: () => void;
}) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  function disconnect() {
    if (!window.confirm(`Déconnecter ${item.name} de SmartWallet ?`)) return;
    startTransition(async () => {
      const res = await disconnectMcpClient(item.id);
      toast({ message: res.ok ? `${item.name} déconnecté` : res.error });
    });
  }

  return (
    <article className="slip integration">
      <div className="integration-top">
        <Logo logo={item.logo} />
        <span className={`status${connected ? " is-up" : ""}`}>{connected ? "Connecté" : "Non connecté"}</span>
      </div>
      <div className="integration-text">
        <h3>{item.name}</h3>
        <p className="form-note">{item.description}</p>
      </div>
      {connected ? (
        <div className="integration-actions">
          <button type="button" className="btn btn-ghost" onClick={onShow}>
            Voir les étapes
          </button>
          <button type="button" className="btn btn-ghost text-red" onClick={disconnect} disabled={pending}>
            {pending ? "Déconnexion…" : "Déconnecter"}
          </button>
        </div>
      ) : (
        <button type="button" className="btn btn-ghost" onClick={onShow}>
          Connecter
        </button>
      )}
    </article>
  );
}

export function Integrations({
  items,
  url,
  connected,
}: {
  items: Integration[];
  url: string | null;
  connected: Partial<Record<McpClient, boolean>>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState<Integration | null>(null);

  function show(item: Integration) {
    setOpen(item);
    dialog.current?.showModal();
  }

  return (
    <>
      <div className="integrations">
        {items.map((item) => (
          <IntegrationCard key={item.id} item={item} connected={!!connected[item.id]} onShow={() => show(item)} />
        ))}
      </div>

      <dialog
        ref={dialog}
        className="integration-dialog"
        aria-labelledby="integration-title"
        onClose={() => setOpen(null)}
        onClick={(e) => e.target === e.currentTarget && dialog.current?.close()}
      >
        {open && (
          <div className="integration-dialog-body">
            <header className="integration-dialog-head">
              <Logo logo={open.logo} />
              <h2 id="integration-title">Connecter {open.name}</h2>
              <button
                type="button"
                className="icon-btn"
                onClick={() => dialog.current?.close()}
                aria-label="Fermer"
                title="Fermer"
              >
                <X size={18} aria-hidden />
              </button>
            </header>

            <div>
              <span className="form-note">Adresse du serveur</span>
              <div className="mcp-url">
                <code>{url ?? "Configure AGENTOS_URL dans agent/.env"}</code>
                {url && <CopyButton value={url} />}
              </div>
            </div>

            <ol className="mcp-steps">
              {open.steps.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
          </div>
        )}
      </dialog>
    </>
  );
}
