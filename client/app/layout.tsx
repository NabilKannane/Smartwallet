import type { Metadata, Viewport } from "next";
import { Archivo, Martian_Mono } from "next/font/google";
import { cookies } from "next/headers";

import { DeviseProvider } from "@/components/Currency";
import { Rail } from "@/components/Rail";
import { getDevise } from "@/lib/db";
import { monthKey } from "@/lib/finance";
import { loadMonth } from "@/lib/summary";

import "./globals.css";

const archivo = Archivo({ subsets: ["latin"], axes: ["wdth"], variable: "--font-archivo", display: "swap" });
const martian = Martian_Mono({ subsets: ["latin"], axes: ["wdth"], variable: "--font-martian", display: "swap" });

export const metadata: Metadata = {
  title: { default: "SmartWallet", template: "%s · SmartWallet" },
  description: "Ce qui te reste vraiment ce mois-ci.",
};

export const viewport: Viewport = {
  themeColor: "#13332f",
  viewportFit: "cover",
};

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [{ salaire, month }, devise] = await Promise.all([loadMonth(monthKey(new Date())), getDevise()]);
  // Même nom de cookie que dans components/Rail.tsx.
  const railCollapsed = (await cookies()).get("sw-rail")?.value === "collapsed";
  return (
    <html lang="fr" className={`${archivo.variable} ${martian.variable}`}>
      <body>
        <DeviseProvider devise={devise}>
          <div className="shell">
            <Rail reste={salaire > 0 ? month.reste : null} initialCollapsed={railCollapsed} />
            <main className="main">{children}</main>
          </div>
        </DeviseProvider>
      </body>
    </html>
  );
}
