# PROTOCOL COURT — Native GEN Manual Verification Checklist

Status: **checklist only. Not executed. No deployment has happened.** This is prepared for
you to run yourself on StudioNet when you choose to — every deploy and every signed
transaction below is performed by you, with your own wallet, never by this session.

## Why this exists

Direct-mode (`gltest`) tests, all 103 of which pass, do not model native GEN balance
movement at all — this is a documented limitation of that test runner, not something Stage
2/2.1 could verify locally. Every other GEN-bearing contract built in this workspace has
needed a live round-trip before its bond mechanics were trusted (see
`genlayer_studio_init_annotation_gotcha` and the Treasury Trial project's own native-GEN
verification history) — nothing about bonds in this contract should be treated as confirmed
until the same discipline is applied here.

## Before you start

- Use disposable/throwaway keys for every role below, never your primary wallet, the same
  way every prior probe in this workspace has been run.
- Deploy `contracts/protocol_court.py` exactly as committed (verify the on-chain source
  hash matches the local file after deploying — Studio's paste step has, in this workspace,
  introduced only cosmetic CRLF differences before; re-normalize before comparing).
- Pass a real `pool_address` at deploy — a fresh disposable address is fine for this
  checklist; you do not need the real chosen pool destination yet.
- Fund at least three disposable accounts: **filer**, **respondent** (used only as a
  citation, never signs), **challenger**, plus enough native GEN in the filer/challenger
  accounts to cover `FILING_BOND_ATOMS` (0.1 GEN) and `CHALLENGE_BOND_ATOMS` (0.02 GEN)
  respectively, with margin for gas.
- Confirm `get_filing_bond_amount()` and `get_challenge_bond_amount()` read back the exact
  values you expect before locking any real funds against them.

## 1. Payable bond locking (`file_case`)

- [ ] Call `file_case(...)` with **no attached value** — confirm it reverts with
      `FILING_BOND_MISMATCH` (proves the payable guard actually rejects zero-value calls,
      not just under/overpayment).
- [ ] Call `file_case(...)` with value **one atom less** than `FILING_BOND_ATOMS` — confirm
      revert with the same message.
- [ ] Call `file_case(...)` with value **one atom more** than `FILING_BOND_ATOMS` — confirm
      revert (no silent overpayment/change-making accepted).
- [ ] Call `file_case(...)` with the **exact** `FILING_BOND_ATOMS` value — confirm it
      succeeds, returns a `case_id`, and `get_case(case_id)["filing_bond_amount"]` matches.
- [ ] Independently confirm via the chain explorer (not just the return value) that the
      contract's balance increased by exactly `FILING_BOND_ATOMS` — this is the check
      direct-mode tests structurally cannot perform.

## 2. Filing bond refund path (`finalize_case`)

Run this once for **each** of these three verdict shapes, so the "refund regardless of
outcome" rule is actually exercised, not just the happy path:

- [ ] A `CONSISTENT` outcome, no challenges: submit evidence, freeze, adjudicate, wait past
      `challenge_window_ends_at` (or use a short-lived test window if you deploy a
      throwaway variant for this purpose), call `finalize_case`. Confirm the filer's
      balance increases by exactly `FILING_BOND_ATOMS` and the contract's balance decreases
      by the same amount, observed on the explorer, not inferred from the return value.
- [ ] An `INCONSISTENT` outcome, no challenges: same procedure — confirm the filer is
      **still refunded** (this is the one most worth verifying live, since it's the
      strongest test of "no slash path exists for the filing bond in V1").
- [ ] A `misfiled: true` outcome: confirm the case reaches `MISFILED`, `finalize_case`
      succeeds, and the filer is still refunded, with no Precedent emitted
      (`get_precedent_ids_for_protocol` unchanged).
- [ ] Call `finalize_case` a second time on the same case: confirm it reverts with
      `ALREADY_FINALIZED` and, critically, **no second transfer occurs** — check the
      contract's and filer's balances are unchanged by the reverted call.

## 3. Challenge bond path (`open_challenge` / `resolve_challenge`)

- [ ] Repeat the zero/under/over/exact value checks from section 1 for `open_challenge`
      against `CHALLENGE_BOND_ATOMS`.
- [ ] Confirm the contract's balance increases by exactly `CHALLENGE_BOND_ATOMS` on a
      successful `open_challenge`, observed on-chain.
- [ ] Resolve a challenge to `REJECTED` (mock/arrange the LLM response, or use a case where
      you expect reaffirmation): confirm the challenger's bond does **not** return to them,
      the pool address's balance increases by `CHALLENGE_BOND_ATOMS`, and
      `get_total_forfeited_to_pool()` increases by the same amount.
- [ ] Resolve a different challenge to `SUSTAINED`: confirm the bond **returns to the
      challenger** (not the pool), `get_total_forfeited_to_pool()` is unchanged, a new
      Verdict is recorded, and the original Verdict shows `superseded: true` with the
      correct `superseded_by`.
- [ ] Attempt to resolve an already-resolved challenge: confirm `CHALLENGE_NOT_OPEN` and no
      second transfer in either direction.
- [ ] With two challenges open on the same case, attempt to resolve the second before the
      first: confirm `EARLIER_CHALLENGE_MUST_RESOLVE_FIRST` and no transfer occurs from the
      rejected attempt.

## 4. Payout safety (cross-cutting)

- [ ] Confirm every payout transaction is a **separate emitted Send**, not part of the
      same transaction's return value — never treat a successful `resolve_challenge` or
      `finalize_case` call as proof funds moved; always independently confirm the emitted
      transfer on the explorer, the same discipline this workspace's prior GEN-bearing
      contracts required.
- [ ] Deliberately attempt a scenario likely to make an outbound transfer fail (e.g. a
      recipient address that cannot receive value, if one is easy to construct on
      StudioNet) and confirm the WHOLE transaction rolls back atomically — no partial
      state change, no stuck "settled but unpaid" case. This mirrors the exact live finding
      from this workspace's Treasury Trial probe (`SystemError: 7: Imbalance` raised
      synchronously, full atomic rollback) — re-confirm it holds for this contract's own
      `_Recipient(...).emit_transfer(...)` call sites rather than assuming it transfers
      from a different contract.
- [ ] Confirm `Consensus Result: Undetermined` (if you can reproduce it, e.g. by triggering
      the Tier 1 or Tier 2 nondet paths under conditions likely to disagree) leaves the case
      in its pre-call state with **no partial bond movement** — re-run the same call and
      confirm it is safe to retry.
- [ ] Confirm `get_balance()` matches `filing bonds currently locked + challenge bonds
      currently locked` at every checkpoint above — any unexplained gap means something
      moved that this checklist didn't account for, and should be investigated before
      trusting the contract with more than test funds.

## After running this checklist

Record, for each checked item: the transaction hash, the FINALIZED status, and the exact
balance deltas observed (not assumed). Bonds should not be considered "confirmed working"
on this contract until every item above has a real, observed, FINALIZED transaction behind
it — matching the standing rule already applied to every other GEN-bearing contract in this
workspace.
