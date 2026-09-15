"use client";

import Link from "next/link";
import { useContractRead } from "@/hooks/useContractRead";
import { getCase, getCaseCount, getCaseIdsPage } from "@/lib/genlayer/contract";
import { Panel, EmptyState, LoadingState, ErrorState, MonoId, SectionLabel } from "@/components/Primitives";
import { CaseStatusBadge } from "@/components/StatusBadge";
import type { Case } from "@/lib/genlayer/types";

async function loadAllCases(): Promise<Case[]> {
  const count = await getCaseCount();
  if (count === 0) return [];
  const ids = await getCaseIdsPage(0, Math.min(count, 25));
  const cases = await Promise.all(ids.map((id) => getCase(id)));
  return cases.sort((a, b) => (a.case_id < b.case_id ? 1 : -1));
}

export default function CasesPage() {
  const { status, data, error } = useContractRead(loadAllCases, []);

  return (
    <div>
      <SectionLabel>Dispute Cases</SectionLabel>
      <h1 className="text-3xl font-semibold tracking-tight">Cases</h1>
      <p className="mt-2 max-w-2xl text-sm" style={{ color: "var(--pc-text-muted)" }}>
        Every dispute ever filed, most recent first, showing the full range of lifecycle
        states — filed, evidence frozen, in a challenge window, or finalized.
      </p>

      <div className="mt-8">
        {status === "loading" && <LoadingState />}
        {status === "error" && <ErrorState message={error} />}
        {status === "ready" && data.length === 0 && <EmptyState>No case has been filed yet.</EmptyState>}
        {status === "ready" && data.length > 0 && (
          <div className="flex flex-col gap-3">
            {data.map((c) => (
              <Link key={c.case_id} href={`/cases/${c.case_id}`}>
                <Panel className="hover:border-[var(--pc-border-strong)]">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm font-semibold">{c.question_presented}</div>
                    <CaseStatusBadge status={c.status} />
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <MonoId value={c.case_id} />
                    {c.topic_tags.map((t) => (
                      <span
                        key={t}
                        className="pc-mono rounded-sm border px-1.5 py-0.5 text-[0.6875rem]"
                        style={{ borderColor: "var(--pc-border)", color: "var(--pc-text-faint)" }}
                      >
                        #{t}
                      </span>
                    ))}
                  </div>
                </Panel>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
