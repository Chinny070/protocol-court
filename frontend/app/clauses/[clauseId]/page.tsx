"use client";

import { use } from "react";
import Link from "next/link";
import { useContractRead } from "@/hooks/useContractRead";
import { getCase, getCaseIdsForClause, getClause, getCommitment } from "@/lib/genlayer/contract";
import { Panel, EmptyState, LoadingState, ErrorState, MonoId, SectionLabel, CrumbLink } from "@/components/Primitives";
import { CaseStatusBadge } from "@/components/StatusBadge";
import type { Case, Clause, Commitment } from "@/lib/genlayer/types";

async function loadClauseDetail(clauseId: string) {
  const clause = await getClause(clauseId);
  const commitment = await getCommitment(clause.commitment_id);
  const caseIds = await getCaseIdsForClause(clauseId, 0, 25);
  const cases = await Promise.all(caseIds.map((id) => getCase(id)));
  cases.sort((a, b) => (a.case_id < b.case_id ? 1 : -1));
  return { clause, commitment, cases } as { clause: Clause; commitment: Commitment; cases: Case[] };
}

export default function ClauseDetailPage({ params }: { params: Promise<{ clauseId: string }> }) {
  const { clauseId } = use(params);
  const { status, data, error } = useContractRead(() => loadClauseDetail(clauseId), [clauseId]);

  return (
    <div>
      {status === "ready" && (
        <CrumbLink href={`/commitments/${data.clause.commitment_id}`}>&larr; Back to commitment</CrumbLink>
      )}
      {status !== "ready" && <CrumbLink href="/protocols">&larr; All protocols</CrumbLink>}

      {status === "loading" && <LoadingState />}
      {status === "error" && <ErrorState message={error} />}

      {status === "ready" && (
        <>
          <div className="mt-4">
            <SectionLabel>Clause — {data.commitment.title} ({data.commitment.version_label})</SectionLabel>
            <h1 className="text-3xl font-semibold tracking-tight">
              [{data.clause.citation}] {data.clause.title}
            </h1>
            <MonoId value={data.clause.clause_id} />
            <Panel className="mt-4">
              <div className="text-sm leading-relaxed">{data.clause.text}</div>
            </Panel>
            {data.clause.source_ref && (
              <a
                href={data.clause.source_ref}
                target="_blank"
                rel="noreferrer"
                className="pc-mono mt-2 inline-block text-[0.8125rem] underline"
                style={{ color: "var(--pc-blue)" }}
              >
                Source reference ↗
              </a>
            )}
          </div>

          <div className="mt-10">
            <h2 className="text-lg font-semibold">Case history</h2>
            <p className="mt-1 text-sm" style={{ color: "var(--pc-text-muted)" }}>
              Version → Case → Verdict → Precedent, in the order cases were filed against this clause.
            </p>
            {data.cases.length === 0 ? (
              <div className="mt-4">
                <EmptyState>No case has ever cited this clause.</EmptyState>
              </div>
            ) : (
              <div className="pc-rail mt-6 flex flex-col gap-4">
                {data.cases.map((c) => (
                  <Link key={c.case_id} href={`/cases/${c.case_id}`}>
                    <Panel
                      className={`pc-rail-node relative hover:border-[var(--pc-border-strong)] ${
                        c.status === "FINALIZED" ? "pc-rail-node-final" : ""
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-sm font-semibold">{c.question_presented}</div>
                        <CaseStatusBadge status={c.status} />
                      </div>
                      <MonoId value={c.case_id} />
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
