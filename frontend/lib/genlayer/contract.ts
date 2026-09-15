import type { GenLayerChain, GenLayerClient, TransactionHash } from "genlayer-js/types";
import { CalldataAddress, TransactionHashVariant, TransactionStatus } from "genlayer-js/types";
import { getAddress, hexToBytes } from "viem";
import { PROTOCOL_COURT_ADDRESS, readClient } from "./config";
import type {
  Case,
  Challenge,
  Clause,
  Commitment,
  Evidence,
  Precedent,
  Protocol,
  Verdict,
} from "./types";

export type AnyClient = GenLayerClient<GenLayerChain>;

/** Protocol Court's view methods return plain GenVM dicts/lists directly
 * (never a json.dumps-wrapped string) -- decode as-is, no JSON.parse. */
async function read<T>(
  functionName: string,
  args: unknown[] = [],
  client: AnyClient = readClient,
): Promise<T> {
  const raw = await client.readContract({
    address: PROTOCOL_COURT_ADDRESS,
    functionName,
    args: args as never[],
    transactionHashVariant: TransactionHashVariant.LATEST_FINAL,
  });
  return raw as T;
}

// ---- reads: Protocol / Commitment / Clause -------------------------------

export const getProtocol = (protocolId: string) => read<Protocol>("get_protocol", [protocolId]);
export const getProtocolCount = () => read<number>("get_protocol_count");
export const getCommitmentIdsForProtocol = (protocolId: string, offset = 0, limit = 25) =>
  read<string[]>("get_commitment_ids_for_protocol", [protocolId, offset, limit]);
export const getCommitment = (commitmentId: string) =>
  read<Commitment>("get_commitment", [commitmentId]);
export const getClauseCount = (commitmentId: string) =>
  read<number>("get_clause_count", [commitmentId]);
export const getClause = (clauseId: string) => read<Clause>("get_clause", [clauseId]);
export const getClausesPage = (commitmentId: string, offset = 0, limit = 25) =>
  read<Clause[]>("get_clauses_page", [commitmentId, offset, limit]);

// ---- reads: Case ----------------------------------------------------------

export const getCase = (caseId: string) => read<Case>("get_case", [caseId]);
export const getCaseCount = () => read<number>("get_case_count");
export const getCaseIdsPage = (offset = 0, limit = 25) =>
  read<string[]>("get_case_ids_page", [offset, limit]);
export const getCaseIdsForProtocol = (protocolId: string, offset = 0, limit = 25) =>
  read<string[]>("get_case_ids_for_protocol", [protocolId, offset, limit]);
export const getCaseIdsForClause = (clauseId: string, offset = 0, limit = 25) =>
  read<string[]>("get_case_ids_for_clause", [clauseId, offset, limit]);

// ---- reads: Evidence / Verdict / Challenge / Precedent --------------------

export const getEvidence = (evidenceId: string) => read<Evidence>("get_evidence", [evidenceId]);
export const getEvidenceIdsForCase = (caseId: string) =>
  read<string[]>("get_evidence_ids_for_case", [caseId]);

export const getVerdict = (verdictId: string) => read<Verdict>("get_verdict", [verdictId]);
export const getCurrentVerdictForCase = (caseId: string) =>
  read<Verdict>("get_current_verdict_for_case", [caseId]);

export const getChallenge = (challengeId: string) =>
  read<Challenge>("get_challenge", [challengeId]);
export const getChallengeIdsForCase = (caseId: string) =>
  read<string[]>("get_challenge_ids_for_case", [caseId]);

export const getPrecedent = (precedentId: string) =>
  read<Precedent>("get_precedent", [precedentId]);
export const getPrecedentIdsForProtocol = (protocolId: string, offset = 0, limit = 25) =>
  read<string[]>("get_precedent_ids_for_protocol", [protocolId, offset, limit]);
export const getPrecedentIdsForCommitment = (commitmentId: string, offset = 0, limit = 25) =>
  read<string[]>("get_precedent_ids_for_commitment", [commitmentId, offset, limit]);
export const getPrecedentIdsByTopicTag = (tag: string, offset = 0, limit = 25) =>
  read<string[]>("get_precedent_ids_by_topic_tag", [tag, offset, limit]);

// ---- reads: bond configuration / accounting -------------------------------

/** All atto-denominated (10^18 = 1 GEN); a u256 on-chain, so always a
 * bigint -- these regularly exceed Number.MAX_SAFE_INTEGER. */
export const getFilingBondAmount = () => read<bigint>("get_filing_bond_amount");
export const getChallengeBondAmount = () => read<bigint>("get_challenge_bond_amount");
export const getPoolAddress = () => read<string>("get_pool_address");
export const getTotalForfeitedToPool = () => read<bigint>("get_total_forfeited_to_pool");
export const getBalance = () => read<bigint>("get_balance");

// ---- writes (non-payable) — require a connected wallet client ------------

async function write(
  client: AnyClient,
  functionName: string,
  args: unknown[],
  value = 0n,
): Promise<TransactionHash> {
  const hash = await client.writeContract({
    address: PROTOCOL_COURT_ADDRESS,
    functionName,
    args: args as never[],
    value,
  });
  return hash as TransactionHash;
}

export const createProtocol = (
  client: AnyClient,
  name: string,
  description: string,
  canonicalNamespace: string,
) => write(client, "create_protocol", [name, description, canonicalNamespace]);

export const createCommitment = (
  client: AnyClient,
  protocolId: string,
  title: string,
  versionLabel: string,
  authorityUrl: string,
  effectiveFrom: string,
  effectiveUntil: string,
) =>
  write(client, "create_commitment", [
    protocolId,
    title,
    versionLabel,
    authorityUrl,
    effectiveFrom,
    effectiveUntil,
  ]);

export const sealCommitment = (client: AnyClient, commitmentId: string) =>
  write(client, "seal_commitment", [commitmentId]);

export const markCommitmentSuperseded = (
  client: AnyClient,
  commitmentId: string,
  supersededByCommitmentId: string,
) => write(client, "mark_commitment_superseded", [commitmentId, supersededByCommitmentId]);

export const addClause = (
  client: AnyClient,
  commitmentId: string,
  citation: string,
  title: string,
  text: string,
  sourceRef: string,
) => write(client, "add_clause", [commitmentId, citation, title, text, sourceRef]);

/** GenLayer's calldata format has a dedicated address wire type -- a plain
 * hex string sent as an argument gets encoded as generic text instead, and
 * the contract's Address parser rejects it. `CalldataAddress` (from
 * genlayer-js/types) is how the SDK expects a caller to mark a value as an
 * on-chain Address: raw 20 bytes, not a "0x…" string. Use for every
 * Address-typed parameter this contract's write methods accept from a
 * caller (currently only `respondent` on file_case). */
function toCalldataAddress(hex: string): CalldataAddress {
  return new CalldataAddress(hexToBytes(getAddress(hex)));
}

/** Payable: `valueAtto` must equal FILING_BOND_ATTO exactly (see
 * lib/genlayer/config.ts), or the contract reverts with
 * EXPECTED:FILING_BOND_MISMATCH. */
export const fileCase = (
  client: AnyClient,
  protocolId: string,
  commitmentId: string,
  clauseId: string,
  respondent: string,
  questionPresented: string,
  disputedActRef: string,
  disputedActSummary: string,
  topicTags: string[],
  valueAtto: bigint,
) =>
  write(
    client,
    "file_case",
    [
      protocolId,
      commitmentId,
      clauseId,
      toCalldataAddress(respondent),
      questionPresented,
      disputedActRef,
      disputedActSummary,
      topicTags,
    ],
    valueAtto,
  );

export const submitEvidence = (
  client: AnyClient,
  caseId: string,
  sourceUrl: string,
  fetchMode: "get" | "render",
  publishedAt: string,
  effectiveAt: string,
) => write(client, "submit_evidence", [caseId, sourceUrl, fetchMode, publishedAt, effectiveAt]);

export const freezeEvidence = (client: AnyClient, caseId: string) =>
  write(client, "freeze_evidence", [caseId]);

export const adjudicate = (client: AnyClient, caseId: string) =>
  write(client, "adjudicate", [caseId]);

/** Payable: `valueAtto` must equal CHALLENGE_BOND_ATTO exactly, or the
 * contract reverts with EXPECTED:CHALLENGE_BOND_MISMATCH. */
export const openChallenge = (
  client: AnyClient,
  caseId: string,
  ground: string,
  citedEvidenceIds: string[],
  citedPrecedentId: string,
  argument: string,
  valueAtto: bigint,
) =>
  write(
    client,
    "open_challenge",
    [caseId, ground, citedEvidenceIds, citedPrecedentId, argument],
    valueAtto,
  );

export const resolveChallenge = (client: AnyClient, challengeId: string) =>
  write(client, "resolve_challenge", [challengeId]);

export const finalizeCase = (client: AnyClient, caseId: string) =>
  write(client, "finalize_case", [caseId]);

// ---- protocol lifecycle (GenLayer transaction layer, not a contract method) --

/**
 * Never trust a write call's return value (a transaction hash) as proof
 * anything succeeded. GenLayer's Optimistic Democracy consensus can settle
 * on Undetermined even when the leader's own execution looked successful --
 * always wait for a real status and then re-read contract state, the same
 * discipline every prior GenLayer project in this workspace has required.
 */
export async function waitForStatus(
  client: AnyClient,
  hash: TransactionHash,
  status: TransactionStatus = TransactionStatus.ACCEPTED,
  opts: { retries?: number; interval?: number } = {},
) {
  return client.waitForTransactionReceipt({
    hash,
    status,
    retries: opts.retries ?? 150,
    interval: opts.interval ?? 2000,
  });
}

export async function getTransaction(hash: TransactionHash, client: AnyClient = readClient) {
  return client.getTransaction({ hash });
}

export { TransactionStatus };
