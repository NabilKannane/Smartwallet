"""SmartWallet - service IA (FastAPI) qui aide à décider d'un achat."""

import os

from dotenv import load_dotenv
from fastapi import FastAPI
from pydantic import BaseModel

from agno.agent import Agent
from agno.models.google import Gemini

load_dotenv()

INSTRUCTIONS = [
    "Tu es un conseiller financier personnel qui aide l'utilisateur à décider s'il doit faire un achat.",
    "Appuie-toi sur le contexte financier fourni (salaire, dépenses fixes, factures, solde actuel) pour évaluer l'impact de l'achat sur son budget.",
    "Termine toujours par une recommandation claire : Acheter / Attendre / Éviter, avec une justification courte basée sur les chiffres.",
    "Si une information essentielle manque pour juger, pose une question précise avant de conclure.",
    "Réponds en français, de façon concise et bienveillante, sans jargon inutile.",
]

agent = Agent(
    model=Gemini(api_key=os.getenv("GOOGLE_API_KEY")),
    instructions=INSTRUCTIONS,
    markdown=True,
)

app = FastAPI(title="SmartWallet - AI Service")


class ChatRequest(BaseModel):
    message: str
    context: str = ""
    session_id: str = "default"


class ChatResponse(BaseModel):
    reply: str


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest) -> ChatResponse:
    prompt = req.message
    if req.context:
        prompt = (
            f"Contexte financier de l'utilisateur :\n{req.context}\n\n"
            f"Question de l'utilisateur :\n{req.message}"
        )
    result = agent.run(prompt, session_id=req.session_id)
    return ChatResponse(reply=result.content)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
