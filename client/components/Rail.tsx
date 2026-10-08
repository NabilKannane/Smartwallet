"use client";

import { ChartColumn, MessagesSquare, PanelLeftClose, PanelLeftOpen, ReceiptText, Wallet } from "lucide-react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { moneyOr } from "@/lib/finance";

import { Cur } from "./Currency";

const LINKS = [
  { href: "/", label: "Ce mois", icon: ReceiptText },
  { href: "/historique", label: "Historique", icon: ChartColumn },
  { href: "/budget", label: "Budget", icon: Wallet },
  { href: "/assistant", label: "Assistant", icon: MessagesSquare },
];

// Cookie lu par app/layout.tsx (même nom) : le serveur rend directement le bon état, sans flash.
const RAIL_COOKIE = "sw-rail";

const WIDTH = { open: 232, collapsed: 76 };
const spring = { type: "spring", stiffness: 420, damping: 38 } as const;
const fade = { duration: 0.16 };

export function Rail({ reste, initialCollapsed, masque }: { reste: number | null; initialCollapsed: boolean; masque: boolean }) {
  const pathname = usePathname();
  const onHome = pathname === "/";
  const [collapsed, setCollapsed] = useState(initialCollapsed);

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    document.cookie = `${RAIL_COOKIE}=${next ? "collapsed" : "open"}; path=/; max-age=31536000; samesite=lax`;
  }

  const ToggleIcon = collapsed ? PanelLeftOpen : PanelLeftClose;
  const toggleLabel = collapsed ? "Afficher le menu" : "Réduire le menu";

  return (
    <MotionConfig reducedMotion="user" transition={spring}>
      <motion.aside
        className="rail"
        initial={false}
        animate={{ width: collapsed ? WIDTH.collapsed : WIDTH.open }}
      >
        <div className="rail-head">
          <motion.div
            className="brand-wrap"
            initial={false}
            animate={{ width: collapsed ? 0 : "auto", opacity: collapsed ? 0 : 1 }}
          >
            <Link href="/" className="brand" tabIndex={collapsed ? -1 : undefined}>
              SmartWallet
            </Link>
          </motion.div>
          <button
            type="button"
            className="rail-toggle"
            onClick={toggle}
            aria-expanded={!collapsed}
            aria-label={toggleLabel}
            title={toggleLabel}
          >
            <ToggleIcon size={18} strokeWidth={2} aria-hidden />
          </button>
        </div>

        <nav className="nav" aria-label="Navigation principale">
          {LINKS.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? onHome : pathname.startsWith(href);
            return (
              <Link key={href} href={href} aria-current={active ? "page" : undefined} title={collapsed ? label : undefined}>
                <Icon size={18} strokeWidth={2} aria-hidden />
                <motion.span
                  className="nav-label"
                  initial={false}
                  animate={{ opacity: collapsed ? 0 : 1 }}
                  transition={fade}
                >
                  {label}
                </motion.span>
              </Link>
            );
          })}
        </nav>

        <AnimatePresence initial={false}>
          {!collapsed && !onHome && reste !== null && (
            <motion.div
              key="readout"
              className="rail-readout-wrap"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8, transition: fade }}
            >
              <Link href="/" className={`rail-readout${!masque && reste < 0 ? " is-negative" : ""}`}>
                <span>Reste ce mois</span>
                <span className="num">{moneyOr(masque, reste)} <Cur /></span>
              </Link>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.aside>
    </MotionConfig>
  );
}
