"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

export function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  const Icon = copied ? Check : Copy;
  return (
    <button type="button" className="btn btn-ghost" onClick={copy}>
      <Icon size={16} aria-hidden />
      <span aria-live="polite">{copied ? "Copié" : "Copier"}</span>
    </button>
  );
}
