"use client";

import { ChartColumn, MessagesSquare, ReceiptText, Wallet } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { money } from "@/lib/finance";

const LINKS = [
  { href: "/", label: "Ce mois", icon: ReceiptText },
  { href: "/historique", label: "Historique", icon: ChartColumn },
  { href: "/budget", label: "Budget", icon: Wallet },
  { href: "/assistant", label: "Assistant", icon: MessagesSquare },
];

export function Rail({ reste }: { reste: number | null }) {
  const pathname = usePathname();
  const onHome = pathname === "/";

  return (
    <aside className="rail">
      <Link href="/" className="brand">
        <ReceiptText size={22} strokeWidth={2.25} aria-hidden />
        SmartWallet
      </Link>

      <nav className="nav" aria-label="Navigation principale">
        {LINKS.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? onHome : pathname.startsWith(href);
          return (
            <Link key={href} href={href} aria-current={active ? "page" : undefined}>
              <Icon size={18} strokeWidth={2} aria-hidden />
              {label}
            </Link>
          );
        })}
      </nav>

      {!onHome && reste !== null && (
        <Link href="/" className={`rail-readout${reste < 0 ? " is-negative" : ""}`}>
          <span>Reste ce mois</span>
          <span className="num">{money(reste)} €</span>
        </Link>
      )}
    </aside>
  );
}
