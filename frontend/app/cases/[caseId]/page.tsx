"use client";

import { use, useCallback, useState } from "react";
import Link from "next/link";
import { useContractRead } from "@/hooks/useContractRead";
import { useTxAction } from "@/hooks/useTxAction";
import { useWallet } from "@/lib/wallet/WalletProvider";
import {
  adjudicate,
  finalizeCase,
  freezeEvidence,
  getCase,
  getChallenge,
  getClause,
  getCommitment,
  getEvidence,
  getPrecedentIdsForCommitment,
  getVerdict,
  openChallenge,
  resolveChallenge,
  submitEvidence,
} from "@/lib/genlayer/contract";
import { CHALLENGE_BOND_ATTO } from "@/lib/genlayer/config";
import { canSubmitChallenge, prepareChallengeSubmission } from "@/lib/challengeSubmission";
import {
  Panel,
  PanelRaised,
  EmptyState,
  LoadingState,
  ErrorState,
  MonoId,
  SectionLabel,
  CrumbLink,
  GoldSeal,
} from "@/components/Primitives";
import { CaseStatusBadge, ChallengeStatusBadge, EvidenceStatusBadge } from "@/components/StatusBadge";
import { TxStatusLine } from "@/components/TxStatus";
import type { Case, Challenge, ChallengeGround, Clause, Commitment, Evidence, Verdict } from "@/lib/genlayer/types";
import { challengeGroundsForCase } from "@/lib/genlayer/challengeGrounds";

interface CaseDetail {
  kase: Case;
  commitment: Commitment;
  clause: Clause;
  evidence: Evidence[];
  currentVerdict: Verdict | null;
  verdictHistory: Verdict[];
  challenges: Challenge[];
  citablePrecedentIds: string[];
}

async function loadCaseDetail(caseId: string): Promise<CaseDetail> {
  const kase = await getCase(caseId);
  const [commitment, clause, evidence, verdictHistory, challenges, currentVerdict, citablePrecedentIds] = await Promise.all([
    getCommitment(kase.commitment_id),
    getClause(kase.clause_id),
    Promise.all(kase.evidence_ids.map((id) => getEvidence(id))),
    Promise.all(kase.verdict_ids.map((id) => getVerdict(id))),
    Promise.all(kase.challenge_ids.map((id) => getChallenge(id))),
    kase.current_verdict_id ? getVerdict(kase.current_verdict_id) : Promise.resolve(null),
    getPrecedentIdsForCommitment(kase.commitment_id),
  ]);
  return { kase, commitment, clause, evidence, currentVerdict, verdictHistory, challenges, citablePrecedentIds };
}

export default function CaseCourtroomPage({ params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = use(params);
  const { client, address } = useWallet();
  const { status, data, error, refetch } = useCourtroomData(caseId);

  const evidenceTx = useTxAction(refetch);
  const freezeTx = useTxAction(refetch);
  const adjudicateTx = useTxAction(refetch);
  const challengeTx = useTxAction(refetch);
  const resolveTx = useTxAction(refetch);
  const finalizeTx = useTxAction(refetch);

  const [sourceUrl, setSourceUrl] = useState("");
  const [fetchMode, setFetchMode] = useState<"get" | "render">("get");
  const [ground, setGround] = useState<ChallengeGround>("IGNORED_EVIDENCE");
  const [citedEvidenceIds, setCitedEvidenceIds] = useState<string[]>([]);
  const [citedPrecedentId, setCitedPrecedentId] = useState("");
  const [argument, setArgument] = useState("");

  const availableGrounds = data ? challengeGroundsForCase(data.citablePrecedentIds.length > 0) : [];

  const isParty = data && address && (address === data.kase.filer || address === data.kase.respondent);

  return (
    <div>
      <CrumbLink href="/cases">&larr; All cases</CrumbLink>

      {status === "loading" && <LoadingState label="Loading case record…" />}
      {status === "error" && <ErrorState message={error} />}

      {status === "ready" && data && (
        <>
          {/* Header / claim */}
          <div className="mt-4">
            <div className="flex flex-wrap items-center gap-3">
              <SectionLabel>Case</SectionLabel>
              <CaseStatusBadge status={data.kase.status} />
              {data.kase.precedent_id && <GoldSeal>Precedent {data.kase.precedent_id}</GoldSeal>}
            </div>
            <h1 className="text-2xl font-semibold leading-snug tracking-tight sm:text-3xl">
              {data.kase.question_presented}
            </h1>
            <MonoId value={data.kase.case_id} />
            <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
              <div style={{ color: "var(--pc-text-muted)" }}>
                <span style={{ color: "var(--pc-text-faint)" }}>Filer:</span> <MonoId value={data.kase.filer} truncate />
              </div>
              <div style={{ color: "var(--pc-text-muted)" }}>
                <span style={{ color: "var(--pc-text-faint)" }}>Respondent:</span>{" "}
                <MonoId value={data.kase.respondent} truncate />
              </div>
              <div className="sm:col-span-2" style={{ color: "var(--pc-text-muted)" }}>
                <span style={{ color: "var(--pc-text-faint)" }}>Cited clause:</span>{" "}
                <Link href={`/clauses/${data.kase.clause_id}`} className="underline">
                  [{data.clause.citation}] {data.clause.title}
                </Link>{" "}
                under <Link href={`/commitments/${data.kase.commitment_id}`} className="underline">{data.commitment.title} ({data.commitment.version_label})</Link>
              </div>
            </div>
            <Panel className="mt-4">
              <SectionLabel>Disputed action</SectionLabel>
              <p className="text-sm">{data.kase.disputed_act_summary}</p>
              <a href={data.kase.disputed_act_ref} target="_blank" rel="noreferrer" className="pc-mono mt-2 inline-block text-[0.75rem] underline" style={{ color: "var(--pc-blue)" }}>
                {data.kase.disputed_act_ref} ↗
              </a>
            </Panel>
          </div>

          {/* Timeline */}
          <div className="mt-10">
            <h2 className="text-lg font-semibold">Timeline</h2>
            <div className="pc-rail mt-4 flex flex-col gap-3 text-sm">
              <TimelineNode label="Filed" value={data.kase.created_at} />
              {data.kase.evidence_frozen_at && (
                <TimelineNode label="Evidence frozen" value={`${data.kase.evidence_frozen_at} · fingerprint ${data.kase.evidence_fingerprint}`} />
              )}
              {data.currentVerdict && <TimelineNode label="Adjudicated" value={data.currentVerdict.created_at} />}
              {data.kase.challenge_window_ends_at && (
                <TimelineNode label="Challenge window ends" value={data.kase.challenge_window_ends_at} />
              )}
              {data.kase.status === "FINALIZED" && <TimelineNode label="Finalized" value="" final />}
            </div>
          </div>

          {/* Evidence */}
          <div className="mt-10">
            <h2 className="text-lg font-semibold">Evidence</h2>
            {data.evidence.length === 0 ? (
              <div className="mt-4"><EmptyState>No evidence submitted yet.</EmptyState></div>
            ) : (
              <div className="mt-4 flex flex-col gap-3">
                {data.evidence.map((e) => (
                  <Link key={e.evidence_id} href={`/evidence/${e.evidence_id}`}>
                    <Panel className="hover:border-[var(--pc-border-strong)]">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <MonoId value={e.source_url} truncate />
                        <EvidenceStatusBadge status={e.retrieval_status} />
                      </div>
                    </Panel>
                  </Link>
                ))}
              </div>
            )}

            {isParty && data.kase.status === "FILED" && (
              <PanelRaised className="mt-4">
                <SectionLabel>Submit evidence (case party only)</SectionLabel>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    value={sourceUrl}
                    onChange={(e) => setSourceUrl(e.target.value)}
                    placeholder="https://…"
                    className="pc-mono flex-1 rounded-sm border bg-transparent px-3 py-2 text-sm"
                    style={{ borderColor: "var(--pc-border-strong)" }}
                  />
                  <select
                    value={fetchMode}
                    onChange={(e) => setFetchMode(e.target.value as "get" | "render")}
                    className="pc-mono rounded-sm border bg-transparent px-2 py-2 text-sm"
                    style={{ borderColor: "var(--pc-border-strong)" }}
                  >
                    <option value="get">get</option>
                    <option value="render">render</option>
                  </select>
                  <ActionButton
                    label="Submit"
                    onClick={() =>
                      evidenceTx.run(
                        (c) => submitEvidence(c, data.kase.case_id, sourceUrl, fetchMode, "", ""),
                        client,
                      )
                    }
                    disabled={!sourceUrl}
                  />
                </div>
                <TxStatusLine snapshot={evidenceTx.snapshot} />
              </PanelRaised>
            )}

            {isParty && data.kase.status === "FILED" && data.evidence.length > 0 && (
              <PanelRaised className="mt-3">
                <p className="text-sm" style={{ color: "var(--pc-text-muted)" }}>
                  Ready to freeze the evidence set? This is permanent — no more evidence can be added afterward.
                </p>
                <div className="mt-2">
                  <ActionButton
                    label="Freeze evidence"
                    onClick={() => freezeTx.run((c) => freezeEvidence(c, data.kase.case_id), client)}
                  />
                </div>
                <TxStatusLine snapshot={freezeTx.snapshot} />
              </PanelRaised>
            )}

            {data.kase.status === "EVIDENCE_FROZEN" && (
              <PanelRaised className="mt-3">
                <p className="text-sm" style={{ color: "var(--pc-text-muted)" }}>
                  Evidence is frozen. Anyone can now trigger adjudication.
                </p>
                <div className="mt-2">
                  <ActionButton
                    label="Adjudicate"
                    onClick={() => adjudicateTx.run((c) => adjudicate(c, data.kase.case_id), client)}
                  />
                </div>
                <TxStatusLine snapshot={adjudicateTx.snapshot} />
              </PanelRaised>
            )}
          </div>

          {/* Verdict */}
          <div className="mt-10">
            <h2 className="text-lg font-semibold">Verdict</h2>
            {!data.currentVerdict ? (
              <div className="mt-4"><EmptyState>No verdict yet.</EmptyState></div>
            ) : (
              <Panel className="mt-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <SectionLabel>Substantive result</SectionLabel>
                    <div className="text-base font-semibold">{data.currentVerdict.substantive_result}</div>
                  </div>
                  <div>
                    <SectionLabel>Temporal result</SectionLabel>
                    <div className="text-base font-semibold">{data.currentVerdict.temporal_result}</div>
                  </div>
                </div>
                <div className="mt-4">
                  <SectionLabel>Rationale</SectionLabel>
                  <p className="text-sm leading-relaxed">{data.currentVerdict.rationale}</p>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {data.currentVerdict.evidence_ids_relied_on.map((id) => (
                    <Link key={id} href={`/evidence/${id}`} className="pc-mono rounded-sm border px-2 py-0.5 text-[0.6875rem] underline" style={{ borderColor: "var(--pc-border)", color: "var(--pc-text-faint)" }}>
                      {id}
                    </Link>
                  ))}
                </div>
                {data.verdictHistory.length > 1 && (
                  <div className="pc-mono mt-4 text-[0.75rem]" style={{ color: "var(--pc-text-faint)" }}>
                    Lineage: {data.verdictHistory.map((v) => v.verdict_id).join(" → ")} (earlier verdicts preserved, never deleted)
                  </div>
                )}
              </Panel>
            )}
          </div>

          {/* Challenges */}
          <div className="mt-10">
            <h2 className="text-lg font-semibold">Challenges ({data.challenges.length} / 3)</h2>
            {data.challenges.length === 0 ? (
              <div className="mt-4"><EmptyState>No challenge has been filed against this verdict.</EmptyState></div>
            ) : (
              <div className="mt-4 flex flex-col gap-3">
                {data.challenges.map((ch) => (
                  <Panel key={ch.challenge_id}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="pc-mono text-[0.75rem] uppercase tracking-[0.06em]" style={{ color: "var(--pc-text-muted)" }}>
                        {ch.ground.replace(/_/g, " ")}
                      </div>
                      <ChallengeStatusBadge status={ch.status} />
                    </div>
                    <p className="mt-2 text-sm">{ch.argument}</p>
                    <MonoId value={ch.challenge_id} />
                    {ch.status === "OPEN" && (
                      <div className="mt-3">
                        <ActionButton
                          label="Resolve challenge"
                          onClick={() => resolveTx.run((c) => resolveChallenge(c, ch.challenge_id), client)}
                        />
                        <TxStatusLine snapshot={resolveTx.snapshot} />
                      </div>
                    )}
                  </Panel>
                ))}
              </div>
            )}

            {data.kase.status === "CHALLENGE_WINDOW" && data.challenges.length < 3 && (
              <PanelRaised className="mt-4">
                <SectionLabel>Open a challenge (permissionless, 1 GEN bond)</SectionLabel>
                <div className="flex flex-col gap-2">
                  <select
                    value={ground}
                    onChange={(e) => setGround(e.target.value as ChallengeGround)}
                    className="pc-mono rounded-sm border bg-transparent px-2 py-2 text-sm"
                    style={{ borderColor: "var(--pc-border-strong)" }}
                  >
                    {availableGrounds.map((g) => (
                      <option key={g} value={g}>{g.replace(/_/g, " ")}</option>
                    ))}
                  </select>
                  <div className="flex flex-wrap gap-3 text-sm">
                    {data.evidence.map((e) => (
                      <label key={e.evidence_id} className="pc-mono flex items-center gap-1 text-[0.75rem]" style={{ color: "var(--pc-text-muted)" }}>
                        <input
                          type="checkbox"
                          checked={citedEvidenceIds.includes(e.evidence_id)}
                          onChange={(ev) =>
                            setCitedEvidenceIds((prev) =>
                              ev.target.checked ? [...prev, e.evidence_id] : prev.filter((id) => id !== e.evidence_id),
                            )
                          }
                        />
                        {e.evidence_id}
                      </label>
                    ))}
                  </div>
                  {ground === "IMPLEMENTATION_CONTRADICTION" && (
                    <input
                      value={citedPrecedentId}
                      onChange={(e) => setCitedPrecedentId(e.target.value)}
                      placeholder="Cited precedent ID (for example, precedent-1)"
                      aria-label="Cited precedent ID"
                      className="pc-mono rounded-sm border bg-transparent px-3 py-2 text-sm"
                      style={{ borderColor: "var(--pc-border-strong)" }}
                    />
                  )}
                  <textarea
                    value={argument}
                    onChange={(e) => setArgument(e.target.value)}
                    placeholder="What specific defect does the verdict have?"
                    rows={2}
                    className="rounded-sm border bg-transparent px-3 py-2 text-sm"
                    style={{ borderColor: "var(--pc-border-strong)" }}
                  />
                  {ground === "IMPLEMENTATION_CONTRADICTION" && data.citablePrecedentIds.length === 0 && (
                    <p className="text-xs" style={{ color: "var(--pc-red)" }}>
                      This ground requires an existing precedent to cite. It is unavailable for this case.
                    </p>
                  )}
                  <ActionButton
                    label="Open challenge (1 GEN)"
                    onClick={() =>
                      challengeTx.run(
                        (c) =>
                          openChallenge(
                            c,
                            ...prepareChallengeSubmission({
                              caseId: data.kase.case_id,
                              ground,
                              citedEvidenceIds,
                              citedPrecedentId,
                              argument,
                            }),
                            CHALLENGE_BOND_ATTO,
                          ),
                        client,
                      )
                    }
                    disabled={!canSubmitChallenge({ ground, citedPrecedentId, argument })}
                  />
                </div>
                <TxStatusLine snapshot={challengeTx.snapshot} />
              </PanelRaised>
            )}
          </div>

          {/* Finalize */}
          {(data.kase.status === "CHALLENGE_WINDOW" || data.kase.status === "MISFILED") && !data.kase.filing_bond_settled && (
            <div className="mt-10">
              <PanelRaised>
                <p className="text-sm" style={{ color: "var(--pc-text-muted)" }}>
                  Once the challenge window elapses or the challenge cap is exhausted, anyone can finalize —
                  this refunds the filing bond and, for a settled case, mints the final Precedent.
                </p>
                <div className="mt-2">
                  <ActionButton
                    label="Finalize case"
                    onClick={() => finalizeTx.run((c) => finalizeCase(c, data.kase.case_id), client)}
                  />
                </div>
                <TxStatusLine snapshot={finalizeTx.snapshot} />
              </PanelRaised>
            </div>
          )}

          {data.kase.precedent_id && (
            <div className="mt-10">
              <Link href={`/precedents/${data.kase.precedent_id}`}>
                <PanelRaised className="flex items-center justify-between">
                  <span className="text-sm font-semibold">View this case&rsquo;s final precedent</span>
                  <GoldSeal>{data.kase.precedent_id}</GoldSeal>
                </PanelRaised>
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function TimelineNode({ label, value, final = false }: { label: string; value: string; final?: boolean }) {
  return (
    <div className={`pc-rail-node relative pl-2 ${final ? "pc-rail-node-final" : ""}`}>
      <div className="text-xs font-semibold uppercase tracking-[0.06em]" style={{ color: "var(--pc-text-muted)" }}>
        {label}
      </div>
      {value && <div className="pc-mono text-[0.75rem]" style={{ color: "var(--pc-text-faint)" }}>{value}</div>}
    </div>
  );
}

function ActionButton({ label, onClick, disabled = false }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="pc-mono rounded-sm border px-4 py-2 text-[0.75rem] uppercase tracking-[0.06em] disabled:opacity-40"
      style={{ borderColor: "var(--pc-gold-dim)", color: "var(--pc-gold-bright)" }}
    >
      {label}
    </button>
  );
}

function useCourtroomData(caseId: string) {
  const [reloadKey, setReloadKey] = useState(0);
  const refetch = useCallback(() => setReloadKey((k) => k + 1), []);
  const state = useContractRead(() => loadCaseDetail(caseId), [caseId, reloadKey]);
  return { ...state, refetch };
}
