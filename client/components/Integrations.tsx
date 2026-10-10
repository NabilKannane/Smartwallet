"use client";

import { X } from "lucide-react";
import { useRef, useState } from "react";

import { ClaudeLogo, McpLogo, OpenAILogo } from "./BrandLogos";
import { CopyButton } from "./CopyButton";

const LOGOS = { claude: ClaudeLogo, openai: OpenAILogo, mcp: McpLogo };

export interface Integration {
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

export function Integrations({ items, url }: { items: Integration[]; url: string | null }) {
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
          <article key={item.name} className="slip integration">
            <Logo logo={item.logo} />
            <div className="integration-text">
              <h3>{item.name}</h3>
              <p className="form-note">{item.description}</p>
            </div>
            <button type="button" className="btn btn-ghost" onClick={() => show(item)}>
              Connecter
            </button>
          </article>
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
