"use client";

import { use } from "react";
import Link from "next/link";
import { useContractRead } from "@/hooks/useContractRead";
import { getPrecedent, getVerdict } from "@/lib/genlayer/contract";
import { Panel, LoadingState, ErrorState, MonoId, SectionLabel, CrumbLink, GoldSeal } from "@/components/Primitives";
import type { Precedent, Verdict } from "@/lib/genlayer/types";

async function loadPrecedentDetail(precedentId: string) {
  const precedent = await getPrecedent(precedentId);
  const verdict = await getVerdict(precedent.verdict_id);
  return { precedent, verdict } as { precedent: Precedent; verdict: Verdict };
}

export default function PrecedentDetailPage({ params }: { params: Promise<{ precedentId: string }> }) {
  const { precedentId } = use(params);
  const { status, data, error } = useContractRead(() => loadPrecedentDetail(precedentId), [precedentId]);

  return (
    <div>
      <CrumbLink href="/precedents">&larr; Precedent Explorer</CrumbLink>

      {status === "loading" && <LoadingState />}
      {status === "error" && <ErrorState message={error} />}

      {status === "ready" && (
        <>
          <div className="mt-4">
            <div className="flex flex-wrap items-center gap-3">
              <SectionLabel>Precedent</SectionLabel>
              <GoldSeal>Finalized</GoldSeal>
            </div>
            <h1 className="text-2xl font-semibold leading-snug tracking-tight sm:text-3xl">
              {data.precedent.question_presented}
            </h1>
            <MonoId value={data.precedent.precedent_id} />
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <Panel>
              <SectionLabel>Substantive result</SectionLabel>
              <div className="text-base font-semibold">{data.precedent.substantive_result}</div>
            </Panel>
            <Panel>
              <SectionLabel>Temporal result</SectionLabel>
              <div className="text-base font-semibold">{data.precedent.temporal_result}</div>
            </Panel>
          </div>

          <div className="mt-6">
            <SectionLabel>Rationale (from the final verdict)</SectionLabel>
            <Panel>
              <p className="text-sm leading-relaxed">{data.verdict.rationale}</p>
            </Panel>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            {data.precedent.topic_tags.map((t) => (
              <Link
                key={t}
                href={`/precedents?tag=${encodeURIComponent(t)}`}
                className="pc-mono rounded-sm border px-2 py-0.5 text-[0.6875rem]"
                style={{ borderColor: "var(--pc-border)", color: "var(--pc-text-faint)" }}
              >
                #{t}
              </Link>
            ))}
          </div>

          <div className="mt-8 flex flex-col gap-2 text-sm">
            <Link href={`/protocols/${data.precedent.protocol_id}`} className="underline" style={{ color: "var(--pc-blue)" }}>
              View the protocol this precedent belongs to →
            </Link>
            <Link href={`/commitments/${data.precedent.commitment_id}`} className="underline" style={{ color: "var(--pc-blue)" }}>
              View the commitment version interpreted →
            </Link>
            <Link href={`/clauses/${data.precedent.clause_id}`} className="underline" style={{ color: "var(--pc-blue)" }}>
              View the clause →
            </Link>
            <Link href={`/cases/${data.precedent.case_id}`} className="underline" style={{ color: "var(--pc-blue)" }}>
              View the originating case, evidence, and full challenge history →
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
