/**
 * Mirrors of the on-chain shapes returned by contracts/protocol_court.py's
 * `to_dict()` methods. Protocol Court's view methods return plain GenVM
 * dicts directly (never `json.dumps`-wrapped strings, unlike some sibling
 * projects in this workspace) -- genlayer-js decodes these into plain JS
 * objects, no JSON.parse step needed anywhere in lib/genlayer/contract.ts.
 * Field names are kept snake_case, unchanged from the contract, so there is
 * never ambiguity about what came from the chain vs. was derived
 * client-side.
 */

export type CommitmentStatus = "DRAFT" | "ACTIVE" | "SUPERSEDED";

export type CaseStatus =
  | "FILED"
  | "EVIDENCE_FROZEN"
  | "ADJUDICATED"
  | "CHALLENGE_WINDOW"
  | "FINALIZED"
  | "MISFILED";

export type EvidenceStatus = "AVAILABLE" | "UNAVAILABLE" | "FETCH_FAILED";

export type SubstantiveResult = "CONSISTENT" | "INCONSISTENT" | "UNCLEAR";

export type TemporalResult = "SATISFIED" | "NOT_SATISFIED" | "UNCLEAR";

export type ChallengeGround =
  | "IGNORED_EVIDENCE"
  | "WRONG_TEMPORAL_INTERPRETATION"
  | "SOURCE_AUTHORITY_ERROR"
  | "IMPLEMENTATION_CONTRADICTION";

export type ChallengeStatus = "OPEN" | "SUSTAINED" | "REJECTED";

export interface Protocol {
  protocol_id: string;
  creator: string;
  name: string;
  description: string;
  canonical_namespace: string;
  commitment_count: number;
  created_at: string;
}

export interface Commitment {
  commitment_id: string;
  protocol_id: string;
  creator: string;
  title: string;
  version_label: string;
  authority_url: string;
  effective_from: string;
  effective_until: string;
  clause_count: number;
  sealed: boolean;
  created_at: string;
  sealed_at: string;
  status: CommitmentStatus;
  superseded_by: string;
}

export interface Clause {
  clause_id: string;
  commitment_id: string;
  citation: string;
  title: string;
  text: string;
  source_ref: string;
  ordinal: number;
}

export interface Case {
  case_id: string;
  filer: string;
  respondent: string;
  protocol_id: string;
  commitment_id: string;
  clause_id: string;
  question_presented: string;
  disputed_act_ref: string;
  disputed_act_summary: string;
  topic_tags: string[];
  status: CaseStatus;
  created_at: string;
  evidence_ids: string[];
  evidence_frozen_at: string;
  evidence_fingerprint: string;
  current_verdict_id: string;
  verdict_ids: string[];
  challenge_ids: string[];
  challenge_window_ends_at: string;
  /** Atto (10^18 = 1 GEN). A u256 on-chain -- always exceeds
   * Number.MAX_SAFE_INTEGER for real bond amounts, so this is a bigint,
   * never a number. */
  filing_bond_amount: bigint;
  filing_bond_settled: boolean;
  precedent_id: string;
}

export interface Evidence {
  evidence_id: string;
  case_id: string;
  source_url: string;
  fetch_mode: "get" | "render";
  retrieval_status: EvidenceStatus;
  excerpt: string;
  content_fingerprint: string;
  retrieved_at: string;
  published_at: string;
  effective_at: string;
  timestamp_provenance: "SUBMITTER_ASSERTED";
  submitted_by: string;
}

export interface Verdict {
  verdict_id: string;
  case_id: string;
  substantive_result: SubstantiveResult;
  temporal_result: TemporalResult;
  misfiled: boolean;
  rationale: string;
  evidence_ids_relied_on: string[];
  evidence_fingerprint: string;
  created_at: string;
  superseded: boolean;
  superseded_by: string;
}

export interface Challenge {
  challenge_id: string;
  case_id: string;
  verdict_id_challenged: string;
  challenger: string;
  ground: ChallengeGround;
  cited_evidence_ids: string[];
  cited_precedent_id: string;
  argument: string;
  status: ChallengeStatus;
  resulting_verdict_id: string;
  created_at: string;
  resolved_at: string;
}

export interface Precedent {
  precedent_id: string;
  case_id: string;
  protocol_id: string;
  commitment_id: string;
  clause_id: string;
  question_presented: string;
  verdict_id: string;
  substantive_result: SubstantiveResult;
  temporal_result: TemporalResult;
  topic_tags: string[];
  created_at: string;
}
