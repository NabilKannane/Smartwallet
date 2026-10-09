from typing import Literal
from sqlalchemy import text

from agent_db import db

# Outils qui modifient la base : main.py les renvoie au client, qui affiche une notification.
# nom de l'outil -> (type d'action, données touchées, argument qui sert de libellé)
WRITE_TOOLS: dict[str, tuple[Literal["add", "update", "delete"], str, str]] = {
    "ajouter_wishlist": ("add", "wishlist", "nom"),
}


def lister_wishlist() -> str:
    """Liste les articles de la wishlist de l'utilisateur (nom, prix, priorité)."""
    with db.db_engine.connect() as conn:
        rows = conn.execute(
            text(
                "SELECT nom, prix, priorite FROM wishlist "
                "ORDER BY CASE priorite WHEN 'Haute' THEN 0 WHEN 'Moyenne' THEN 1 ELSE 2 END, prix"
            )
        ).fetchall()

    if not rows:
        return "La wishlist est vide."
    return "\n".join([f"{r.nom} - {r.prix} MAD - Priorité: {r.priorite}" for r in rows])


def ajouter_wishlist(
    nom: str,
    prix: float,
    priorite: Literal["Haute", "Moyenne", "Basse"] = "Moyenne",
    note: str | None = None,
) -> str:
    """Ajoute un article à la wishlist. À utiliser seulement si l'utilisateur le demande explicitement.

    Args:
        nom: nom de l'article.
        prix: prix en dirhams (MAD), strictement positif.
        priorite: Haute, Moyenne ou Basse.
        note: remarque facultative.
    """
    # Une exception marque l'appel en échec (tool_call_error) : main.py ne le notifie pas comme une action réussie.
    if prix <= 0:
        raise ValueError("Le prix doit être un nombre positif.")
    with db.db_engine.begin() as conn:
        conn.execute(
            text("INSERT INTO wishlist (nom, prix, priorite, note) VALUES (:nom, :prix, :priorite, :note)"),
            {"nom": nom, "prix": round(prix, 2), "priorite": priorite, "note": note},
        )
    return f"{nom} a été ajouté à la wishlist."
