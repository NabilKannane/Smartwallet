from typing import Literal
from sqlalchemy import text

from agent_db import db

# Outils qui modifient la base : main.py les renvoie au client, qui affiche une notification.
# nom de l'outil -> (type d'action, données touchées, argument qui sert de libellé)
WRITE_TOOLS: dict[str, tuple[Literal["add", "update", "delete"], str, str]] = {
    "ajouter_wishlist": ("add", "wishlist", "nom"),
    "modifier_wishlist": ("update", "wishlist", "nom"),
    "supprimer_wishlist": ("delete", "wishlist", "nom"),
}

#### Liste wishlist
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

### Ajouter wishlist
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
            text(
                "INSERT INTO wishlist (nom, prix, priorite, note) VALUES (:nom, :prix, :priorite, :note)"
            ),
            {"nom": nom, "prix": round(prix, 2), "priorite": priorite, "note": note},
        )
    return f"{nom} a été ajouté à la wishlist."


### Modifier wishlist
def modifier_wishlist(
    nom: str,
    nouveau_nom: str | None = None,
    prix: float | None = None,
    priorite: Literal["Haute", "Moyenne", "Basse"] | None = None,
    note: str | None = None,
) -> str:
    """Modifie un article existant de la wishlist. À utiliser seulement si l'utilisateur le demande explicitement.
    Seuls les champs fournis sont modifiés.

    Args:
        nom: nom actuel de l'article à modifier.
        nouveau_nom: nouveau nom, si l'utilisateur veut le renommer.
        prix: nouveau prix en dirhams (MAD), strictement positif.
        priorite: nouvelle priorité : Haute, Moyenne ou Basse.
        note: nouvelle remarque.
    """
    if prix is not None and prix <= 0:
        raise ValueError("Le prix doit être un nombre positif.")
    with db.db_engine.begin() as conn:
        ids = conn.execute(
            text("SELECT id FROM wishlist WHERE LOWER(nom) = LOWER(:nom)"), {"nom": nom}
        ).scalars().all()
        if not ids:
            raise ValueError(f"Aucun article nommé « {nom} » dans la wishlist.")
        if len(ids) > 1:
            raise ValueError(f"Plusieurs articles s'appellent « {nom} » : précise lequel modifier.")
        conn.execute(
            text(
                "UPDATE wishlist SET nom = COALESCE(:nouveau_nom, nom), prix = COALESCE(:prix, prix), "
                "priorite = COALESCE(:priorite, priorite), note = COALESCE(:note, note) WHERE id = :id"
            ),
            {
                "id": ids[0],
                "nouveau_nom": nouveau_nom,
                "prix": round(prix, 2) if prix is not None else None,
                "priorite": priorite,
                "note": note,
            },
        )
    return f"{nouveau_nom or nom} a été modifié dans la wishlist."

### Supprimer wishlist
def supprimer_wishlist(nom: str) -> str:
    """Supprime un article de la wishlist. À utiliser seulement si l'utilisateur le demande explicitement.

    Args:
        nom: nom de l'article à supprimer.
    """
    with db.db_engine.begin() as conn:
        ids = conn.execute(
            text("SELECT id FROM wishlist WHERE LOWER(nom) = LOWER(:nom)"), {"nom": nom}
        ).scalars().all()
        if not ids:
            raise ValueError(f"Aucun article nommé « {nom} » dans la wishlist.")
        if len(ids) > 1:
            raise ValueError(f"Plusieurs articles s'appellent « {nom} » : précise lequel supprimer.")
        conn.execute(text("DELETE FROM wishlist WHERE id = :id"), {"id": ids[0]})
    return f"{nom} a été supprimé de la wishlist."
