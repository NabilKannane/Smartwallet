from typing import Literal

from agno.run.agent import RunOutput
from agno.run.base import RunStatus
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from agent import agent, check_db
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
