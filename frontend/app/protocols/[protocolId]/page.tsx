"use client";

import { use } from "react";
import Link from "next/link";
import { useContractRead } from "@/hooks/useContractRead";
import { getCommitment, getCommitmentIdsForProtocol, getProtocol } from "@/lib/genlayer/contract";
import { Panel, EmptyState, LoadingState, ErrorState, MonoId, SectionLabel, CrumbLink } from "@/components/Primitives";
import { CommitmentStatusBadge } from "@/components/StatusBadge";
import type { Commitment, Protocol } from "@/lib/genlayer/types";

async function loadProtocolWithCommitments(protocolId: string) {
  const protocol = await getProtocol(protocolId);
  const commitmentIds = await getCommitmentIdsForProtocol(protocolId, 0, 25);
  const commitments = await Promise.all(commitmentIds.map((id) => getCommitment(id)));
  // Newest version first, by creation order (sequential IDs).
  commitments.sort((a, b) => (a.commitment_id < b.commitment_id ? 1 : -1));
  return { protocol, commitments } as { protocol: Protocol; commitments: Commitment[] };
}

export default function ProtocolDetailPage({
  params,
}: {
  params: Promise<{ protocolId: string }>;
}) {
  const { protocolId } = use(params);
  const { status, data, error } = useContractRead(
    () => loadProtocolWithCommitments(protocolId),
    [protocolId],
  );

  return (
    <div>
      <CrumbLink href="/protocols">&larr; All protocols</CrumbLink>

      {status === "loading" && <LoadingState />}
      {status === "error" && <ErrorState message={error} />}

      {status === "ready" && (
        <>
          <div className="mt-4">
            <SectionLabel>Protocol</SectionLabel>
            <h1 className="text-3xl font-semibold tracking-tight">{data.protocol.name}</h1>
            <MonoId value={data.protocol.protocol_id} />
            {data.protocol.description && (
              <p className="mt-3 max-w-2xl text-sm" style={{ color: "var(--pc-text-muted)" }}>
                {data.protocol.description}
              </p>
            )}
            <div className="pc-mono mt-2 text-[0.75rem]" style={{ color: "var(--pc-text-faint)" }}>
              Registered by {data.protocol.creator} &middot; namespace &ldquo;
              {data.protocol.canonical_namespace}&rdquo;
            </div>
          </div>

          <div className="mt-10">
            <h2 className="text-lg font-semibold">Commitment version history</h2>
            <p className="mt-1 text-sm" style={{ color: "var(--pc-text-muted)" }}>
              Newest version first. A superseded version&rsquo;s content is never edited —
              only marked superseded — so precedent tied to it stays meaningful.
            </p>

            {data.commitments.length === 0 ? (
              <div className="mt-4">
                <EmptyState>This protocol has not sealed any commitment version yet.</EmptyState>
              </div>
            ) : (
              <div className="pc-rail mt-6 flex flex-col gap-5">
                {data.commitments.map((c) => (
                  <Link key={c.commitment_id} href={`/commitments/${c.commitment_id}`}>
                    <Panel
                      className={`pc-rail-node relative hover:border-[var(--pc-border-strong)] ${
                        c.status === "ACTIVE" ? "pc-rail-node-final" : ""
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-base font-semibold">
                          {c.title} <span style={{ color: "var(--pc-text-faint)" }}>— {c.version_label}</span>
                        </div>
                        <CommitmentStatusBadge status={c.status} />
                      </div>
                      <MonoId value={c.commitment_id} />
                      <div className="pc-mono mt-2 text-[0.75rem]" style={{ color: "var(--pc-text-faint)" }}>
                        effective {c.effective_from || "—"}
                        {c.effective_until ? ` → ${c.effective_until}` : ""} &middot; {c.clause_count} clause
                        {c.clause_count === 1 ? "" : "s"}
                        {c.superseded_by && ` · superseded by ${c.superseded_by}`}
                      </div>
                    </Panel>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
