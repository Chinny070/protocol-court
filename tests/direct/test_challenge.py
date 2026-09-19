"""
Challenge system: permissionless, scoped to named defects only, capped at
3 per case, never introduces new evidence. A challenge is resolved by a
targeted APPELLATE REVIEW (Stage 2.2), not a fresh full re-adjudication:
the model evaluates only the challenge's one named defect claim against
the original verdict, the same frozen evidence, and the same frozen
commitment/clause. DEFECT_NOT_CONFIRMED leaves the original verdict final
untouched (bond forfeited to the pool); DEFECT_CONFIRMED corrects only the
affected dimension(s) into a new, appended, superseding Verdict (bond
refunded to the challenger) -- the original verdict is never mutated or
deleted, only marked superseded, so the full lineage stays readable.

Note: this is not GenLayer's chain-level protocol appeal
(client.appealTransaction on the original adjudicate transaction) -- that
is an external, wallet-driven action outside contract code, out of scope
for a frontend-free stage. See docs/STAGE_2_1_HARDENING.md sec 1.
"""

import json

CONTRACT_PATH = "contracts/protocol_court.py"
FILING_BOND_ATOMS = 5 * 10**18  # 5 GEN, mirrors contracts/protocol_court.py
CHALLENGE_BOND_ATOMS = 1 * 10**18  # 1 GEN, mirrors contracts/protocol_court.py
STATIC_URL = "https://example.org/announcement"
ADJUDICATION_PATTERN = r"You are adjudicating a Protocol Court case"
REVIEW_PATTERN = r"You are reviewing a CHALLENGE against an existing Protocol Court verdict"

BASE_JUDGMENT = {
    "substantive_result": "CONSISTENT",
    "temporal_result": "SATISFIED",
    "misfiled": False,
    "rationale": "The spend falls within ecosystem development.",
}

NOT_CONFIRMED_REVIEW = {
    "decision": "DEFECT_NOT_CONFIRMED",
    "corrected_substantive_result": "UNCHANGED",
    "corrected_temporal_result": "UNCHANGED",
    "corrected_misfiled": "UNCHANGED",
    "reasoning": "The original rationale does address the cited evidence; no defect found.",
}


def _confirmed_review(**corrections) -> dict:
    review = {
        "decision": "DEFECT_CONFIRMED",
        "corrected_substantive_result": "UNCHANGED",
        "corrected_temporal_result": "UNCHANGED",
        "corrected_misfiled": "UNCHANGED",
        "reasoning": "The named defect is real and the following dimension(s) are corrected.",
    }
    review.update(corrections)
    return review


def _deploy(direct_deploy, direct_accounts):
    pool_address = direct_accounts[9]
    return direct_deploy(CONTRACT_PATH, pool_address)


def _as_address(raw):
    from genlayer.py.types import Address

    return raw if isinstance(raw, Address) else Address(raw)


def _setup_case_in_challenge_window(contract, direct_vm, respondent):
    """Files a case, submits one evidence item, freezes, and adjudicates
    with a CONSISTENT/SATISFIED verdict. Returns (case_id, evidence_id)."""
    protocol_id = contract.create_protocol("Treasury DAO", "A DAO treasury.", "treasury-dao")
    commitment_id = contract.create_commitment(
        protocol_id, "Treasury Charter", "v1", "https://example.org/charter-v1", "2026-01-01", ""
    )
    clause_id = contract.add_clause(
        commitment_id, "Article VII", "Ecosystem Development",
        "Treasury funds may be used for ecosystem development.", "",
    )
    contract.seal_commitment(commitment_id)

    direct_vm.value = FILING_BOND_ATOMS
    try:
        case_id = contract.file_case(
            protocol_id=protocol_id, commitment_id=commitment_id, clause_id=clause_id,
            respondent=_as_address(respondent), question_presented="Was the spend consistent?",
            disputed_act_ref="https://explorer.example.org/tx/0xabc",
            disputed_act_summary="Contributor spent treasury funds on marketing.",
            topic_tags=["marketing"],
        )
    finally:
        direct_vm.value = 0

    direct_vm.mock_web(STATIC_URL, {"status": 200, "body": "The DAO commits to ecosystem development."})
    contract.submit_evidence(case_id, STATIC_URL, "get", "2026-02-01", "2026-02-01")
    contract.freeze_evidence(case_id)
    direct_vm.clear_mocks()

    evidence_id = contract.get_case(case_id)["evidence_ids"][0]
    judgment = dict(BASE_JUDGMENT, evidence_ids_relied_on=[evidence_id])
    direct_vm.mock_llm(ADJUDICATION_PATTERN, json.dumps(judgment))
    contract.adjudicate(case_id)
    direct_vm.clear_mocks()
    return case_id, evidence_id


def _open_challenge(contract, direct_vm, case_id, evidence_id, ground="IGNORED_EVIDENCE", cited_evidence_ids=None, cited_precedent_id="", argument="The verdict never addresses the cited evidence's exact wording.", value=CHALLENGE_BOND_ATOMS):
    if cited_evidence_ids is None:
        cited_evidence_ids = [evidence_id]
    direct_vm.value = value
    try:
        return contract.open_challenge(case_id, ground, cited_evidence_ids, cited_precedent_id, argument)
    finally:
        direct_vm.value = 0


def _mock_review(direct_vm, review: dict):
    direct_vm.mock_llm(REVIEW_PATTERN, json.dumps(review))


# ---------------------------------------------------------------------
# Opening challenges
# ---------------------------------------------------------------------


def test_open_challenge_valid(direct_deploy, direct_accounts, direct_vm, direct_alice, direct_bob):
    contract = _deploy(direct_deploy, direct_accounts)
    case_id, evidence_id = _setup_case_in_challenge_window(contract, direct_vm, direct_alice)

    with direct_vm.prank(direct_bob):  # permissionless: not filer, not respondent
        challenge_id = _open_challenge(contract, direct_vm, case_id, evidence_id)
    assert challenge_id == "challenge-1"

    ch = contract.get_challenge(challenge_id)
    assert ch["case_id"] == case_id
    assert ch["ground"] == "IGNORED_EVIDENCE"
    assert ch["status"] == "OPEN"
    assert ch["challenger"].lower() == "0x" + direct_bob.hex()
    assert ch["cited_evidence_ids"] == [evidence_id]


def test_open_challenge_requires_exact_bond(direct_deploy, direct_accounts, direct_vm, direct_alice):
    contract = _deploy(direct_deploy, direct_accounts)
    case_id, evidence_id = _setup_case_in_challenge_window(contract, direct_vm, direct_alice)
    with direct_vm.expect_revert("CHALLENGE_BOND_MISMATCH"):
        _open_challenge(contract, direct_vm, case_id, evidence_id, value=CHALLENGE_BOND_ATOMS - 1)


def test_open_challenge_requires_challenge_window_status(direct_deploy, direct_accounts, direct_vm, direct_alice):
    contract = _deploy(direct_deploy, direct_accounts)
    protocol_id = contract.create_protocol("DAO", "desc", "ns")
    commitment_id = contract.create_commitment(protocol_id, "Charter", "v1", "https://example.org/v1", "2026-01-01", "")
    clause_id = contract.add_clause(commitment_id, "Art. I", "Title", "Text.", "")
    contract.seal_commitment(commitment_id)
    direct_vm.value = FILING_BOND_ATOMS
    try:
        case_id = contract.file_case(
            protocol_id=protocol_id, commitment_id=commitment_id, clause_id=clause_id,
            respondent=_as_address(direct_alice), question_presented="Q?",
            disputed_act_ref="https://example.org/act", disputed_act_summary="Summary.",
            topic_tags=[],
        )
    finally:
        direct_vm.value = 0

    with direct_vm.expect_revert("CASE_NOT_IN_CHALLENGE_WINDOW"):
        _open_challenge(contract, direct_vm, case_id, "evidence-1")


def test_open_challenge_invalid_ground(direct_deploy, direct_accounts, direct_vm, direct_alice):
    contract = _deploy(direct_deploy, direct_accounts)
    case_id, evidence_id = _setup_case_in_challenge_window(contract, direct_vm, direct_alice)
    with direct_vm.expect_revert("INVALID_CHALLENGE_GROUND"):
        _open_challenge(contract, direct_vm, case_id, evidence_id, ground="I_DISAGREE")


def test_open_challenge_ignored_evidence_requires_citation(direct_deploy, direct_accounts, direct_vm, direct_alice):
    contract = _deploy(direct_deploy, direct_accounts)
    case_id, evidence_id = _setup_case_in_challenge_window(contract, direct_vm, direct_alice)
    with direct_vm.expect_revert("CHALLENGE_REQUIRES_EVIDENCE_CITATION"):
        _open_challenge(contract, direct_vm, case_id, evidence_id, ground="IGNORED_EVIDENCE", cited_evidence_ids=[])


def test_open_challenge_implementation_contradiction_requires_precedent(direct_deploy, direct_accounts, direct_vm, direct_alice):
    contract = _deploy(direct_deploy, direct_accounts)
    case_id, evidence_id = _setup_case_in_challenge_window(contract, direct_vm, direct_alice)
    with direct_vm.expect_revert("CHALLENGE_REQUIRES_PRECEDENT_CITATION"):
        _open_challenge(contract, direct_vm, case_id, evidence_id, ground="IMPLEMENTATION_CONTRADICTION", cited_evidence_ids=[])


def test_open_implementation_contradiction_with_valid_precedent_succeeds(
    direct_deploy, direct_accounts, direct_vm, direct_alice, direct_bob
):
    contract = _deploy(direct_deploy, direct_accounts)

    precedent_case_id, _ = _setup_case_in_challenge_window(contract, direct_vm, direct_alice)
    precedent_case = contract.get_case(precedent_case_id)
    direct_vm.warp(precedent_case["challenge_window_ends_at"])
    precedent_id = contract.finalize_case(precedent_case_id)
    assert precedent_id == "precedent-1"

    case_id, evidence_id = _setup_case_in_challenge_window(contract, direct_vm, direct_alice)
    with direct_vm.prank(direct_bob):
        challenge_id = _open_challenge(
            contract,
            direct_vm,
            case_id,
            evidence_id,
            ground="IMPLEMENTATION_CONTRADICTION",
            cited_evidence_ids=[],
            cited_precedent_id=precedent_id,
            argument="The current interpretation contradicts precedent-1.",
        )

    challenge = contract.get_challenge(challenge_id)
    assert challenge["case_id"] == case_id
    assert challenge["ground"] == "IMPLEMENTATION_CONTRADICTION"
    assert challenge["cited_precedent_id"] == precedent_id
    assert challenge["status"] == "OPEN"


def test_open_challenge_cited_evidence_must_belong_to_case(direct_deploy, direct_accounts, direct_vm, direct_alice):
    contract = _deploy(direct_deploy, direct_accounts)
    case_a, evidence_a = _setup_case_in_challenge_window(contract, direct_vm, direct_alice)
    case_b, evidence_b = _setup_case_in_challenge_window(contract, direct_vm, direct_alice)
    assert evidence_a != evidence_b
    with direct_vm.expect_revert("CITED_EVIDENCE_NOT_IN_CASE"):
        _open_challenge(contract, direct_vm, case_b, evidence_b, cited_evidence_ids=[evidence_a])


def test_max_challenges_per_case_cap(direct_deploy, direct_accounts, direct_vm, direct_alice):
    contract = _deploy(direct_deploy, direct_accounts)
    case_id, evidence_id = _setup_case_in_challenge_window(contract, direct_vm, direct_alice)

    for _ in range(3):  # MAX_CHALLENGES_PER_CASE -- no unlimited retries
        cid = _open_challenge(contract, direct_vm, case_id, evidence_id)
        _mock_review(direct_vm, NOT_CONFIRMED_REVIEW)
        contract.resolve_challenge(cid)
        direct_vm.clear_mocks()

    with direct_vm.expect_revert("MAX_CHALLENGES_PER_CASE_REACHED"):
        _open_challenge(contract, direct_vm, case_id, evidence_id)


def test_open_challenge_after_window_closes_reverts(direct_deploy, direct_accounts, direct_vm, direct_alice):
    contract = _deploy(direct_deploy, direct_accounts)
    case_id, evidence_id = _setup_case_in_challenge_window(contract, direct_vm, direct_alice)

    case = contract.get_case(case_id)
    direct_vm.warp(case["challenge_window_ends_at"])
    # warp sets "now" to exactly the deadline; the contract requires
    # strictly-before, so this must already be closed.
    with direct_vm.expect_revert("CHALLENGE_WINDOW_CLOSED"):
        _open_challenge(contract, direct_vm, case_id, evidence_id)


# ---------------------------------------------------------------------
# Resolving challenges: DEFECT_NOT_CONFIRMED -> original verdict stands
# ---------------------------------------------------------------------


def test_resolve_challenge_rejected_when_defect_not_confirmed(direct_deploy, direct_accounts, direct_vm, direct_alice, direct_bob):
    contract = _deploy(direct_deploy, direct_accounts)
    case_id, evidence_id = _setup_case_in_challenge_window(contract, direct_vm, direct_alice)
    original_verdict_id = contract.get_case(case_id)["current_verdict_id"]

    with direct_vm.prank(direct_bob):
        challenge_id = _open_challenge(contract, direct_vm, case_id, evidence_id)

    _mock_review(direct_vm, NOT_CONFIRMED_REVIEW)
    result = contract.resolve_challenge(challenge_id)
    assert result == "REJECTED"

    ch = contract.get_challenge(challenge_id)
    assert ch["status"] == "REJECTED"
    assert ch["resolved_at"] != ""
    assert ch["resulting_verdict_id"] == ""

    # Original verdict remains final, byte-for-byte untouched.
    case = contract.get_case(case_id)
    assert case["status"] == "CHALLENGE_WINDOW"
    assert case["current_verdict_id"] == original_verdict_id
    assert len(case["verdict_ids"]) == 1
    original_verdict = contract.get_verdict(original_verdict_id)
    assert original_verdict["superseded"] is False
    assert original_verdict["substantive_result"] == "CONSISTENT"

    assert contract.get_total_forfeited_to_pool() == CHALLENGE_BOND_ATOMS


# ---------------------------------------------------------------------
# Validator-path: structured-field consensus, same locked rule as Tier 2
# ---------------------------------------------------------------------


def test_challenge_review_validator_agrees_despite_different_reasoning(direct_deploy, direct_accounts, direct_vm, direct_alice):
    contract = _deploy(direct_deploy, direct_accounts)
    case_id, evidence_id = _setup_case_in_challenge_window(contract, direct_vm, direct_alice)
    challenge_id = _open_challenge(contract, direct_vm, case_id, evidence_id)

    _mock_review(direct_vm, NOT_CONFIRMED_REVIEW)
    contract.resolve_challenge(challenge_id)

    direct_vm.clear_mocks()
    reworded = dict(NOT_CONFIRMED_REVIEW, reasoning="A completely different way of saying no defect exists.")
    direct_vm.mock_llm(REVIEW_PATTERN, json.dumps(reworded))
    agreed = direct_vm.run_validator()
    assert agreed is True


def test_challenge_review_validator_disagrees_on_different_decision(direct_deploy, direct_accounts, direct_vm, direct_alice):
    contract = _deploy(direct_deploy, direct_accounts)
    case_id, evidence_id = _setup_case_in_challenge_window(contract, direct_vm, direct_alice)
    challenge_id = _open_challenge(contract, direct_vm, case_id, evidence_id)

    _mock_review(direct_vm, NOT_CONFIRMED_REVIEW)
    contract.resolve_challenge(challenge_id)

    direct_vm.clear_mocks()
    disagreeing = _confirmed_review(corrected_substantive_result="INCONSISTENT")
    direct_vm.mock_llm(REVIEW_PATTERN, json.dumps(disagreeing))
    agreed = direct_vm.run_validator()
    assert agreed is False


def test_challenge_review_validator_fails_closed_on_malformed_own_review(direct_deploy, direct_accounts, direct_vm, direct_alice):
    contract = _deploy(direct_deploy, direct_accounts)
    case_id, evidence_id = _setup_case_in_challenge_window(contract, direct_vm, direct_alice)
    challenge_id = _open_challenge(contract, direct_vm, case_id, evidence_id)

    _mock_review(direct_vm, NOT_CONFIRMED_REVIEW)
    contract.resolve_challenge(challenge_id)

    direct_vm.clear_mocks()
    direct_vm.mock_llm(REVIEW_PATTERN, json.dumps({"decision": "DEFECT_NOT_CONFIRMED"}))  # missing keys
    agreed = direct_vm.run_validator()
    assert agreed is False


def test_resolve_challenge_rejects_malformed_review_not_confirmed_with_correction(direct_deploy, direct_accounts, direct_vm, direct_alice):
    # Fail-closed: a response claiming DEFECT_NOT_CONFIRMED but still
    # smuggling a correction is incoherent and must never reach state.
    contract = _deploy(direct_deploy, direct_accounts)
    case_id, evidence_id = _setup_case_in_challenge_window(contract, direct_vm, direct_alice)
    challenge_id = _open_challenge(contract, direct_vm, case_id, evidence_id)

    bad_review = dict(NOT_CONFIRMED_REVIEW, corrected_substantive_result="INCONSISTENT")
    _mock_review(direct_vm, bad_review)
    with direct_vm.expect_revert("MALFORMED_REVIEW:UNCONFIRMED_DEFECT_MUST_BE_UNCHANGED"):
        contract.resolve_challenge(challenge_id)


def test_resolve_challenge_rejects_malformed_review_confirmed_with_no_correction(direct_deploy, direct_accounts, direct_vm, direct_alice):
    # Fail-closed: DEFECT_CONFIRMED with every dimension left UNCHANGED
    # means nothing was actually confirmed -- reject rather than accept a
    # no-op "confirmation".
    contract = _deploy(direct_deploy, direct_accounts)
    case_id, evidence_id = _setup_case_in_challenge_window(contract, direct_vm, direct_alice)
    challenge_id = _open_challenge(contract, direct_vm, case_id, evidence_id)

    bad_review = _confirmed_review()  # all corrections default to UNCHANGED
    _mock_review(direct_vm, bad_review)
    with direct_vm.expect_revert("MALFORMED_REVIEW:CONFIRMED_DEFECT_WITH_NO_CORRECTION"):
        contract.resolve_challenge(challenge_id)


# ---------------------------------------------------------------------
# Resolving challenges: DEFECT_CONFIRMED -> targeted correction, lineage
# ---------------------------------------------------------------------


def test_resolve_challenge_sustained_corrects_only_named_dimension(direct_deploy, direct_accounts, direct_vm, direct_alice, direct_bob):
    contract = _deploy(direct_deploy, direct_accounts)
    case_id, evidence_id = _setup_case_in_challenge_window(contract, direct_vm, direct_alice)
    original_verdict_id = contract.get_case(case_id)["current_verdict_id"]

    with direct_vm.prank(direct_bob):
        challenge_id = _open_challenge(contract, direct_vm, case_id, evidence_id, ground="WRONG_TEMPORAL_INTERPRETATION")

    # Confirm a defect in ONLY the temporal dimension -- substantive_result
    # and misfiled must carry forward unchanged from the original verdict.
    review = _confirmed_review(corrected_temporal_result="NOT_SATISFIED")
    _mock_review(direct_vm, review)
    result = contract.resolve_challenge(challenge_id)
    assert result == "SUSTAINED"

    ch = contract.get_challenge(challenge_id)
    assert ch["status"] == "SUSTAINED"
    new_verdict_id = ch["resulting_verdict_id"]
    assert new_verdict_id != "" and new_verdict_id != original_verdict_id

    old_verdict = contract.get_verdict(original_verdict_id)
    assert old_verdict["superseded"] is True
    assert old_verdict["superseded_by"] == new_verdict_id
    assert old_verdict["substantive_result"] == "CONSISTENT"  # preserved, not mutated

    new_verdict = contract.get_verdict(new_verdict_id)
    assert new_verdict["temporal_result"] == "NOT_SATISFIED"  # corrected
    assert new_verdict["substantive_result"] == "CONSISTENT"  # carried forward, untouched
    assert new_verdict["misfiled"] is False  # carried forward, untouched
    assert new_verdict["superseded"] is False
    # Never introduces new evidence: the corrected verdict cites exactly
    # the same evidence the original verdict relied on.
    assert new_verdict["evidence_ids_relied_on"] == [evidence_id]

    case = contract.get_case(case_id)
    assert case["current_verdict_id"] == new_verdict_id
    assert case["status"] == "CHALLENGE_WINDOW"  # reopened for further challenges
    assert case["verdict_ids"] == [original_verdict_id, new_verdict_id]  # full lineage kept


def test_resolve_challenge_sustained_misfiled_correction_routes_to_misfiled(direct_deploy, direct_accounts, direct_vm, direct_alice):
    contract = _deploy(direct_deploy, direct_accounts)
    case_id, evidence_id = _setup_case_in_challenge_window(contract, direct_vm, direct_alice)
    challenge_id = _open_challenge(contract, direct_vm, case_id, evidence_id, ground="WRONG_TEMPORAL_INTERPRETATION")

    review = _confirmed_review(corrected_misfiled=True)
    _mock_review(direct_vm, review)
    contract.resolve_challenge(challenge_id)

    case = contract.get_case(case_id)
    assert case["status"] == "MISFILED"
    new_verdict = contract.get_verdict(case["current_verdict_id"])
    assert new_verdict["misfiled"] is True
    assert new_verdict["substantive_result"] == "CONSISTENT"  # untouched dimension carried forward


def test_resolve_challenge_requires_open_status(direct_deploy, direct_accounts, direct_vm, direct_alice):
    contract = _deploy(direct_deploy, direct_accounts)
    case_id, evidence_id = _setup_case_in_challenge_window(contract, direct_vm, direct_alice)
    challenge_id = _open_challenge(contract, direct_vm, case_id, evidence_id)

    _mock_review(direct_vm, NOT_CONFIRMED_REVIEW)
    contract.resolve_challenge(challenge_id)
    direct_vm.clear_mocks()

    with direct_vm.expect_revert("CHALLENGE_NOT_OPEN"):
        contract.resolve_challenge(challenge_id)


def test_resolve_challenge_must_resolve_oldest_first(direct_deploy, direct_accounts, direct_vm, direct_alice):
    contract = _deploy(direct_deploy, direct_accounts)
    case_id, evidence_id = _setup_case_in_challenge_window(contract, direct_vm, direct_alice)

    challenge_1 = _open_challenge(contract, direct_vm, case_id, evidence_id, argument="First challenge argument text.")
    challenge_2 = _open_challenge(contract, direct_vm, case_id, evidence_id, argument="Second challenge argument text.")

    with direct_vm.expect_revert("EARLIER_CHALLENGE_MUST_RESOLVE_FIRST"):
        contract.resolve_challenge(challenge_2)

    _mock_review(direct_vm, NOT_CONFIRMED_REVIEW)
    contract.resolve_challenge(challenge_1)  # now allowed
    ch1 = contract.get_challenge(challenge_1)
    assert ch1["status"] == "REJECTED"


def test_sustained_challenge_does_not_increment_pool_forfeitures(direct_deploy, direct_accounts, direct_vm, direct_alice, direct_bob):
    contract = _deploy(direct_deploy, direct_accounts)
    case_id, evidence_id = _setup_case_in_challenge_window(contract, direct_vm, direct_alice)

    with direct_vm.prank(direct_bob):
        challenge_id = _open_challenge(contract, direct_vm, case_id, evidence_id)

    review = _confirmed_review(corrected_substantive_result="INCONSISTENT")
    _mock_review(direct_vm, review)
    contract.resolve_challenge(challenge_id)

    assert contract.get_total_forfeited_to_pool() == 0


def test_resolve_challenge_uses_review_prompt_not_adjudication_prompt(direct_deploy, direct_accounts, direct_vm, direct_alice):
    # Regression guard against reverting to the old full-re-adjudication
    # design: only a mock matching REVIEW_PATTERN is registered (not
    # ADJUDICATION_PATTERN), so this only succeeds if resolve_challenge
    # actually builds the new targeted-review prompt.
    contract = _deploy(direct_deploy, direct_accounts)
    case_id, evidence_id = _setup_case_in_challenge_window(contract, direct_vm, direct_alice)
    challenge_id = _open_challenge(
        contract, direct_vm, case_id, evidence_id,
        ground="SOURCE_AUTHORITY_ERROR",
        argument="The announcement page is not an official DAO source.",
    )

    _mock_review(direct_vm, NOT_CONFIRMED_REVIEW)
    result = contract.resolve_challenge(challenge_id)
    assert result == "REJECTED"
