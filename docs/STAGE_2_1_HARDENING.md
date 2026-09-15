# PROTOCOL COURT — Stage 2.1 Hardening Pass

Status: **design + targeted code hardening, no deployment, no frontend, no live
transactions.** Covers the six items raised in Stage 2.1 review.

---

## 1. Challenge semantics — recommendation (not yet implemented)

### What the contract does today

`resolve_challenge` runs a **complete, independent re-adjudication** of the whole case:
same prompt, same frozen evidence, from zero. It then mechanically compares the fresh
judgment's structured fields (`substantive_result`, `temporal_result`, `misfiled`) to the
verdict being challenged. Disagreement -> `SUSTAINED`; agreement -> `REJECTED`.

### The problem with this, precisely

1. **The challenge's own content is discarded.** A `Challenge` object carries a specific
   `ground` (one of four defect categories) plus a required citation (an Evidence ID or a
   Precedent ID) and an `argument`. None of that ever reaches the resolution prompt. A
   challenger who correctly points at "the verdict never addressed evidence-3" gets exactly
   the same resolution procedure as a challenger who just clicks through with a placeholder
   argument — the specific defect is never actually checked against the specific claim.
2. **Outcome is closer to a coin flip than a defect check.** An LLM re-run on an identical
   prompt is not perfectly stable. A genuinely correct original verdict can get overturned
   by re-run variance alone; a genuinely defective one can get reaffirmed by the same
   variance. Nothing in the mechanism is *targeted* at the alleged defect, so nothing in it
   is protected from this noise.
3. **It is, functionally, exactly "a second unlimited court"** — the concern you named.
   Each challenge re-litigates the entire question from scratch with full authority to
   produce a completely different answer, constrained by nothing the challenger actually
   argued.

### Recommendation: replace with a targeted challenge-review layer

Keep the two-tier nondet architecture (still `gl.vm.run_nondet(leader_fn, validator_fn)`,
still structured-field consensus, still a fail-closed deterministic validator in front of
state) — change what the leader/validator are asked to do.

**New prompt task**, built from: the frozen evidence (unchanged), the **original Verdict**
(its `substantive_result`, `temporal_result`, `misfiled`, and — critically — its
`rationale`), and the **Challenge's own fields** (`ground`, `cited_evidence_ids` /
`cited_precedent_id`, `argument`). The task becomes: *"Given this original verdict and the
reasoning it gave, and this specific, named objection, does the objection identify a real
defect of the stated kind? Do not re-decide the case from first principles — evaluate
whether this particular claim about this particular verdict is correct."*

**New judgment schema** (narrower than a full adjudication judgment):

```
{
  "defect_confirmed": true|false,
  "corrected_substantive_result": "CONSISTENT|INCONSISTENT|UNCLEAR|UNCHANGED",
  "corrected_temporal_result": "SATISFIED|NOT_SATISFIED|UNCLEAR|UNCHANGED",
  "corrected_misfiled": true|false|"UNCHANGED",
  "reasoning": "<concise, ties directly to the challenge's citation>"
}
```

`defect_confirmed=false` -> `REJECTED`, bond forfeited, verdict stands untouched.
`defect_confirmed=true` -> `SUSTAINED`; the corrected fields (falling back to the
original's value wherever `"UNCHANGED"` is returned) produce a new superseding Verdict —
so a confirmed defect can correct *just* the dimension it affected (e.g. only
`temporal_result` for a `WRONG_TEMPORAL_INTERPRETATION` ground) without silently relitigating
dimensions the challenge never touched. Consensus (Tier "2.1") is still over the structured
`defect_confirmed` + corrected-fields tuple only — never over `reasoning` text, preserving
the existing "never free-form explanation matching" rule.

### Trade-offs, honestly

- **More implementation work**: a new prompt builder, a new judgment validator, and new
  tests replacing the current `resolve_challenge` tests that assert full-re-adjudication
  behavior (several of the existing Stage 2 challenge tests would need to change their
  mocked judgments to the new schema).
- **Still not literally "expanded-committee re-adjudication"** in the GenLayer-native
  sense (that remains a chain-level protocol appeal, external to contract code, as already
  flagged in the Stage 2 report) — this is a within-contract review step either way. The
  change here is about what the review *evaluates* (a named defect vs. redoing everything),
  not about who evaluates it.
- **Bounded is the point**: a targeted review is structurally incapable of drifting the case
  to an outcome the challenger never argued for, which a full re-adjudication can (and, per
  the noise argument above, sometimes will).

**This is a recommendation only — `resolve_challenge` has not been changed in this pass.**
Say the word and Stage 2.1 will implement it next; the rest of this document assumes no
change to challenge resolution yet.

---

## 2. Challenge bond destination

Implemented in this pass. `pool_address` is now documented in-contract as the **"Protocol
Court Integrity Pool"**: a pure accumulation sink for bonds forfeited by rejected
challenges, with no spending logic anywhere in this stage. A new `total_forfeited_to_pool`
counter and `get_total_forfeited_to_pool()` view give anyone a transparent, on-chain-
readable running total, independent of trusting the pool address's own balance history.

**Recommended default**: a canonical burn address (e.g.
`0x000000000000000000000000000000000000dEaD`) unless the deployer has a specific plan for
the accumulated funds (e.g. subsidizing the rare human-escalation tier in a later stage).
Burn is the most trust-minimized choice — it removes any possible reading that whoever
deploys this contract benefits financially from challenges being rejected. This is a
deploy-time decision (the constructor argument), not something this stage hardcodes; the
recommendation is documented in-contract right next to the field.

---

## 3. Storage bounds — finalized for V1

No longer placeholders (Stage 1 sec 18 item 2, closed). Values unchanged from Stage 2
except the newly-added explicit `MAX_PRECEDENTS`; this table is the authoritative record.

| Cap | Value | Rationale |
|---|---|---|
| `MAX_PROTOCOLS` | 100 | Carried from the pre-spec scaffold's own reasoned cap; ample for an early deployment covering many DAOs/protocols |
| `MAX_COMMITMENTS_PER_PROTOCOL` | 32 | A protocol's commitment-version history over years; 32 versions is generous headroom |
| `MAX_CLAUSES_PER_COMMITMENT` | 64 | Matches a realistic charter/policy document's clause count |
| `MAX_CASES` (global) | 256 | Early-deployment scale; matches this workspace's precedent for a structurally similar dispute contract |
| `MAX_CASES_PER_CLAUSE` | 64 | Prevents one clause from being spammed with disputes while allowing genuine repeat litigation |
| `MAX_EVIDENCE_PER_CASE` | 12 | Matches this workspace's Treasury Trial (same order of magnitude, independently reasoned there too) |
| `MAX_CHALLENGES_PER_CASE` | 3 | Locked in Stage 1 review; matches the same workspace precedent |
| `MAX_PRECEDENTS` | = `MAX_CASES` (256) | A Precedent is emitted at most once per Case, so this was already implied — now enforced explicitly and defensively in `finalize_case` rather than left implicit |
| `MAX_PAGE_SIZE` | 25 | Standard bounded-pagination size used throughout every view method |
| `MAX_NAME_LEN` / `MAX_DESCRIPTION_LEN` / `MAX_NAMESPACE_LEN` | 200 / 2000 / 64 | Protocol identity fields |
| `MAX_COMMITMENT_TITLE_LEN` / `MAX_VERSION_LABEL_LEN` / `MAX_URL_LEN` / `MAX_DATE_LEN` | 200 / 64 / 512 / 32 | Commitment metadata |
| `MAX_CITATION_LEN` / `MAX_CLAUSE_TITLE_LEN` / `MAX_CLAUSE_TEXT_LEN` | 120 / 200 / 1200 | Clause fields — 1200 chars comfortably covers one governance clause |
| `MAX_QUESTION_PRESENTED_LEN` / `MAX_DISPUTED_ACT_REF_LEN` / `MAX_DISPUTED_ACT_SUMMARY_LEN` | 480 / 512 / 600 | Case filing fields |
| `MAX_RAW_FETCH_LEN` / `MAX_EVIDENCE_EXCERPT_LEN` | 20000 / 3000 | Raw fetch is truncated hard before ever reaching an excerpt; the *stored* excerpt is capped far below that, matching Stage 1 sec 6.2's "never the full page" rule |
| `MAX_TIMESTAMP_LEN` | 32 | Fits any ISO 8601 timestamp with margin |
| `MAX_VERDICT_RATIONALE_LEN` | 1500 | Enough for a substantive rationale; still a hard ceiling against runaway LLM output |
| `MAX_EVIDENCE_IDS_RELIED_ON` | = `MAX_EVIDENCE_PER_CASE` (12) | Cannot exceed the evidence actually available to cite |
| `MAX_CHALLENGE_ARGUMENT_LEN` | 1000 | Enough to state a specific defect; not enough to smuggle an essay |
| `MAX_CHALLENGE_CITED_EVIDENCE_IDS` | 6 | A defect citation should be a handful of specific items, not the whole evidence set |
| `MAX_PRECEDENT_ID_LEN` | 64 | Matches this contract's own ID format headroom |
| `MAX_TOPIC_TAGS_PER_CASE` / `MAX_TOPIC_TAG_LEN` | 8 / 40 | Keeps the Explorer's topic index cheap to query and free-form tags short |
| `CHALLENGE_WINDOW_SECONDS` | 259200 (3 days) | A best-effort, non-authoritative on-chain gate — see the in-code comment on wall-clock gates in this workspace |

Raising or lowering any of these requires a redeploy; none has a runtime setter, matching
item 6's "no governance adjustment in V1."

---

## 4. Bond configuration — recommended values

Unchanged mechanism (fixed module constants, no setter), rationale now documented in-code
and restated here:

- **`FILING_BOND_ATOMS` = 0.1 GEN.** Meaningful-but-not-prohibitive anti-spam friction,
  deliberately flat regardless of the disputed action's size — Protocol Court adjudicates
  meaning, not damages (Stage 1 sec 10).
- **`CHALLENGE_BOND_ATOMS` = 0.02 GEN — fixed at exactly 1/5 of the filing bond.** A
  challenge is a narrower, cheaper action (one named defect, not a whole new case), so its
  friction is proportionally lighter, while still real enough that forfeiting it (on
  rejection) is a genuine deterrent against speculative challenging.

**What is and isn't actually locked here**: the 5:1 ratio and the "flat, not
damages-scaled" principle are real design decisions and are now fixed. The two absolute
numbers (0.1 / 0.02 GEN) are placeholders — sizing them against real GEN market value and
observed usage is a deploy-time judgment call this session is not positioned to make
responsibly (no verified live GEN price data), and is called out as such rather than
asserted with false precision. Recommend revisiting both absolute values, keeping the
ratio, immediately before any live deployment.

---

## 5. Native GEN checklist

See `docs/STAGE_2_1_NATIVE_GEN_CHECKLIST.md` — a manual, user-run verification plan for
StudioNet. Not executed in this pass; no deployment has happened.

---

## 6. Constraints carried forward

No frontend, no deployment, no live transactions, no backend. Nothing in this hardening
pass touched any of those boundaries — every change is either a contract-code edit
(bond-pool documentation and accounting, finalized caps, an explicit Precedent cap) or a
design document (this file, the checklist). `resolve_challenge`'s actual mechanism is
unchanged pending your decision on item 1.

---

## Summary of code changes in this pass

- `contracts/protocol_court.py`: documented `FILING_BOND_ATOMS` / `CHALLENGE_BOND_ATOMS`
  sizing rationale in-code; added `MAX_PRECEDENTS` cap and its enforcement in
  `finalize_case`; renamed the storage-cap header comment to mark these as finalized;
  documented `pool_address`'s purpose ("Protocol Court Integrity Pool") and recommended
  default (burn address) in-code; added `total_forfeited_to_pool` accounting incremented on
  every rejected challenge, plus `get_total_forfeited_to_pool()`.
- `tests/direct/test_challenge.py`: two new tests asserting the forfeiture counter
  increments only on `REJECTED`, never on `SUSTAINED`.
- No change to `resolve_challenge`'s resolution mechanism — pending your decision on item 1.

101 -> 103 direct tests pass; `genvm-lint check` clean.

**STOPPED. Awaiting your decision on item 1 (challenge semantics) before implementing it,
and your approval to proceed to Stage 3.**
