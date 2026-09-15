"use client";

import Link from "next/link";
import { useContractRead } from "@/hooks/useContractRead";
import { getProtocol, getProtocolCount } from "@/lib/genlayer/contract";
import { Panel, EmptyState, LoadingState, ErrorState, MonoId, SectionLabel } from "@/components/Primitives";
import type { Protocol } from "@/lib/genlayer/types";

async function loadAllProtocols(): Promise<Protocol[]> {
  const count = await getProtocolCount();
  const ids = Array.from({ length: count }, (_, i) => `protocol-${i + 1}`);
  return Promise.all(ids.map((id) => getProtocol(id)));
}

export default function ProtocolsPage() {
  const { status, data, error } = useContractRead(loadAllProtocols, []);

  return (
    <div>
      <SectionLabel>Protocol Explorer</SectionLabel>
      <h1 className="text-3xl font-semibold tracking-tight">Protocols</h1>
      <p className="mt-2 max-w-2xl text-sm" style={{ color: "var(--pc-text-muted)" }}>
        Every protocol that has registered a commitment on Protocol Court, with its
        commitment count. Select one to see its full commitment version history.
      </p>

      <div className="mt-8">
        {status === "loading" && <LoadingState />}
        {status === "error" && <ErrorState message={error} />}
        {status === "ready" && data.length === 0 && (
          <EmptyState>No protocols have registered a commitment yet.</EmptyState>
        )}
        {status === "ready" && data.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            {data.map((p) => (
              <Link key={p.protocol_id} href={`/protocols/${p.protocol_id}`}>
                <Panel className="h-full transition-colors hover:border-[var(--pc-border-strong)]">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-base font-semibold">{p.name}</div>
                      <MonoId value={p.protocol_id} />
                    </div>
                    <span
                      className="pc-mono shrink-0 rounded-sm border px-2 py-0.5 text-[0.6875rem]"
                      style={{ borderColor: "var(--pc-border-strong)", color: "var(--pc-text-muted)" }}
                    >
                      {p.commitment_count} commitment{p.commitment_count === 1 ? "" : "s"}
                    </span>
                  </div>
                  {p.description && (
                    <p className="mt-3 text-sm" style={{ color: "var(--pc-text-muted)" }}>
                      {p.description}
                    </p>
                  )}
                </Panel>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
