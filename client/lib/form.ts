import { startTransition, type FormEvent } from "react";

/**
 * Envoie le formulaire à une action sans que React 19 le vide ensuite.
 * Avec `<form action>`, React réinitialise les champs après chaque envoi, même en cas d'erreur :
 * l'utilisateur perdrait sa saisie, et la date ou la catégorie choisies reviendraient par défaut.
 */
export function submitKeepingValues(action: (form: FormData) => void) {
  return (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    startTransition(() => action(data));
  };
}
