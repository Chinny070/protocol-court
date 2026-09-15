"use client";

import { useState } from "react";
import Link from "next/link";
import { getPrecedent, getPrecedentIdsByTopicTag } from "@/lib/genlayer/contract";
import { Panel as PanelBox, EmptyState, LoadingState, ErrorState, MonoId, SectionLabel } from "@/components/Primitives";
import type { Precedent } from "@/lib/genlayer/types";

export default function PrecedentExplorerPage() {
  const [tag, setTag] = useState("");
  const [queried, setQueried] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "ready">("idle");
  const [results, setResults] = useState<Precedent[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function search(t: string) {
    if (!t.trim()) return;
    setStatus("loading");
    setQueried(t.trim());
    try {
      const ids = await getPrecedentIdsByTopicTag(t.trim(), 0, 25);
      const precedents = await Promise.all(ids.map((id) => getPrecedent(id)));
      setResults(precedents);
      setStatus("ready");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed.");
      setStatus("error");
    }
  }

  return (
    <div>
      <SectionLabel>Precedent Explorer</SectionLabel>
      <h1 className="text-3xl font-semibold tracking-tight">How has this been interpreted before?</h1>
      <p className="mt-2 max-w-2xl text-sm" style={{ color: "var(--pc-text-muted)" }}>
        Search settled Precedent by topic tag — the same tags filers attach to a Case when
        they file it. Every result links back to its full case record: the evidence, the
        verdict, and any challenge it survived.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          search(tag);
        }}
        className="mt-6 flex max-w-md gap-2"
      >
        <input
          value={tag}
          onChange={(e) => setTag(e.target.value)}
          placeholder="e.g. marketing, emergency-withdrawal, fee-rules"
          className="pc-mono flex-1 rounded-sm border bg-transparent px-3 py-2 text-sm"
          style={{ borderColor: "var(--pc-border-strong)" }}
        />
        <button
          type="submit"
          className="pc-mono rounded-sm border px-4 py-2 text-[0.75rem] uppercase tracking-[0.06em]"
          style={{ borderColor: "var(--pc-gold-dim)", color: "var(--pc-gold-bright)" }}
        >
          Search
        </button>
      </form>

      <div className="mt-8">
        {status === "loading" && <LoadingState label={`Searching precedent tagged “${queried}”…`} />}
        {status === "error" && error && <ErrorState message={error} />}
        {status === "ready" && results.length === 0 && (
          <EmptyState>No finalized precedent is tagged &ldquo;{queried}&rdquo; yet.</EmptyState>
        )}
        {status === "ready" && results.length > 0 && (
          <div className="flex flex-col gap-3">
            {results.map((p) => (
              <Link key={p.precedent_id} href={`/precedents/${p.precedent_id}`}>
                <PanelBox className="hover:border-[var(--pc-border-strong)]">
                  <div className="text-sm font-semibold">{p.question_presented}</div>
                  <div className="pc-mono mt-2 text-[0.75rem]" style={{ color: "var(--pc-text-faint)" }}>
                    {p.substantive_result} / {p.temporal_result}
                  </div>
                  <MonoId value={p.precedent_id} />
                </PanelBox>
              </Link>
            ))}
          </div>
        )}
        {status === "idle" && (
          <EmptyState>
            Enter a topic tag above, or browse a specific protocol / commitment page to see its
            precedent directly.
          </EmptyState>
        )}
      </div>
    </div>
  );
}
