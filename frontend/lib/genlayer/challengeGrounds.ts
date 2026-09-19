import type { ChallengeGround } from "./types";

export const CHALLENGE_GROUNDS: ChallengeGround[] = [
  "IGNORED_EVIDENCE",
  "WRONG_TEMPORAL_INTERPRETATION",
  "SOURCE_AUTHORITY_ERROR",
  "IMPLEMENTATION_CONTRADICTION",
];

/**
 * An implementation-contradiction challenge is only valid when the caller
 * can cite an existing precedent. Keep the UI from offering an on-chain
 * action that the contract must reject.
 */
export function challengeGroundsForCase(hasCitablePrecedent: boolean): ChallengeGround[] {
  return hasCitablePrecedent
    ? CHALLENGE_GROUNDS
    : CHALLENGE_GROUNDS.filter((ground) => ground !== "IMPLEMENTATION_CONTRADICTION");
}
