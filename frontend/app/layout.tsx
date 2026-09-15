import type { Metadata } from "next";
import "./globals.css";
import { WalletProvider } from "@/lib/wallet/WalletProvider";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

export const metadata: Metadata = {
  title: "Protocol Court — the precedent layer for Web3",
  description:
    "Smart contracts verify execution. Protocol Court verifies meaning — evidence-backed, challengeable, permanent precedent for what a protocol actually committed to.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <WalletProvider>
          <SiteHeader />
          <main className="mx-auto min-h-[70vh] max-w-6xl px-6 py-10">{children}</main>
          <SiteFooter />
        </WalletProvider>
      </body>
    </html>
  );
}
