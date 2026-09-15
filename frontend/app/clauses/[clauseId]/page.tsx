"use client";

import { use, useCallback, useState } from "react";
import Link from "next/link";
import { useContractRead } from "@/hooks/useContractRead";
import { useTxAction } from "@/hooks/useTxAction";
import { useWallet } from "@/lib/wallet/WalletProvider";
import { getCase, getCaseIdsForClause, getClause, getCommitment, fileCase } from "@/lib/genlayer/contract";
import { FILING_BOND_ATTO } from "@/lib/genlayer/config";
import {
  Panel,
  PanelRaised,
  EmptyState,
  LoadingState,
  ErrorState,
  MonoId,
  SectionLabel,
  CrumbLink,
} from "@/components/Primitives";
import { TxStatusLine } from "@/components/TxStatus";
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

function FileCaseForm({
  clause,
  commitment,
  onFiled,
}: {
  clause: Clause;
  commitment: Commitment;
  onFiled: () => void;
}) {
  const { client, address, connect, hasProvider } = useWallet();
  const [respondent, setRespondent] = useState("");
  const [questionPresented, setQuestionPresented] = useState("");
  const [disputedActRef, setDisputedActRef] = useState("");
  const [disputedActSummary, setDisputedActSummary] = useState("");
  const [topicTagsRaw, setTopicTagsRaw] = useState("");
  const tx = useTxAction(() => {
    setRespondent("");
    setQuestionPresented("");
    setDisputedActRef("");
    setDisputedActSummary("");
    setTopicTagsRaw("");
    onFiled();
  });

  const canSubmit =
    respondent.trim() &&
    questionPresented.trim() &&
    disputedActRef.trim() &&
    disputedActSummary.trim();
  const busy = tx.snapshot.phase === "signing" || tx.snapshot.phase === "pending";

  return (
    <PanelRaised className="mt-4">
      <SectionLabel>File a case against this clause</SectionLabel>
      <p className="mb-3 text-sm" style={{ color: "var(--pc-text-muted)" }}>
        Filing requires a {Number(FILING_BOND_ATTO) / 1e18} GEN bond, refunded when the case
        finalizes. The respondent is the address you allege acted inconsistently with this
        clause — it cannot be your own connected address.
      </p>
      {!address ? (
        <div className="flex items-center gap-3">
          <p className="text-sm" style={{ color: "var(--pc-text-muted)" }}>
            Connect a wallet to file a case.
          </p>
          <button
            onClick={connect}
            className="pc-mono rounded-sm border px-3 py-1.5 text-[0.75rem] uppercase tracking-[0.06em]"
            style={{ borderColor: "var(--pc-gold-dim)", color: "var(--pc-gold-bright)" }}
          >
            {hasProvider ? "Connect wallet" : "Check for wallet"}
          </button>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={respondent}
              onChange={(e) => setRespondent(e.target.value)}
              placeholder="Respondent address (0x…)"
              className="pc-mono flex-1 rounded-sm border bg-transparent px-3 py-2 text-sm"
              style={{ borderColor: "var(--pc-border-strong)" }}
            />
            <input
              value={topicTagsRaw}
              onChange={(e) => setTopicTagsRaw(e.target.value)}
              placeholder="Topic tags, comma-separated (optional)"
              className="pc-mono flex-1 rounded-sm border bg-transparent px-3 py-2 text-sm"
              style={{ borderColor: "var(--pc-border-strong)" }}
            />
          </div>
          <input
            value={questionPresented}
            onChange={(e) => setQuestionPresented(e.target.value)}
            placeholder="Question presented (what should be adjudicated)"
            className="pc-mono mt-2 w-full rounded-sm border bg-transparent px-3 py-2 text-sm"
            style={{ borderColor: "var(--pc-border-strong)" }}
          />
          <input
            value={disputedActRef}
            onChange={(e) => setDisputedActRef(e.target.value)}
            placeholder="Disputed act reference URL"
            className="pc-mono mt-2 w-full rounded-sm border bg-transparent px-3 py-2 text-sm"
            style={{ borderColor: "var(--pc-border-strong)" }}
          />
          <textarea
            value={disputedActSummary}
            onChange={(e) => setDisputedActSummary(e.target.value)}
            placeholder="Summary of the disputed act"
            rows={3}
            className="pc-mono mt-2 w-full rounded-sm border bg-transparent px-3 py-2 text-sm"
            style={{ borderColor: "var(--pc-border-strong)" }}
          />
          <div className="mt-3">
            <button
              onClick={() =>
                tx.run(
                  (c) =>
                    fileCase(
                      c,
                      commitment.protocol_id,
                      commitment.commitment_id,
                      clause.clause_id,
                      respondent.trim(),
                      questionPresented.trim(),
                      disputedActRef.trim(),
                      disputedActSummary.trim(),
                      topicTagsRaw
                        .split(",")
                        .map((t) => t.trim())
                        .filter(Boolean),
                      FILING_BOND_ATTO,
                    ),
                  client,
                )
              }
              disabled={!canSubmit || busy}
              title={canSubmit ? undefined : "Fill in respondent, question, act reference, and summary first"}
              className="pc-mono rounded-sm border px-4 py-2 text-[0.75rem] uppercase tracking-[0.06em] disabled:opacity-40"
              style={{ borderColor: "var(--pc-gold-dim)", color: "var(--pc-gold-bright)" }}
            >
              File case ({Number(FILING_BOND_ATTO) / 1e18} GEN)
            </button>
          </div>
          {!canSubmit && (
            <p className="mt-2 text-[0.75rem]" style={{ color: "var(--pc-text-faint)" }}>
              Respondent, question presented, act reference, and summary are required.
            </p>
          )}
          <TxStatusLine snapshot={tx.snapshot} />
        </>
      )}
    </PanelRaised>
  );
}

export default function ClauseDetailPage({ params }: { params: Promise<{ clauseId: string }> }) {
  const { clauseId } = use(params);
  const [reloadKey, setReloadKey] = useState(0);
  const refetch = useCallback(() => setReloadKey((k) => k + 1), []);
  const { status, data, error } = useContractRead(() => loadClauseDetail(clauseId), [clauseId, reloadKey]);

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

            {data.commitment.status === "ACTIVE" ? (
              <FileCaseForm clause={data.clause} commitment={data.commitment} onFiled={refetch} />
            ) : (
              <p className="mt-3 text-[0.75rem]" style={{ color: "var(--pc-text-faint)" }}>
                Cases can only be filed against a sealed (ACTIVE) commitment version. This
                clause&rsquo;s commitment is still {data.commitment.status}.
              </p>
            )}

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
