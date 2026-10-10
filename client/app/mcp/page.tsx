import { ChevronDown } from "lucide-react";
import type { Metadata } from "next";

import { Integrations, type Integration } from "@/components/Integrations";

export const metadata: Metadata = { title: "MCP" };

const AI = process.env.AI_SERVICE_URL ?? "http://localhost:8000";

interface McpInfo {
  url: string | null;
  tools: { name: string; description: string }[];
}

async function loadInfo(): Promise<McpInfo | null> {
  try {
    const res = await fetch(`${AI}/mcp-info`, { signal: AbortSignal.timeout(2500), cache: "no-store" });
    return res.ok ? ((await res.json()) as McpInfo) : null;
  } catch {
    return null;
  }
}

/** Le serveur est-il joignable depuis Internet, comme les clients le verront ? */
async function isReachable(url: string): Promise<boolean> {
  try {
    const res = await fetch(`${new URL(url).origin}/.well-known/oauth-protected-resource/mcp`, {
      signal: AbortSignal.timeout(4000),
      cache: "no-store",
      headers: { "ngrok-skip-browser-warning": "1" },
    });
    return res.ok;
  } catch {
    return false;
  }
}

const SECRET = (
  <>
    saisis ton <code>MCP_CONNECT_SECRET</code> (dans agent/.env)
  </>
);

function integrations(): Integration[] {
  return [
    {
      logo: "claude",
      name: "Claude",
      description: "Connecteur personnalisé sur claude.ai, Desktop et mobile.",
      steps: [
        <>
          Ouvre <strong>Settings → Connectors</strong>, puis <strong>Add custom connector</strong>.
        </>,
        "Nomme-le SmartWallet, colle l’adresse et laisse Client ID et Client Secret vides.",
        <>Clique sur <strong>Connect</strong>, puis {SECRET}.</>,
        "Dans une nouvelle conversation, active SmartWallet dans les outils.",
      ],
    },
    {
      logo: "openai",
      name: "ChatGPT",
      description: "Connecteur en mode développeur sur ChatGPT.",
      steps: [
        <>
          Ouvre <strong>Settings → Apps & Connectors → Advanced settings</strong> et active le{" "}
          <strong>Developer mode</strong> (selon ton abonnement).
        </>,
        <>
          Reviens dans <strong>Apps & Connectors</strong> et clique sur <strong>Create</strong>.
        </>,
        "Nomme-le SmartWallet, colle l’adresse et choisis l’authentification OAuth.",
        <>Valide, puis {SECRET} sur la page qui s’ouvre.</>,
      ],
    },
    {
      logo: "mcp",
      name: "Autre client",
      description: "Tout client compatible MCP distant avec OAuth.",
      steps: [
        "Ajoute un serveur de type HTTP (Streamable HTTP) avec l’adresse ci-dessus.",
        "L’authentification OAuth est découverte automatiquement : laisse les identifiants client vides.",
        <>Sur la page de consentement, {SECRET}.</>,
      ],
    },
  ];
}

export default async function Mcp() {
  const info = await loadInfo();
  const reachable = info?.url ? await isReachable(info.url) : false;

  const status = !info
    ? { cls: " is-down", text: "Service IA hors ligne" }
    : !info.url
      ? { cls: " is-down", text: "AGENTOS_URL non configurée" }
      : reachable
        ? { cls: " is-up", text: "Joignable depuis Internet" }
        : { cls: " is-down", text: "Injoignable depuis Internet" };

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Connexions MCP</h1>
          <p>Utilise SmartWallet depuis ton assistant IA préféré. Il passe par CO-WALLET pour lire et modifier ton budget.</p>
        </div>
        <span className={`status${status.cls}`} role="status">
          {status.text}
        </span>
      </header>

      {info && !reachable && (
        <p className="form-note mb-4">
          {info.url
            ? "Vérifie que le tunnel ngrok tourne et que son adresse est celle de AGENTOS_URL dans agent/.env."
            : "Ajoute AGENTOS_URL (adresse publique HTTPS, par exemple ngrok) dans agent/.env, puis relance le service."}
        </p>
      )}

      <Integrations items={integrations()} url={info?.url ?? null} />

      <details className="slip context-slip mt-6">
        <summary>
          Ce que l’assistant peut faire <ChevronDown size={16} aria-hidden />
        </summary>
        {info?.tools.length ? (
          <ul className="mcp-tools mt-3">
            {info.tools.map((t) => (
              <li key={t.name}>
                <code>{t.name}</code>
                <span className="form-note">{t.description}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="form-note mt-3">La liste s’affichera quand le service IA sera en ligne.</p>
        )}
      </details>
    </>
  );
}
