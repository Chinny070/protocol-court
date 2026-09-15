"use client";

import { use, useCallback, useState } from "react";
import Link from "next/link";
import { useContractRead } from "@/hooks/useContractRead";
import { useTxAction } from "@/hooks/useTxAction";
import { useWallet } from "@/lib/wallet/WalletProvider";
import {
  addClause,
  createCommitment,
  getCommitment,
  getCommitmentIdsForProtocol,
  getProtocol,
  sealCommitment,
} from "@/lib/genlayer/contract";
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

function CreateCommitmentForm({
  protocolId,
  onCreated,
}: {
  protocolId: string;
  onCreated: () => void;
}) {
  const { client } = useWallet();
  const [title, setTitle] = useState("");
  const [versionLabel, setVersionLabel] = useState("");
  const [authorityUrl, setAuthorityUrl] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const tx = useTxAction(() => {
    setTitle("");
    setVersionLabel("");
    setAuthorityUrl("");
    setEffectiveFrom("");
    onCreated();
  });

  const canSubmit = title.trim() && versionLabel.trim() && authorityUrl.trim();
  const busy = tx.snapshot.phase === "signing" || tx.snapshot.phase === "pending";

  return (
    <PanelRaised className="mt-4">
      <SectionLabel>New commitment version (protocol creator only)</SectionLabel>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title (e.g. Withdrawal policy)"
          className="pc-mono flex-1 rounded-sm border bg-transparent px-3 py-2 text-sm"
          style={{ borderColor: "var(--pc-border-strong)" }}
        />
        <input
          value={versionLabel}
          onChange={(e) => setVersionLabel(e.target.value)}
          placeholder="Version label (e.g. v1)"
          className="pc-mono w-full rounded-sm border bg-transparent px-3 py-2 text-sm sm:w-40"
          style={{ borderColor: "var(--pc-border-strong)" }}
        />
      </div>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <input
          value={authorityUrl}
          onChange={(e) => setAuthorityUrl(e.target.value)}
          placeholder="Authority URL (where this was stated)"
          className="pc-mono flex-1 rounded-sm border bg-transparent px-3 py-2 text-sm"
          style={{ borderColor: "var(--pc-border-strong)" }}
        />
        <input
          value={effectiveFrom}
          onChange={(e) => setEffectiveFrom(e.target.value)}
          placeholder="Effective from (optional, e.g. 2026-01-01)"
          className="pc-mono w-full rounded-sm border bg-transparent px-3 py-2 text-sm sm:w-56"
          style={{ borderColor: "var(--pc-border-strong)" }}
        />
      </div>
      <div className="mt-3">
        <button
          onClick={() =>
            tx.run(
              (c) =>
                createCommitment(
                  c,
                  protocolId,
                  title.trim(),
                  versionLabel.trim(),
                  authorityUrl.trim(),
                  effectiveFrom.trim(),
                  "",
                ),
              client,
            )
          }
          disabled={!canSubmit || busy}
          className="pc-mono rounded-sm border px-4 py-2 text-[0.75rem] uppercase tracking-[0.06em] disabled:opacity-40"
          style={{ borderColor: "var(--pc-gold-dim)", color: "var(--pc-gold-bright)" }}
        >
          Create commitment (draft)
        </button>
      </div>
      <TxStatusLine snapshot={tx.snapshot} />
    </PanelRaised>
  );
}

function DraftCommitmentEditor({
  commitment,
  onChanged,
}: {
  commitment: Commitment;
  onChanged: () => void;
}) {
  const { client } = useWallet();
  const [citation, setCitation] = useState("");
  const [clauseTitle, setClauseTitle] = useState("");
  const [text, setText] = useState("");
  const clauseTx = useTxAction(() => {
    setCitation("");
    setClauseTitle("");
    setText("");
    onChanged();
  });
  const sealTx = useTxAction(onChanged);

  const canAddClause = citation.trim() && clauseTitle.trim() && text.trim();
  const clauseBusy = clauseTx.snapshot.phase === "signing" || clauseTx.snapshot.phase === "pending";
  const sealBusy = sealTx.snapshot.phase === "signing" || sealTx.snapshot.phase === "pending";

  return (
    <PanelRaised className="mt-2">
      <SectionLabel>Draft — add a clause before sealing</SectionLabel>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          value={citation}
          onChange={(e) => setCitation(e.target.value)}
          placeholder="Citation (e.g. §3.2)"
          className="pc-mono w-full rounded-sm border bg-transparent px-3 py-2 text-sm sm:w-32"
          style={{ borderColor: "var(--pc-border-strong)" }}
        />
        <input
          value={clauseTitle}
          onChange={(e) => setClauseTitle(e.target.value)}
          placeholder="Clause title"
          className="pc-mono flex-1 rounded-sm border bg-transparent px-3 py-2 text-sm"
          style={{ borderColor: "var(--pc-border-strong)" }}
        />
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Clause text — the exact stated commitment"
        rows={3}
        className="pc-mono mt-2 w-full rounded-sm border bg-transparent px-3 py-2 text-sm"
        style={{ borderColor: "var(--pc-border-strong)" }}
      />
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          onClick={() =>
            clauseTx.run(
              (c) => addClause(c, commitment.commitment_id, citation.trim(), clauseTitle.trim(), text.trim(), ""),
              client,
            )
          }
          disabled={!canAddClause || clauseBusy}
          className="pc-mono rounded-sm border px-3 py-1.5 text-[0.75rem] uppercase tracking-[0.06em] disabled:opacity-40"
          style={{ borderColor: "var(--pc-gold-dim)", color: "var(--pc-gold-bright)" }}
        >
          Add clause
        </button>
        <button
          onClick={() => sealTx.run((c) => sealCommitment(c, commitment.commitment_id), client)}
          disabled={commitment.clause_count === 0 || sealBusy}
          title={commitment.clause_count === 0 ? "Add at least one clause first" : undefined}
          className="pc-mono rounded-sm border px-3 py-1.5 text-[0.75rem] uppercase tracking-[0.06em] disabled:opacity-40"
          style={{ borderColor: "var(--pc-border-strong)", color: "var(--pc-text-muted)" }}
        >
          Seal commitment (permanent)
        </button>
      </div>
      <TxStatusLine snapshot={clauseTx.snapshot} />
      <TxStatusLine snapshot={sealTx.snapshot} />
    </PanelRaised>
  );
}

export default function ProtocolDetailPage({
  params,
}: {
  params: Promise<{ protocolId: string }>;
}) {
  const { protocolId } = use(params);
  const [reloadKey, setReloadKey] = useState(0);
  const refetch = useCallback(() => setReloadKey((k) => k + 1), []);
  const { status, data, error } = useContractRead(
    () => loadProtocolWithCommitments(protocolId),
    [protocolId, reloadKey],
  );
  const { address } = useWallet();

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
            {address === data.protocol.creator && (
              <CreateCommitmentForm protocolId={data.protocol.protocol_id} onCreated={refetch} />
            )}
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
                  <div key={c.commitment_id}>
                    <Link href={`/commitments/${c.commitment_id}`}>
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
                    {c.status === "DRAFT" && address === c.creator && (
                      <DraftCommitmentEditor commitment={c} onChanged={refetch} />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
