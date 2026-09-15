"use client";

import { use } from "react";
import Link from "next/link";
import { useContractRead } from "@/hooks/useContractRead";
import {
  getClausesPage,
  getCommitment,
  getPrecedentIdsForCommitment,
  getPrecedent,
} from "@/lib/genlayer/contract";
import { Panel, EmptyState, LoadingState, ErrorState, MonoId, SectionLabel, CrumbLink } from "@/components/Primitives";
import { CommitmentStatusBadge } from "@/components/StatusBadge";
import type { Clause, Commitment, Precedent } from "@/lib/genlayer/types";

async function loadCommitmentDetail(commitmentId: string) {
  const commitment = await getCommitment(commitmentId);
  const clauses = await getClausesPage(commitmentId, 0, 25);
  const precedentIds = await getPrecedentIdsForCommitment(commitmentId, 0, 25);
  const precedents = await Promise.all(precedentIds.map((id) => getPrecedent(id)));
  return { commitment, clauses, precedents } as {
    commitment: Commitment;
    clauses: Clause[];
    precedents: Precedent[];
  };
}

export default function CommitmentDetailPage({
  params,
}: {
  params: Promise<{ commitmentId: string }>;
}) {
  const { commitmentId } = use(params);
  const { status, data, error } = useContractRead(() => loadCommitmentDetail(commitmentId), [commitmentId]);

  return (
    <div>
      {status === "ready" && (
        <CrumbLink href={`/protocols/${data.commitment.protocol_id}`}>&larr; Back to protocol</CrumbLink>
      )}
      {status !== "ready" && <CrumbLink href="/protocols">&larr; All protocols</CrumbLink>}

      {status === "loading" && <LoadingState />}
      {status === "error" && <ErrorState message={error} />}

      {status === "ready" && (
        <>
          <div className="mt-4">
            <div className="flex flex-wrap items-center gap-3">
              <SectionLabel>Commitment</SectionLabel>
              <CommitmentStatusBadge status={data.commitment.status} />
            </div>
            <h1 className="text-3xl font-semibold tracking-tight">
              {data.commitment.title} <span style={{ color: "var(--pc-text-faint)" }}>— {data.commitment.version_label}</span>
            </h1>
            <MonoId value={data.commitment.commitment_id} />
            <div className="pc-mono mt-2 text-[0.75rem]" style={{ color: "var(--pc-text-faint)" }}>
              effective {data.commitment.effective_from || "—"}
              {data.commitment.effective_until ? ` → ${data.commitment.effective_until}` : ""}
              {data.commitment.superseded_by && ` · superseded by ${data.commitment.superseded_by}`}
            </div>
            {data.commitment.authority_url && (
              <a
                href={data.commitment.authority_url}
                target="_blank"
                rel="noreferrer"
                className="pc-mono mt-2 inline-block text-[0.8125rem] underline"
                style={{ color: "var(--pc-blue)" }}
              >
                Source authority ↗
              </a>
            )}
          </div>

          <div className="mt-10">
            <h2 className="text-lg font-semibold">Clauses</h2>
            {data.clauses.length === 0 ? (
              <div className="mt-4">
                <EmptyState>This commitment version has no clauses.</EmptyState>
              </div>
            ) : (
              <div className="mt-4 flex flex-col gap-3">
                {data.clauses.map((cl) => (
                  <Link key={cl.clause_id} href={`/clauses/${cl.clause_id}`}>
                    <Panel className="hover:border-[var(--pc-border-strong)]">
                      <div className="flex items-baseline justify-between gap-3">
                        <div className="text-sm font-semibold">
                          [{cl.citation}] {cl.title}
                        </div>
                        <MonoId value={cl.clause_id} truncate />
                      </div>
                      <p className="mt-2 text-sm" style={{ color: "var(--pc-text-muted)" }}>
                        {cl.text}
                      </p>
                    </Panel>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="mt-10">
            <h2 className="text-lg font-semibold">Precedent under this commitment</h2>
            {data.precedents.length === 0 ? (
              <div className="mt-4">
                <EmptyState>No finalized cases have interpreted this commitment yet.</EmptyState>
              </div>
            ) : (
              <div className="mt-4 flex flex-col gap-3">
                {data.precedents.map((p) => (
                  <Link key={p.precedent_id} href={`/precedents/${p.precedent_id}`}>
                    <Panel className="hover:border-[var(--pc-border-strong)]">
                      <div className="text-sm">{p.question_presented}</div>
                      <div className="pc-mono mt-2 text-[0.75rem]" style={{ color: "var(--pc-text-faint)" }}>
                        {p.substantive_result} / {p.temporal_result}
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
