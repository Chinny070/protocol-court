# PROTOCOL COURT — Stage 2.3 StudioNet Capability Verification Checklist

Status: **checklist + one prepared (not executed) helper script. No production code
changed. No deployment has happened.** This is prepared for you to run yourself on
StudioNet, at your own pace, before Stage 3 frontend work starts. Every deploy and every
signed transaction below is performed by you, with your own wallet — this session does not
deploy or sign anything. See `scripts/stage_2_3_payable_calls.py` for the two payable
methods (`file_case`, `open_challenge`) that the CLI cannot exercise — that script reads
your signing key from an environment variable you set yourself; it was written and
syntax-checked, never run, and never had access to any key.

## Why this exists

101+ direct-mode (`gltest`) tests pass locally, `genvm-lint check`/`typecheck`/`schema` are
all clean, and the contract is pure ASCII with a short leading comment block (version tag +
`Depends` line only, per the known Studio schema-load gotcha). None of that proves the
contract behaves correctly against the **real** GenVM runtime and the **real** Studio
schema loader — direct-mode is a local simulation that, as already documented in this
project (Stage 2 report, Stage 2.1 hardening pass), does not model native GEN balance
movement at all, cannot mock `gl.eq_principle.prompt_comparative`/`prompt_non_comparative`,
and auto-runs only the leader side of every `gl.vm.run_nondet` call unless a test manually
invokes the captured validator. Every prior GenLayer contract in this workspace has needed
a live pass before its nondet and GEN behavior was trusted; this one is no different.

**Goal of this checklist: verify, don't extend.** Nothing here should require a code
change. If something on this list fails, stop and report the failure — don't patch around
it live.

## Before you start

- Use disposable/throwaway keys for every role, never your primary wallet.
- Confirm the pinned runner comment in `contracts/protocol_court.py` line 2
  (`py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6`) is still the runner
  Studio expects. `genvm-lint` reports a newer runner is available
  (`9b8kjyda2ycxyq4ea6g4yfpnydxhd52gqba5rb8dw7krkh5mn9p0`) — `genvm-lint` is known in this
  workspace to not be a faithful oracle for Studio (it ships a newer GenVM than Studio's
  pinned version and can pass contracts Studio rejects), so this is worth a deliberate
  check, not an assumption either way.
- Have the local file's SHA-256 ready to compare against whatever Studio reports as the
  deployed source, after normalizing line endings (Studio's paste step has, in this
  workspace, introduced only cosmetic CRLF differences before — `.gitattributes` in this
  repo now pins `contracts/*.py` to `eol=lf`, which should prevent that on this repo's own
  checkouts, but Studio's own paste/upload path is a separate surface worth checking).
- Fund at least three disposable accounts: **filer**, **respondent** (cited only, never
  signs), **challenger** — filer needs `FILING_BOND_ATOMS` (5 GEN) plus gas, challenger
  needs `CHALLENGE_BOND_ATOMS` (1 GEN) plus gas. (Bond amounts changed from the original
  sub-1-GEN placeholders to whole GEN numbers after a live StudioNet test found that
  Studio's own "Value (GEN)" input field only accepts whole integers — see the addendum
  at the end of this document.)
- Have a real, reachable URL ready for evidence (a static page you control is best — see
  the Tier 1 section below for why you actually want two different kinds of source).

---

## 0. Execution surface: CLI vs. script -- read this before starting

**Every step below is tagged `(CLI)` or `(SCRIPT)`.** This split exists because
`genlayer write` has no flag to attach native GEN value -- it always sends `value: 0` -- so
the two `payable` methods (`file_case`, `open_challenge`) cannot be driven through the CLI
at all; they will revert with `FILING_BOND_MISMATCH` / `CHALLENGE_BOND_MISMATCH` every time
if attempted that way. This is a confirmed CLI limitation in this workspace, not a guess.

- **`(CLI)`** -- every non-payable step: `create_protocol`, `create_commitment`,
  `update_commitment_metadata`, `seal_commitment`, `mark_commitment_superseded`,
  `add_clause`, `submit_evidence`, `freeze_evidence`, `adjudicate`, `resolve_challenge`,
  `finalize_case`, and every `get_*` read. Use `genlayer write` / `genlayer call` /
  `genlayer schema` / `genlayer receipt` directly, per the exact commands below.
- **`(SCRIPT)`** -- exactly two methods: `file_case` and `open_challenge`. Use
  `scripts/stage_2_3_payable_calls.py`, a prepared (not executed) genlayer-py script that
  reads your signing key from an environment variable you set yourself -- see that file's
  own docstring for exact setup. Run it once per action (set `ACTION = "file_case"`, run
  it; then set `ACTION = "open_challenge"`, run it again), filling in the `CONFIG` block at
  the top with the IDs produced by your `(CLI)` steps first.

### Exact commands -- deploy and schema check

```bash
# 1. Deploy (constructor takes one address arg: your chosen pool/burn address)
genlayer deploy --contract contracts/protocol_court.py --args address#<POOL_ADDRESS_NO_0x>

# 2. Schema check -- do this immediately after deploy, before anything else
genlayer schema <CONTRACT_ADDRESS>
```

### Exact commands -- non-payable lifecycle, in order (CLI)

```bash
# Protocol / Commitment / Clause setup
genlayer write <CONTRACT_ADDRESS> create_protocol \
  --args "Treasury DAO" "A DAO treasury." "treasury-dao"

genlayer write <CONTRACT_ADDRESS> create_commitment \
  --args <protocol_id> "Treasury Charter" "v1" "https://example.org/charter-v1" "2026-01-01" ""

genlayer write <CONTRACT_ADDRESS> add_clause \
  --args <commitment_id> "Article VII" "Ecosystem Development" \
  "Treasury funds may be used for ecosystem development." ""

genlayer write <CONTRACT_ADDRESS> seal_commitment --args <commitment_id>

# --- STOP: run scripts/stage_2_3_payable_calls.py with ACTION="file_case" here ---
# --- to get a case_id, then continue below ---

# Evidence + freeze + adjudicate (once you have case_id from file_case)
genlayer write <CONTRACT_ADDRESS> submit_evidence \
  --args <case_id> "<evidence_url>" get "2026-02-01" "2026-02-01"

genlayer write <CONTRACT_ADDRESS> freeze_evidence --args <case_id>

genlayer write <CONTRACT_ADDRESS> adjudicate --args <case_id>

# --- STOP: run scripts/stage_2_3_payable_calls.py with ACTION="open_challenge" here ---
# --- to get a challenge_id, then continue below ---

genlayer write <CONTRACT_ADDRESS> resolve_challenge --args <challenge_id>

genlayer write <CONTRACT_ADDRESS> finalize_case --args <case_id>
```

### Exact commands -- reads, at any point (CLI)

```bash
genlayer call <CONTRACT_ADDRESS> get_case --args <case_id>
genlayer call <CONTRACT_ADDRESS> get_commitment --args <commitment_id>
genlayer call <CONTRACT_ADDRESS> get_verdict --args <verdict_id>
genlayer call <CONTRACT_ADDRESS> get_challenge --args <challenge_id>
genlayer call <CONTRACT_ADDRESS> get_precedent --args <precedent_id>
genlayer call <CONTRACT_ADDRESS> get_total_forfeited_to_pool
genlayer call <CONTRACT_ADDRESS> get_balance
genlayer receipt <TX_HASH>
```

---

## 1. Contract schema loads

- [ ] Deploy (or use Studio's "load contract" / schema-check flow, if it can validate
      before a real deploy) `contracts/protocol_court.py` exactly as committed at
      `0ffa77f`. Confirm `gen_getContractSchemaForCode` succeeds — no `VM_ERROR:
      invalid_contract`.
- [ ] If it fails: **do not guess a fix.** Use the bisect method already proven in this
      workspace (see the `genlayer_studio_init_annotation_gotcha` reference material) —
      generate variants with methods/sections progressively removed and identify exactly
      which change restores loading, rather than hypothesis-driven trial and error. Report
      the finding back before patching.
- [ ] Confirm the deploy transaction requires and correctly accepts the `pool_address:
      Address` constructor argument. This is worth checking specifically: direct-mode
      testing found that constructor args bypass calldata decoding in that harness (raw
      bytes reached `__init__` instead of an `Address`), which is why `__init__` now
      defensively coerces either shape. Confirm Studio's real deploy path passes a properly
      decoded `Address` so that defensive branch is never actually exercised in production
      — if it IS exercised (i.e. `pool_address` arrives as raw bytes on the real network
      too), that's worth knowing, not just silently tolerating.
- [ ] Confirm `genlayer schema` (CLI) or Studio's own schema view lists all 41 methods (28
      view / 13 write) with the expected read-only/payable flags, matching
      `genvm-lint schema`'s local output.
- [ ] Confirm the deployed on-chain source hash matches the local file's hash (after
      normalizing line endings if needed).

## 2. Storage behaves correctly

- [ ] `(CLI)` `create_protocol` → `create_commitment` → `add_clause` → `seal_commitment`: confirm
      each step's write succeeds and each subsequent `get_*` read (as a **separate**,
      later call — not just trusting the write's return value) shows the expected data.
- [ ] Confirm `get_commitment_ids_for_protocol` / `get_clauses_page` pagination behaves
      correctly with real transaction ordering (not just the deterministic ordering direct
      tests exercise).
- [ ] `(CLI)` Create a second Commitment version, seal it, call `mark_commitment_superseded` on the
      first: confirm `get_commitment` shows `status: SUPERSEDED` / `superseded_by` on the
      old version and `status: ACTIVE` on the new one, read back from chain state, not
      inferred from the write's success.
- [ ] `(SCRIPT)` `file_case` (payable, exact `FILING_BOND_ATOMS` — see section 0 and
      `scripts/stage_2_3_payable_calls.py`): confirm the case is readable via `(CLI)`
      `get_case` immediately after, and via `get_case_ids_for_protocol` /
      `get_case_ids_for_clause`.
- [ ] `(CLI)` Confirm hitting a storage cap live actually reverts as expected on at least one cap
      (e.g. `MAX_CLAUSES_PER_COMMITMENT` is a lot of transactions to genuinely exhaust —
      a cheaper live spot-check is deliberately violating a field-length bound, e.g. an
      over-length `question_presented`, and confirming the real revert message matches
      `TOO_LONG:question_presented`).

## 3. Evidence freeze transaction works

This exercises Tier 1 (retrieval fidelity, `gl.vm.run_nondet` + `gl.nondet.web.get`/
`.render`) against the **real** GenVM runtime for the first time — direct-mode tests only
ever validated the Python logic, never a real non-deterministic fetch across real
validators.

- [ ] `(CLI)` `submit_evidence` against a **stable, static source** (content you control and won't
      change during the test). Confirm it resolves `AVAILABLE` with a non-empty excerpt.
      This exercises Tier 1's trivial-agreement path (identical bytes across validators —
      no LLM fidelity call needed).
- [ ] `(CLI)` `submit_evidence` a second time against a source **more likely to have incidental
      variance between near-simultaneous fetches** (a real-world page with a timestamp,
      view counter, or rotating element, if you have one safe to point at — otherwise this
      sub-item may have to wait for organic evidence in a later real case). This is the
      path that actually exercises the LLM fidelity judgment (`_fidelity_prompt`), which no
      local test could reach live. If you can't safely construct this case yet, note it as
      **not yet exercised** rather than skipping it silently.
- [ ] `(CLI)` Submit evidence against a URL that returns a 404 or is unreachable: confirm it
      resolves `UNAVAILABLE` or `FETCH_FAILED` (not a revert) — evidence retrieval failure
      must be a normal, storable outcome.
- [ ] `(CLI)` `freeze_evidence`: confirm it succeeds as its **own transaction**, and that
      `get_case` afterward shows `status: EVIDENCE_FROZEN`, a non-empty
      `evidence_fingerprint`, and `evidence_frozen_at` set.
- [ ] `(CLI)` Confirm `submit_evidence` now reverts with `CASE_NOT_OPEN_FOR_EVIDENCE` if attempted
      after freezing.
- [ ] Watch for `Consensus Result: Undetermined` on any of the above. If it occurs: confirm
      the case's evidence set is **unaffected** (still whatever it was before the call) and
      that retrying the same `submit_evidence`/`freeze_evidence` call is safe. This is the
      empirically-documented risk this design was built to survive (Stage 1 sec 6.4) — the
      first live chance to confirm it actually does.

## 4. Adjudication path works with the GenLayer runtime

This is the first live exercise of Tier 2 (`gl.vm.run_nondet` + `gl.nondet.exec_prompt`,
structured-field-only consensus) and of the fail-closed deterministic validation layer
against real (not mocked) LLM output.

- [ ] `(CLI)` `adjudicate` on the frozen case from section 3: confirm it produces a `Verdict` with
      a real `substantive_result`/`temporal_result`/`misfiled`/`rationale`/
      `evidence_ids_relied_on`, and the case moves to `CHALLENGE_WINDOW` (or `MISFILED` if
      the model genuinely judges the cited commitment version wasn't in force).
- [ ] Confirm `evidence_ids_relied_on` on the real verdict only ever contains IDs that
      actually exist in the case's evidence set — the fail-closed
      `UNKNOWN_EVIDENCE_ID` check should make a fabricated ID structurally impossible, but
      this is the first chance to see a real model's tendency (or not) to try.
      Malformed-output rejection: if you can arrange a probe path where a validator's
      raw response comes back), confirm the transaction stays consistent — the fail-closed
      contract-side check exists specifically so a malformed shape rolls back rather than
      partially applies.
- [ ] `(CLI)` Run `adjudicate` on a **second**, similarly-shaped case and compare: do independent
      real runs on materially identical inputs land on the same structured fields? Some
      variance in `rationale` wording is expected and fine (Tier 2 consensus explicitly
      never compares it) — variance in `substantive_result`/`temporal_result` across
      supposedly-identical inputs would be a signal worth flagging, not something to
      silently average away.
- [ ] Watch for `Consensus Result: Undetermined` here too. If observed, confirm the case
      stays at `EVIDENCE_FROZEN` (not silently advanced) and that re-running `adjudicate`
      is safe.

## 5. Challenge-review path works

Exercises the Stage 2.2 targeted appellate-review design live for the first time.

- [ ] `(SCRIPT)` `open_challenge` (payable, exact `CHALLENGE_BOND_ATOMS` — see section 0 and
      `scripts/stage_2_3_payable_calls.py`) against the verdict from section 4, citing a
      real ground (e.g. `IGNORED_EVIDENCE` with an actual evidence ID) and a real argument.
      Confirm `(CLI)` `get_challenge` shows `status: OPEN`.
- [ ] `(CLI)` `resolve_challenge`: confirm the real model's review is scoped to the specific claim
      — check the returned `reasoning` (informally, by eye) actually engages with the named
      ground and citation, rather than reading like a generic re-adjudication. This is the
      qualitative check no automated test can perform, and the whole point of the Stage 2.2
      redesign.
- [ ] If `DEFECT_NOT_CONFIRMED`: confirm the original verdict is **completely unchanged**
      (`get_verdict` on the original ID shows `superseded: false`, and `get_case`'s
      `current_verdict_id` still points at it), and the challenge bond moved to the pool
      address (see section 6).
- [ ] If `DEFECT_CONFIRMED`: confirm exactly the claimed dimension(s) changed — e.g. a
      `WRONG_TEMPORAL_INTERPRETATION` challenge should typically leave
      `substantive_result` and `misfiled` identical to the original verdict on the new one,
      with only `temporal_result` different. If a confirmed defect changes a dimension the
      challenge never mentioned, that's a real finding about the review prompt's behavior
      under live conditions, worth reporting rather than dismissing.
- [ ] Confirm the original verdict is marked `superseded: true` / `superseded_by` pointing
      at the new verdict, and `case.verdict_ids` contains both in order — full lineage,
      nothing overwritten.
- [ ] `(SCRIPT)` Open two more challenges (up to the cap of 3) and confirm `open_challenge`
      correctly reverts with `MAX_CHALLENGES_PER_CASE_REACHED` on a fourth attempt, live.
- [ ] `(CLI)` With two challenges open at once, confirm attempting to resolve the second before the
      first reverts with `EARLIER_CHALLENGE_MUST_RESOLVE_FIRST`.
- [ ] Watch for `Consensus Result: Undetermined` here as well; confirm a retry is safe and
      the challenge stays `OPEN` (not silently marked resolved) until a real resolution
      lands.

## 6. Native GEN bond assumptions — verified where possible

Full detail already written up in `docs/STAGE_2_1_NATIVE_GEN_CHECKLIST.md` — run that
checklist's sections 1–4 as part of this same live session rather than duplicating it here.
The short version, specific to what sections 3–5 above just produced:

- [ ] `(explorer, cross-checking the SCRIPT txs from sections 3 and 5)` Confirm the
      contract's on-chain balance increased by exactly `FILING_BOND_ATOMS` when the case in
      section 3 was filed, and by exactly `CHALLENGE_BOND_ATOMS` when the challenge in
      section 5 was opened — observed on the explorer, never assumed from a return value.
- [ ] `(CLI)` Run `finalize_case` on the case from sections 3–5 once its challenge window has
      elapsed (or the cap is exhausted): confirm the filer is refunded exactly
      `FILING_BOND_ATOMS`, regardless of the final substantive outcome — this is the
      concrete live test of the locked "filing bond always refunds" rule.
    - Wall-clock note: `challenge_window_ends_at` is a real 3-day-out ISO timestamp on live
      StudioNet (no `vm.warp()` available outside direct-mode tests) — either wait it out,
      or if you want to verify `finalize_case` sooner, drive the case through all 3
      challenges first so `finalize_case` becomes callable via cap-exhaustion instead of
      waiting on the clock.
- [ ] `(CLI)` Confirm `get_total_forfeited_to_pool()` increased by exactly
      `CHALLENGE_BOND_ATOMS` for each `DEFECT_NOT_CONFIRMED` resolution, and did **not**
      increase for any `DEFECT_CONFIRMED` one.
- [ ] `(CLI + explorer)` Confirm every payout is a separate emitted `Send`, never inferred
      from a call's return value, and that `get_balance()` matches "bonds currently locked"
      at each checkpoint.

---

## After running this checklist

Record, for each checked item: the transaction hash, its FINALIZED status, and what was
actually observed (schema output, balance deltas, verdict contents) — not what was
expected. Nothing above should be considered "confirmed working on the real network" until
it has a real, observed, FINALIZED transaction behind it. Report back with the results
(including anything that didn't behave as expected) before Stage 3 frontend work begins.

**Do not deploy until this checklist itself has been reviewed and you're ready to run it.**

---

## Addendum: live findings from the first real run (2026-09-15)

Two real, unanticipated findings surfaced during the user's own live walkthrough of this
checklist on StudioNet via the Studio web UI (not this session's script). Both are now
reflected in the contract and this document; recorded here for anyone re-running this
checklist later.

1. **`pool_address` (and any other `address`-typed argument) can arrive as a plain Python
   `int`, not just `Address` or `bytes`.** The first real deploy attempt crashed in
   `__init__` with `OverflowError: cannot fit 'int' into an index-sized integer` — direct-
   mode testing never exercised this shape. Fixed with a shared `_coerce_address()` helper
   applied to every `Address`-typed parameter the contract accepts directly (the
   `pool_address` constructor arg and `file_case`'s `respondent`), not just the
   constructor. Confirmed fixed: the redeploy after this fix succeeded cleanly.

2. **A reverted/errored contract call does NOT roll back the native GEN value attached to
   it.** Studio's own "Value (GEN)" field takes a value directly in whole GEN units (not
   atoms) and rejects fractional input like "0.1" outright. A `file_case` attempt with a
   mistyped value (`100000000000000000`, intended as atoms, actually read as that many
   whole GEN) moved nearly an entire test wallet's balance into the contract — and even
   though the call itself reverted with `EXPECTED:FILING_BOND_MISMATCH`, the GEN was not
   returned: it landed in, and stayed in, the contract's balance (confirmed via the
   contract's own explorer page showing a balance of
   `999999999999999996.863366 GEN`). This directly contradicts the atomic-rollback
   assumption this design had been carrying over from a sibling project's findings (see
   `docs/STAGE_2_1_NATIVE_GEN_CHECKLIST.md`, "payout safety" section) — that finding was
   about a *successful* call's outbound `emit_transfer` failing, not about an *inbound*
   payable value surviving a reverted call. These are different code paths and this
   finding does not overturn the earlier one, but it is a new, independently-confirmed
   risk: **an incorrectly-sized inbound payable value is not safe to retry-until-right** —
   each wrong attempt is a real, non-refunded loss (of test GEN here; the same mechanism
   would apply to real GEN on a production network).
   - **Mitigation applied**: `FILING_BOND_ATOMS` and `CHALLENGE_BOND_ATOMS` were changed
     from sub-1-GEN fractional placeholders (0.1 / 0.02 GEN) to whole-GEN amounts (5 / 1
     GEN, preserving the locked 5:1 ratio) specifically so they can be entered correctly
     and unambiguously through Studio's own UI field, not just through a script. This is
     within the already-documented scope of Stage 2.1's decision that the *absolute* bond
     values (unlike the 5:1 ratio and flat-pricing principle) were never locked.
   - **Residual risk, not fully mitigated**: this finding means any future payable method
     call — through Studio's UI, a wallet extension, or otherwise — should have its exact
     required value triple-checked before sending, on any network where this contract is
     deployed. No code change can make a wrong manually-typed amount safe; only entering
     the right amount does.
