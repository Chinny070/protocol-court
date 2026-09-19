export function prepareChallengeSubmission({
  caseId,
  ground,
  citedEvidenceIds,
  citedPrecedentId,
  argument,
}) {
  const precedentId = citedPrecedentId.trim();

  if (!argument.trim()) {
    throw new Error("A challenge argument is required.");
  }

  if (ground === "IMPLEMENTATION_CONTRADICTION" && !precedentId) {
    throw new Error("An implementation-contradiction challenge requires a cited precedent ID.");
  }

  return [caseId, ground, citedEvidenceIds, precedentId, argument];
}

export function canSubmitChallenge({ ground, citedPrecedentId, argument }) {
  return Boolean(
    argument.trim() &&
      (ground !== "IMPLEMENTATION_CONTRADICTION" || citedPrecedentId.trim()),
  );
}
