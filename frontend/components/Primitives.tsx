import Link from "next/link";
import type { ReactNode } from "react";

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`pc-panel rounded-sm p-5 ${className}`}>{children}</div>;
}

export function PanelRaised({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`pc-panel-raised rounded-sm p-5 ${className}`}>{children}</div>;
}

export function MonoId({ value, truncate = false }: { value: string; truncate?: boolean }) {
  const display = truncate && value.length > 18 ? `${value.slice(0, 8)}…${value.slice(-6)}` : value;
  return (
    <span className="pc-mono text-[0.8125rem]" style={{ color: "var(--pc-text-muted)" }} title={value}>
      {display}
    </span>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div
      className="pc-mono mb-2 text-[0.6875rem] uppercase tracking-[0.12em]"
      style={{ color: "var(--pc-text-faint)" }}
    >
      {children}
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div
      className="rounded-sm border border-dashed p-8 text-center text-sm"
      style={{ borderColor: "var(--pc-border)", color: "var(--pc-text-faint)" }}
    >
      {children}
    </div>
  );
}

export function LoadingState({ label = "Reading from the chain…" }: { label?: string }) {
  return (
    <div className="pc-mono py-8 text-center text-sm" style={{ color: "var(--pc-text-faint)" }}>
      {label}
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div
      className="rounded-sm border p-4 text-sm"
      style={{ borderColor: "var(--pc-red-dim)", color: "var(--pc-red)" }}
    >
      {message}
    </div>
  );
}

export function GoldSeal({ children }: { children: ReactNode }) {
  return (
    <span
      className="pc-mono inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 text-[0.6875rem] uppercase tracking-[0.1em]"
      style={{ borderColor: "var(--pc-gold)", color: "var(--pc-gold-bright)" }}
    >
      ◆ {children}
    </span>
  );
}

export function CrumbLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="pc-mono text-[0.8125rem] hover:underline"
      style={{ color: "var(--pc-text-muted)" }}
    >
      {children}
    </Link>
  );
}
