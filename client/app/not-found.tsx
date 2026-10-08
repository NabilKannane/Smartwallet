import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Page introuvable" };

export default function NotFound() {
  return (
    <>
      <header className="page-head">
        <div>
          <h1>Page introuvable</h1>
        </div>
      </header>
      <div className="empty-state">
        <h2>Cette page n’existe pas</h2>
        <p>Le lien est peut-être erroné, ou la page a été déplacée. Ton budget, lui, n’a pas bougé.</p>
        <div className="flex flex-wrap gap-2">
          <Link className="btn btn-primary" href="/">
            Revenir à ce mois
          </Link>
          <Link className="btn btn-ghost" href="/historique">
            Voir l’historique
          </Link>
        </div>
      </div>
    </>
  );
}
