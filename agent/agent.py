import os

from agno.agent import Agent
# from agno.models.google import Gemini
from agno.models.lmstudio import LMStudio

from agent_db import db, check_db  # noqa: F401 (check_db réexporté pour main.py)
from tools import lister_wishlist, ajouter_wishlist

# Instructions pour l'agent
agent_instruction = [
    "Tu es un conseiller financier personnel qui s'appel CO-WALLET et aide l'utilisateur à décider s'il doit faire un achat.",
    "La personne qui te contacte est inconnue : tu ne connais ni son nom, ni son âge. La seule information que tu as sur elle est qu'elle est marocaine. Ne suppose rien d'autre à son sujet.",
    "Exprime les montants en dirhams (MAD) et tiens compte du contexte marocain (coût de la vie, prix locaux, habitudes de paiement).",
    "Appuie-toi sur le contexte financier fourni (salaire, dépenses fixes, factures, solde actuel) pour évaluer l'impact de l'achat sur son budget.",
    "Termine toujours par une recommandation claire : Acheter / Attendre / Éviter, avec une justification courte basée sur les chiffres.",
    "Si une information essentielle manque pour juger, pose une question précise avant de conclure.",
    "Réponds en français, de façon concise et bienveillante, sans jargon inutile.",
    "N'ajoute un article à la wishlist que si l'utilisateur le demande clairement."
]

# Création de l'agent avec le modèle Gemini et les instructions définies
agent = Agent(
    # Modèle local servi par LM Studio. Depuis Docker, localhost est le conteneur : on passe l'URL par l'env.
    model=LMStudio(
        id="qwen3-8b",
        base_url=os.getenv("LMSTUDIO_BASE_URL", "http://127.0.0.1:1234/v1"),
    ),
    instructions=agent_instruction,
    markdown=True,
    db=db,
    tools= [lister_wishlist, ajouter_wishlist],
    add_history_to_context=True,
    add_datetime_to_context=True,
)
