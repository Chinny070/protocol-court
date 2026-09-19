import assert from "node:assert/strict";
import test from "node:test";

import {
  canSubmitChallenge,
  prepareChallengeSubmission,
} from "../lib/challengeSubmission.js";

test("implementation-contradiction requires a cited precedent before submission", () => {
  assert.equal(
    canSubmitChallenge({
      ground: "IMPLEMENTATION_CONTRADICTION",
      citedPrecedentId: "   ",
      argument: "The later ruling conflicts with prior precedent.",
    }),
    false,
  );

  assert.throws(
    () =>
      prepareChallengeSubmission({
        caseId: "case-7",
        ground: "IMPLEMENTATION_CONTRADICTION",
        citedEvidenceIds: [],
        citedPrecedentId: "",
        argument: "The later ruling conflicts with prior precedent.",
      }),
    /requires a cited precedent ID/,
  );
});

test("implementation-contradiction forwards a trimmed cited precedent ID", () => {
  const args = prepareChallengeSubmission({
    caseId: "case-7",
    ground: "IMPLEMENTATION_CONTRADICTION",
    citedEvidenceIds: ["evidence-3"],
    citedPrecedentId: "  precedent-2  ",
    argument: "The later ruling conflicts with precedent-2.",
  });

  assert.deepEqual(args, [
    "case-7",
    "IMPLEMENTATION_CONTRADICTION",
    ["evidence-3"],
    "precedent-2",
    "The later ruling conflicts with precedent-2.",
  ]);
  assert.equal(
    canSubmitChallenge({
      ground: "IMPLEMENTATION_CONTRADICTION",
      citedPrecedentId: "precedent-2",
      argument: "The later ruling conflicts with precedent-2.",
    }),
    true,
  );
});

test("other challenge grounds still permit an empty cited precedent ID", () => {
  const args = prepareChallengeSubmission({
    caseId: "case-7",
    ground: "IGNORED_EVIDENCE",
    citedEvidenceIds: ["evidence-3"],
    citedPrecedentId: "",
    argument: "The verdict ignored evidence-3.",
  });

  assert.equal(args[3], "");
});
