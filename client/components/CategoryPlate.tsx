import { plateFor } from "@/lib/finance";

export function CategoryPlate({ categorie, hideName = false }: { categorie: string; hideName?: boolean }) {
  const { code, color } = plateFor(categorie);
  return (
    <span className="cat" style={{ "--plate-color": color } as React.CSSProperties}>
      <span className="cat-code" aria-hidden={!hideName}>
        {code}
      </span>
      <span className={hideName ? "sr-only" : "cat-name"}>{categorie}</span>
    </span>
  );
}
