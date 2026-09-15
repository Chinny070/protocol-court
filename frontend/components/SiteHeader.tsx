"use client";

import Link from "next/link";
import { useWallet, isWrongChain } from "@/lib/wallet/WalletProvider";

const NAV = [
  { href: "/protocols", label: "Protocols" },
  { href: "/cases", label: "Cases" },
  { href: "/precedents", label: "Precedents" },
];

function truncateAddress(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function SiteHeader() {
  const { address, chainId, connecting, error, hasProvider, connect, disconnect } = useWallet();

  return (
    <header
      className="sticky top-0 z-20 border-b backdrop-blur"
      style={{ borderColor: "var(--pc-border)", background: "rgba(10,10,12,0.9)" }}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-baseline gap-2">
          <span className="pc-mono text-sm tracking-[0.15em]" style={{ color: "var(--pc-gold)" }}>
            ◆
          </span>
          <span className="text-[0.9375rem] font-semibold tracking-tight" style={{ color: "var(--pc-text)" }}>
            PROTOCOL COURT
          </span>
        </Link>

        <nav className="hidden gap-6 sm:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="pc-mono text-[0.8125rem] uppercase tracking-[0.08em] hover:opacity-80"
              style={{ color: "var(--pc-text-muted)" }}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          {address ? (
            <>
              {isWrongChain(chainId) && (
                <span className="pc-status pc-status-dispute">Wrong network</span>
              )}
              <button
                onClick={disconnect}
                className="pc-mono rounded-sm border px-3 py-1.5 text-[0.75rem]"
                style={{ borderColor: "var(--pc-border-strong)", color: "var(--pc-text-muted)" }}
              >
                {truncateAddress(address)}
              </button>
            </>
          ) : (
            <button
              onClick={connect}
              disabled={connecting}
              className="pc-mono rounded-sm border px-3 py-1.5 text-[0.75rem] uppercase tracking-[0.06em] disabled:opacity-50"
              style={{ borderColor: "var(--pc-gold-dim)", color: "var(--pc-gold-bright)" }}
              title={hasProvider ? undefined : "No browser wallet detected yet — click to check again"}
            >
              {connecting ? "Connecting…" : "Connect wallet"}
            </button>
          )}
        </div>
      </div>
      {error && !address && (
        <div className="mx-auto max-w-6xl px-6 pb-2 text-[0.75rem]" style={{ color: "var(--pc-red)" }}>
          {error}
        </div>
      )}
    </header>
  );
}
