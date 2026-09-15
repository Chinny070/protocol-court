"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useContractRead } from "@/hooks/useContractRead";
import { useTxAction } from "@/hooks/useTxAction";
import { useWallet } from "@/lib/wallet/WalletProvider";
import { createProtocol, getProtocol, getProtocolCount } from "@/lib/genlayer/contract";
import {
  Panel,
  PanelRaised,
  EmptyState,
  LoadingState,
  ErrorState,
  MonoId,
  SectionLabel,
} from "@/components/Primitives";
import { TxStatusLine } from "@/components/TxStatus";
import type { Protocol } from "@/lib/genlayer/types";

async function loadAllProtocols(): Promise<Protocol[]> {
  const count = await getProtocolCount();
  const ids = Array.from({ length: count }, (_, i) => `protocol-${i + 1}`);
  return Promise.all(ids.map((id) => getProtocol(id)));
}

function CreateProtocolForm({ onCreated }: { onCreated: () => void }) {
  const { client, address, connect, hasProvider } = useWallet();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [namespace, setNamespace] = useState("");
  const tx = useTxAction(() => {
    setName("");
    setDescription("");
    setNamespace("");
    onCreated();
  });

  const canSubmit = name.trim().length > 0 && namespace.trim().length > 0;

  return (
    <PanelRaised className="mt-8">
      <SectionLabel>Register a protocol</SectionLabel>
      {!address ? (
        <div className="flex items-center gap-3">
          <p className="text-sm" style={{ color: "var(--pc-text-muted)" }}>
            Connect a wallet to register a new protocol.
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
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Protocol name"
              className="pc-mono flex-1 rounded-sm border bg-transparent px-3 py-2 text-sm"
              style={{ borderColor: "var(--pc-border-strong)" }}
            />
            <input
              value={namespace}
              onChange={(e) => setNamespace(e.target.value)}
              placeholder="Canonical namespace (e.g. a domain)"
              className="pc-mono flex-1 rounded-sm border bg-transparent px-3 py-2 text-sm"
              style={{ borderColor: "var(--pc-border-strong)" }}
            />
          </div>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional)"
            rows={2}
            className="pc-mono mt-2 w-full rounded-sm border bg-transparent px-3 py-2 text-sm"
            style={{ borderColor: "var(--pc-border-strong)" }}
          />
          <div className="mt-3">
            <button
              onClick={() =>
                tx.run((c) => createProtocol(c, name.trim(), description.trim(), namespace.trim()), client)
              }
              disabled={!canSubmit || tx.snapshot.phase === "signing" || tx.snapshot.phase === "pending"}
              className="pc-mono rounded-sm border px-4 py-2 text-[0.75rem] uppercase tracking-[0.06em] disabled:opacity-40"
              style={{ borderColor: "var(--pc-gold-dim)", color: "var(--pc-gold-bright)" }}
            >
              Register protocol
            </button>
          </div>
          <TxStatusLine snapshot={tx.snapshot} />
        </>
      )}
    </PanelRaised>
  );
}

export default function ProtocolsPage() {
  const { status, data, error, refetch } = useProtocolsData();

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

      <CreateProtocolForm onCreated={refetch} />
    </div>
  );
}

function useProtocolsData() {
  const [reloadKey, setReloadKey] = useState(0);
  const refetch = useCallback(() => setReloadKey((k) => k + 1), []);
  const state = useContractRead(loadAllProtocols, [reloadKey]);
  return { ...state, refetch };
}
