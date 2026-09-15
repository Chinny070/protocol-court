# PROTOCOL COURT — Stage 2 Final Verification Report

Status: **Stage 2 complete.** This document is release evidence only — no contract code
was changed to produce it, no frontend was built, and no new deployment was made. It
records what Protocol Court is, what was built, and what has been proven to actually work
on a real GenLayer network.

---

## 1. Project Overview

Protocol Court is a **precedent system for Web3 commitments**. It exists to answer one
question that today has no neutral infrastructure behind it:

> "What commitment did this protocol create, what did it mean at that time, and was an
> action consistent with it?"

Protocols make commitments constantly — governance proposals, documentation,
announcements, specifications — and those commitments drift, get superseded, and
sometimes contradict each other over time. Protocol Court turns a disputed interpretation
into evidence-backed, challengeable, permanent precedent. The output that matters is not
one verdict — it is the growing, queryable body of precedent those verdicts leave behind.

**This is a different primitive from Treasury Trial**, a related but distinct project in
this workspace:

| | Treasury Trial | Protocol Court |
|---|---|---|
| Core question | "Should this policy *change*?" | "What commitment existed, how should it be interpreted, and does evidence support the action?" |
| Output | A new policy version (or rejection) | An interpretation, filed as searchable precedent |
| Cases relate to each other? | No — each resolves in isolation | Yes — a later Case can directly cite and contest an earlier Verdict as precedent |

Treasury Trial decides whether to change a policy. Protocol Court decides what a
commitment *meant* and builds a durable, cross-referenceable interpretive record from
that — the two solve genuinely different problems and share no object model.

---

## 2. Final Architecture

### Object model

```
Protocol -> Commitment (versioned, sealed) -> Clause
                                            -> Case -> Evidence
                                                    -> Verdict
                                                    -> Challenge
                                                    -> Precedent
```

- **Protocol** — the entity whose commitments are in question.
- **Commitment** — a versioned, sealed statement of position. Once sealed, a Commitment
  version is **immutable**; a later version can mark an earlier one superseded, but the
  earlier version's content is never edited or deleted, so precedent tied to it stays
  meaningful indefinitely.
- **Clause** — a specific, citable sub-provision within a sealed Commitment.
- **Case** — the immutable dispute shell: binds a filer's question to one exact sealed
  Clause inside one exact sealed Commitment version, permanently.
- **Evidence** — a frozen, fingerprinted record of one fetched source, retrieved via
  GenLayer's own web-retrieval primitives.
- **Verdict** — the adjudication outcome: a substantive result, a temporal-validity
  result, and a rationale, all schema-validated before ever touching state.
- **Challenge** — a scoped, named-defect objection to a Verdict, resolved by an
  **appellate review**, not a second trial.
- **Precedent** — the durable, queryable record a finalized Case produces, indexed by
  Protocol, Commitment, and topic tag.

### Temporal reasoning

Every Case binds to one *specific* Commitment version, chosen explicitly by the filer —
never "the current rules." Time is a first-class reasoning input: adjudication separately
evaluates whether the cited version was actually **SATISFIED** (in force), **NOT_SATISFIED**
(already legitimately superseded — evolution, not violation), or **UNCLEAR** at the time
of the disputed action, independent of the substantive question.

### Evidence freeze

Evidence retrieval and freezing happen in their own dedicated transaction, deliberately
separate from adjudication. This matters because an `Undetermined` or malformed
adjudication result must never be able to destroy the evidence record it was supposed to
reason over — freezing first means the evidence survives even if adjudication has to be
retried.

### Adjudication

A two-tier nondeterministic consensus process: Tier 1 governs evidence-retrieval fidelity
(do validators agree they retrieved the same source, not that the bytes are byte-identical);
Tier 2 governs the substantive judgment, with consensus defined over structured fields
only (never free-form rationale text). Every nondet result passes through a fail-closed
deterministic validator before a single field is written to storage.

### Appellate challenge review

A Challenge is a **scoped, named-defect review**, not a second full adjudication. It takes
the original Verdict, the same frozen evidence, and the challenger's one specific claim,
and asks only whether that claim is correct. A confirmed defect corrects only the affected
dimension(s) of the Verdict; everything else carries forward unchanged into a new,
appended Verdict. The original Verdict is never mutated or deleted — only marked
superseded — so full lineage stays readable.

### Precedent lineage

A Precedent is emitted only once a Case is settled (post-challenge-window, or once the
challenge cap is exhausted) — never from a provisional Verdict. A later Case can cite an
existing Precedent directly as grounds for an `IMPLEMENTATION_CONTRADICTION` challenge,
which is what makes this a genuine precedent *system* rather than a set of isolated
rulings.

---

## 3. Stage 2 Runtime Verification

**Test deployment** (StudioNet):

- Contract: `0xd7D2D709bB334C2BAD1D6E185eE539dF5D3B3710`
- Deployment transaction: `0x08417ce48ceb0bc07b45edb738515b920b281e6a09fd9f4243d2621fc36a3a6b`
- Result: SUCCESS, schema loaded correctly, full method list (41 methods) confirmed
  visible in GenLayer Studio.

**This was a StudioNet test instance only. It is not the production deployment.** No
canonical/production contract exists yet; none was created by this verification pass.

---

## 4. Full Lifecycle Evidence

Every step below is a real transaction, executed by the user directly against the live
test contract, with a real, observed result — not a simulation.

| Step | Result | Outcome |
|---|---|---|
| `create_protocol` | `"protocol-1"` | SUCCESS |
| `create_commitment` | `"commitment-1"` | SUCCESS |
| `add_clause` | `"clause-1"` | SUCCESS |
| `seal_commitment` | — | SUCCESS |
| `file_case` (5 GEN bond attached) | `"case-1"` | SUCCESS |
| `submit_evidence` | `"evidence-1"`, status `AVAILABLE` | SUCCESS |
| `freeze_evidence` | fingerprint `58d803a81334548e` | SUCCESS |
| `adjudicate` | `"verdict-1"` | SUCCESS |
| `open_challenge` ×3 (1 GEN each) | `challenge-1`, `challenge-2`, `challenge-3` | SUCCESS |
| `resolve_challenge` ×3 | `REJECTED` ×3 | SUCCESS |
| `finalize_case` | `"precedent-1"` | SUCCESS |

**Every step in the full lifecycle succeeded on the real network, in order, with no
workarounds and no mocked components.**

---

## 5. Evidence System Verification

- **Real web retrieval**: `submit_evidence` triggered a genuine GenLayer nondeterministic
  fetch of `https://example.org`. The response returned real page HTML and a
  `retrieval_status` of `AVAILABLE` — this was not a stub or fixture.
- **Evidence freeze fingerprint**: `freeze_evidence` produced a real fingerprint
  (`58d803a81334548e`) and moved the Case to `EVIDENCE_FROZEN`.
- **Separation from adjudication**: evidence freeze and adjudication were confirmed as
  two distinct transactions (`0x2a6a876c...` and `0xf8a0fb8a...`), not combined. This
  separation matters specifically because an `Undetermined` or otherwise malformed
  adjudication result must never be able to destroy the evidence record it reasoned
  over — splitting the two into separate transactions is what guarantees the evidence
  survives even if a later adjudication attempt has to be retried.

---

## 6. Adjudication Verification

- `adjudicate` ran live GenLayer nondeterministic reasoning and returned a fully
  schema-valid structured result (`substantive_result`, `temporal_result`, `misfiled`,
  `rationale`, `evidence_ids_relied_on`) — the fail-closed validator saw no malformed
  shape to reject on this run, and the result committed cleanly.
- **Reasoning does not directly control state**: the contract's deterministic validation
  layer sits between the raw model output and any state write, structurally, in code —
  this run simply did not need to demonstrate the rejection path (that path is covered
  extensively by the project's automated test suite instead).

**The `example.org` test case**: the evidence page submitted was a generic placeholder
with no real information about the DAO, its charter, or the disputed spend. The system
returned `substantive_result: "UNCLEAR"` and `temporal_result: "UNCLEAR"`, with a rationale
explicitly stating the evidence provided no basis for either determination.

This demonstrates safe behavior precisely because it is the *hard* case: it would have
been easy for a language model to fabricate a confident-sounding verdict from
uninformative evidence. Instead it correctly recognized the evidence didn't support any
conclusion and said so — the outcome a well-behaved adjudicator should produce, not the
outcome that happens to look most impressive.

---

## 7. Challenge Review Verification

Final appellate model, confirmed live:

```
Original verdict
      |
Specific defect challenge (named ground + citation + argument)
      |
Challenge review (same frozen evidence, same original verdict + rationale)
      |
DEFECT_CONFIRMED  or  DEFECT_NOT_CONFIRMED
```

Confirmed properties:
- **No new evidence**: the review prompt is built only from evidence already frozen for
  the Case; no additional retrieval occurs during challenge review.
- **No second unlimited trial**: each of the three test challenges asserted the same
  specific claim (`IGNORED_EVIDENCE`, citing `evidence-1`), and each review responded to
  that specific claim rather than re-deciding the case from first principles — the
  rejection reasoning in all three explicitly pointed to the original rationale already
  addressing the cited evidence.
- **Historical verdicts preserved**: no Verdict was mutated or deleted at any point.
- **Corrected verdicts would append lineage**: this run tested the rejection path three
  times (all `DEFECT_NOT_CONFIRMED`); the confirmed-defect path — where a new Verdict is
  appended and the original marked superseded — is covered by the project's automated
  test suite, not exercised live in this session.

**Three challenges were opened and resolved live; all three were correctly rejected**,
each with reasoning tied specifically to the named claim.

---

## 8. GEN Economics Verification

Only what was actually observed is claimed here.

- **Filing bond**: `file_case` required and accepted exactly 5 GEN, attached correctly;
  the transaction record shows `Value: 5 GEN` and the case was created successfully.
- **Challenge bond**: `open_challenge` required and accepted exactly 1 GEN, three separate
  times, each shown as `Value: 1 GEN` on its transaction.
- **Forfeiture path**: all three challenges were rejected (`DEFECT_NOT_CONFIRMED`), and per
  the locked economics, each 1 GEN challenge bond forfeits to the fixed pool address on
  rejection.
- **Refund path**: `finalize_case` succeeded and, per the contract's locked logic, always
  refunds the filing bond to the filer regardless of outcome. The corresponding balance
  increase was **not independently re-verified by the user after the fact** within this
  session — this is noted as an open item rather than asserted as confirmed.
- **Sustained-challenge bond refund** (challenge bond returned to a successful challenger)
  was not exercised live, since all three test challenges were rejected by design (see
  the sustained-outcome test coverage note in section 10).

---

## 9. Bugs Discovered and Fixed

Two real defects were found during live StudioNet testing — neither was caught by local
(direct-mode) automated tests, since both involve behavior specific to the real network
and real wallet tooling.

1. **Address-format crash.** The contract's constructor (and `file_case`'s `respondent`
   parameter) assumed an `address`-typed argument would arrive as an `Address` instance
   or raw `bytes`. On live StudioNet, it arrived as a plain Python `int`, and the
   contract's original coercion logic crashed with `OverflowError` when it tried to
   convert that int directly to bytes. **Fixed** with a shared `_coerce_address()` helper
   that correctly handles all three shapes (`Address`, `bytes`, `int`). Retested: the
   redeploy after this fix completed successfully.

2. **Bond amounts unusable through Studio's UI.** The original bond amounts (0.1 GEN
   filing / 0.02 GEN challenge) could not be entered through GenLayer Studio's own
   "Value (GEN)" input field, which only accepts whole integers. A related, more serious
   finding: a mistyped value in that field is not necessarily returned even when the
   underlying contract call reverts — an incorrectly-sized attached value was observed to
   remain stuck in a contract's balance despite the call itself failing. **Fixed** by
   changing both bond amounts to whole-GEN numbers (5 GEN filing / 1 GEN challenge,
   preserving the locked 5:1 ratio), which can be entered correctly and unambiguously
   through Studio's UI. Retested: all subsequent `file_case` and `open_challenge` calls in
   this session used the corrected amounts and succeeded with the exact expected value
   attached every time.

---

## 10. Remaining Limitations

- **This is not the final deployment.** The verified contract is a StudioNet test
  instance; no production/canonical contract has been deployed.
- **Frontend has not been built.** Stage 2 was contract-and-verification only.
- **Some low-risk read methods were not individually tested live** in this session
  (e.g. `get_precedent_ids_by_topic_tag`, `get_case_ids_for_clause`) — these are simple,
  bounded view methods with no state-mutation risk, and are covered by the project's
  automated direct-mode test suite (109 tests passing).
- **The sustained-challenge (`DEFECT_CONFIRMED`) path was not exercised live** — only the
  rejection path was, three times. The confirmed-defect path (new superseding Verdict,
  challenge bond refunded to the challenger) is covered by automated tests but not by a
  live transaction in this session.
- **The filing-bond refund was not independently re-verified** by checking the user's
  balance after `finalize_case` within this session.
- **Production release still requires future, separate approval** before any canonical
  deployment, any real bond amounts, or any frontend integration.

---

## 11. Stage 3 Preparation Notes

Stage 3 will build the **Protocol Court Explorer** — a public precedent explorer where
users can:

- browse protocols
- view commitments (including full version history)
- inspect clauses
- follow disputes
- view evidence trails
- understand verdict history, including challenge and correction lineage

Frontend design direction will draw from selected `DESIGN.md` templates in the design
collection, rather than a generic dashboard layout — the explorer's visual language should
reflect Protocol Court's own product identity (evidence trails, precedent lineage, verdict
history as a first-class browsing experience), not a default admin-panel look.

**No frontend implementation is part of this document or this stage.** This section is
planning notes only.

---

## Final checks

- [x] No contract files changed to produce this report.
- [x] No frontend created.
- [x] No deployment performed by this session.
- [x] Only documentation was added.

**Stage 2 is complete. Stage 3 has not started.**
