import type { CaseStatus, ChallengeStatus, CommitmentStatus, EvidenceStatus } from "@/lib/genlayer/types";

type Kind = "neutral" | "open" | "dispute" | "settled" | "final";

const CASE_STATUS_KIND: Record<CaseStatus, Kind> = {
  FILED: "neutral",
  EVIDENCE_FROZEN: "open",
  ADJUDICATED: "open",
  CHALLENGE_WINDOW: "dispute",
  FINALIZED: "final",
  MISFILED: "dispute",
};

const CHALLENGE_STATUS_KIND: Record<ChallengeStatus, Kind> = {
  OPEN: "dispute",
  SUSTAINED: "settled",
  REJECTED: "neutral",
};

const COMMITMENT_STATUS_KIND: Record<CommitmentStatus, Kind> = {
  DRAFT: "neutral",
  ACTIVE: "settled",
  SUPERSEDED: "neutral",
};

const EVIDENCE_STATUS_KIND: Record<EvidenceStatus, Kind> = {
  AVAILABLE: "settled",
  UNAVAILABLE: "dispute",
  FETCH_FAILED: "dispute",
};

const KIND_CLASS: Record<Kind, string> = {
  neutral: "pc-status-neutral",
  open: "pc-status-open",
  dispute: "pc-status-dispute",
  settled: "pc-status-settled",
  final: "pc-status-final",
};

function Pill({ label, kind }: { label: string; kind: Kind }) {
  return <span className={`pc-status ${KIND_CLASS[kind]}`}>{label}</span>;
}

export function CaseStatusBadge({ status }: { status: CaseStatus }) {
  return <Pill label={status.replace(/_/g, " ")} kind={CASE_STATUS_KIND[status]} />;
}

export function ChallengeStatusBadge({ status }: { status: ChallengeStatus }) {
  return <Pill label={status} kind={CHALLENGE_STATUS_KIND[status]} />;
}

export function CommitmentStatusBadge({ status }: { status: CommitmentStatus }) {
  return <Pill label={status} kind={COMMITMENT_STATUS_KIND[status]} />;
}

export function EvidenceStatusBadge({ status }: { status: EvidenceStatus }) {
  return <Pill label={status.replace(/_/g, " ")} kind={EVIDENCE_STATUS_KIND[status]} />;
}
