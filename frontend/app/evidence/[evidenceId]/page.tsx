"use client";

import { use } from "react";
import Link from "next/link";
import { useContractRead } from "@/hooks/useContractRead";
import { getEvidence } from "@/lib/genlayer/contract";
import { Panel, LoadingState, ErrorState, MonoId, SectionLabel, CrumbLink } from "@/components/Primitives";
import { EvidenceStatusBadge } from "@/components/StatusBadge";

export default function EvidenceViewerPage({ params }: { params: Promise<{ evidenceId: string }> }) {
  const { evidenceId } = use(params);
  const { status, data, error } = useContractRead(() => getEvidence(evidenceId), [evidenceId]);

  return (
    <div>
      {status === "ready" && <CrumbLink href={`/cases/${data.case_id}`}>&larr; Back to case</CrumbLink>}
      {status !== "ready" && <CrumbLink href="/cases">&larr; All cases</CrumbLink>}

      {status === "loading" && <LoadingState />}
      {status === "error" && <ErrorState message={error} />}

      {status === "ready" && (
        <>
          <div className="mt-4">
            <div className="flex flex-wrap items-center gap-3">
              <SectionLabel>Evidence</SectionLabel>
              <EvidenceStatusBadge status={data.retrieval_status} />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight break-all">{data.source_url}</h1>
            <MonoId value={data.evidence_id} />
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <Panel>
              <SectionLabel>Retrieved</SectionLabel>
              <div className="pc-mono text-sm">{data.retrieved_at}</div>
            </Panel>
            <Panel>
              <SectionLabel>Fetch mode</SectionLabel>
              <div className="pc-mono text-sm">{data.fetch_mode}</div>
            </Panel>
            <Panel>
              <SectionLabel>Content fingerprint</SectionLabel>
              <MonoId value={data.content_fingerprint} />
            </Panel>
            <Panel>
              <SectionLabel>Submitted by</SectionLabel>
              <MonoId value={data.submitted_by} truncate />
            </Panel>
            <Panel>
              <SectionLabel>Published at (submitter-asserted)</SectionLabel>
              <div className="pc-mono text-sm">{data.published_at || "—"}</div>
            </Panel>
            <Panel>
              <SectionLabel>Effective at (submitter-asserted)</SectionLabel>
              <div className="pc-mono text-sm">{data.effective_at || "—"}</div>
            </Panel>
          </div>

          <div className="mt-8">
            <SectionLabel>Frozen excerpt</SectionLabel>
            {data.excerpt ? (
              <Panel>
                <pre className="pc-mono whitespace-pre-wrap break-words text-[0.8125rem] leading-relaxed">
                  {data.excerpt}
                </pre>
              </Panel>
            ) : (
              <Panel>
                <p className="text-sm" style={{ color: "var(--pc-text-faint)" }}>
                  No content was captured — retrieval status is {data.retrieval_status}.
                </p>
              </Panel>
            )}
          </div>

          <div className="mt-6">
            <Link
              href={`/cases/${data.case_id}`}
              className="pc-mono text-[0.8125rem] underline"
              style={{ color: "var(--pc-blue)" }}
            >
              View the case this evidence was submitted to →
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
