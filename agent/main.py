from agno.run.base import RunStatus
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from agent import agent, check_db

if check_db():
    print("✅ Connecté à la base de données")

app = FastAPI(title="SmartWallet - AI Service")


class ChatRequest(BaseModel):
    message: str
    context: str = ""
    session_id: str = "default"


class ChatResponse(BaseModel):
    reply: str


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
    return ChatResponse(reply=result.content)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
