"use client";

import { Check, X } from "lucide-react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

export interface ToastInput {
  message: string;
  /** Lien facultatif, ex. « Voir » vers la page modifiée. */
  action?: { label: string; href: string };
}

interface ToastItem extends ToastInput {
  id: number;
}

const DURATION = 5000;
const MAX_VISIBLE = 3;
const spring = { type: "spring", stiffness: 420, damping: 38 } as const;

const ToastContext = createContext<(t: ToastInput) => void>(() => {});

/** Affiche une notification en bas de l'écran. À utiliser sous <ToastProvider>. */
export function useToast() {
  return useContext(ToastContext);
}

function ToastCard({ toast, onClose }: { toast: ToastItem; onClose: () => void }) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const paused = hovered || focused;
  const left = useRef(DURATION);

  // Disparaît après 5 s ; le compte à rebours s'arrête tant que la souris ou le focus est dessus.
  useEffect(() => {
    if (paused) return;
    const start = Date.now();
    const t = setTimeout(onClose, left.current);
    return () => {
      clearTimeout(t);
      left.current -= Date.now() - start;
    };
  }, [paused, onClose]);

  return (
    <motion.div
      layout
      className="toast"
      initial={{ opacity: 0, y: 24, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 12, scale: 0.96, transition: { duration: 0.18 } }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setFocused(false);
      }}
    >
      <Check size={16} strokeWidth={2.5} className="toast-icon" aria-hidden />
      <span>{toast.message}</span>
      {toast.action && (
        <Link href={toast.action.href} onClick={onClose}>
          {toast.action.label}
        </Link>
      )}
      <button type="button" className="toast-close" onClick={onClose} aria-label="Fermer la notification">
        <X size={15} aria-hidden />
      </button>
    </motion.div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const push = useCallback((t: ToastInput) => {
    const id = nextId.current++;
    setToasts((all) => [...all, { ...t, id }].slice(-MAX_VISIBLE));
  }, []);

  const close = useCallback((id: number) => setToasts((all) => all.filter((t) => t.id !== id)), []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      {/* Même ressort que le menu (Rail) ; les animations sont coupées si l'utilisateur réduit les mouvements. */}
      <MotionConfig reducedMotion="user" transition={spring}>
        <div className="toast-stack" role="status" aria-live="polite">
          <AnimatePresence initial={false}>
            {toasts.map((t) => (
              <ToastCard key={t.id} toast={t} onClose={() => close(t.id)} />
            ))}
          </AnimatePresence>
        </div>
      </MotionConfig>
    </ToastContext.Provider>
  );
}
