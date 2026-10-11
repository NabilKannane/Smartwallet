import os
import time
from typing import Literal

from agno.run.agent import RunOutput
from agno.run.base import RunStatus
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from sqlalchemy import text

from agent import agent, check_db, db
from tools import WRITE_TOOLS

if check_db():
    print("✅ Connecté à la base de données")

app = FastAPI(title="SmartWallet - AI Service")


class ChatRequest(BaseModel):
    message: str
    context: str = ""
    session_id: str = "default"


class Action(BaseModel):
    type: Literal["add", "update", "delete"]
    target: str
    label: str


class ChatResponse(BaseModel):
    reply: str
    actions: list[Action] = []


def performed_actions(result: RunOutput) -> list[Action]:
    """Modifications réellement faites en base pendant ce run (les appels en échec sont ignorés)."""
    actions = []
    for t in result.tools or []:
        if t.tool_name not in WRITE_TOOLS or t.tool_call_error:
            continue
        kind, target, label_arg = WRITE_TOOLS[t.tool_name]
        label = str((t.tool_args or {}).get(label_arg, "")).strip()
        actions.append(Action(type=kind, target=target, label=label))
    return actions


@app.get("/health")
def health():
    return {"status": "ok", "db": "connected" if check_db() else "disconnected"}


# Clients MCP reconnus par l'identifiant OAuth (une URL) qu'ils présentent ; le reste est « other ».
MCP_CLIENTS = {"claude": "https://claude.ai/%", "chatgpt": "https://chatgpt.com/%"}
McpClient = Literal["claude", "chatgpt", "other"]


def _refresh_tokens_table() -> str:
    return f"{db.db_schema}.{db.mcp_oauth_refresh_tokens_table_name}"


def _client_filter(client: McpClient) -> str:
    if client == "other":
        return " AND ".join(f"client_id NOT LIKE '{p}'" for p in MCP_CLIENTS.values())
    return f"client_id LIKE '{MCP_CLIENTS[client]}'"


def connected_clients() -> dict[str, bool]:
    """Un client est connecté tant qu'il détient un refresh token OAuth non expiré."""
    try:
        with db.db_engine.connect() as conn:
            ids = conn.execute(
                text(f"SELECT DISTINCT client_id FROM {_refresh_tokens_table()} WHERE expires_at > :now"),
                {"now": int(time.time())},
            ).scalars().all()
    except Exception:
        # Table absente tant qu'aucun client ne s'est connecté.
        ids = []
    prefixes = {k: p.rstrip("%") for k, p in MCP_CLIENTS.items()}
    status = {k: any(i.startswith(p) for i in ids) for k, p in prefixes.items()}
    status["other"] = any(not any(i.startswith(p) for p in prefixes.values()) for i in ids)
    return status


@app.get("/mcp-info")
def mcp_info():
    """Adresse du connecteur MCP, outils de l'agent et clients connectés, pour la page MCP du client."""
    base = os.getenv("AGENTOS_URL", "").rstrip("/")
    tools = [
        {"name": t.__name__, "description": (t.__doc__ or "").strip().splitlines()[0]}
        for t in agent.tools or []
        if callable(t)
    ]
    return {"url": f"{base}/mcp" if base else None, "tools": tools, "connected": connected_clients()}


@app.post("/mcp-clients/{client}/disconnect")
def mcp_disconnect(client: McpClient):
    """Révoque les refresh tokens du client : il perd l'accès quand son access token expire (1 h max)."""
    with db.db_engine.begin() as conn:
        deleted = conn.execute(text(f"DELETE FROM {_refresh_tokens_table()} WHERE {_client_filter(client)}")).rowcount
    return {"revoked": deleted}


@app.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest) -> ChatResponse:
    prompt = req.message
    if req.context:
        prompt = (
            f"Contexte financier de l'utilisateur :\n{req.context}\n\n"
            f"Question de l'utilisateur :\n{req.message}"
        )
    try:
        result = agent.run(prompt, session_id=req.session_id)
    except Exception as e:
        print(f"❌ Erreur de l'agent : {e}")
        raise HTTPException(status_code=503, detail="model_unavailable")
    # Après les tentatives, une erreur du modèle (ex. 503 surcharge) revient dans le contenu :
    # on ne la renvoie pas comme une réponse de l'assistant.
    if result.status == RunStatus.error:
        print(f"❌ Erreur du modèle : {result.content}")
        raise HTTPException(status_code=503, detail="model_unavailable")
    return ChatResponse(reply=(result.content or "").strip(), actions=performed_actions(result))


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
