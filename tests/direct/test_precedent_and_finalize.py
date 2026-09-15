"""
finalize_case and Precedent emission: a Precedent is only ever produced
from a settled (post-challenge-window, or challenge-cap-exhausted) Verdict,
never a provisional one, and MISFILED cases finalize without producing a
Precedent at all. The filing bond always refunds regardless of outcome
(locked V1 GEN economics: no slash path for it).
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
    "reasoning": "No defect found on independent review.",
}


def _deploy(direct_deploy, direct_accounts):
    pool_address = direct_accounts[9]
    return direct_deploy(CONTRACT_PATH, pool_address)


def _as_address(raw):
    from genlayer.py.types import Address

    return raw if isinstance(raw, Address) else Address(raw)


def _setup_adjudicated_case(contract, direct_vm, respondent, judgment_overrides=None, topic_tags=None):
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
            topic_tags=topic_tags or ["marketing", "ecosystem-development"],
        )
    finally:
        direct_vm.value = 0

    direct_vm.mock_web(STATIC_URL, {"status": 200, "body": "The DAO commits to ecosystem development."})
    contract.submit_evidence(case_id, STATIC_URL, "get", "2026-02-01", "2026-02-01")
    contract.freeze_evidence(case_id)
    direct_vm.clear_mocks()

    evidence_id = contract.get_case(case_id)["evidence_ids"][0]
    judgment = dict(BASE_JUDGMENT, evidence_ids_relied_on=[evidence_id])
    if judgment_overrides:
        judgment.update(judgment_overrides)
    direct_vm.mock_llm(ADJUDICATION_PATTERN, json.dumps(judgment))
    contract.adjudicate(case_id)
    direct_vm.clear_mocks()
    return case_id, protocol_id, commitment_id, clause_id


def _open_and_reject_challenge(contract, direct_vm, case_id, evidence_id):
    direct_vm.value = CHALLENGE_BOND_ATOMS
    try:
        challenge_id = contract.open_challenge(case_id, "IGNORED_EVIDENCE", [evidence_id], "", "Argument text here.")
    finally:
        direct_vm.value = 0
    direct_vm.mock_llm(REVIEW_PATTERN, json.dumps(NOT_CONFIRMED_REVIEW))
    contract.resolve_challenge(challenge_id)
    direct_vm.clear_mocks()
    return challenge_id


# ---------------------------------------------------------------------
# Finalize after the challenge window elapses
# ---------------------------------------------------------------------


def test_finalize_after_window_elapses_emits_precedent(direct_deploy, direct_accounts, direct_vm, direct_alice):
    contract = _deploy(direct_deploy, direct_accounts)
    case_id, protocol_id, commitment_id, clause_id = _setup_adjudicated_case(contract, direct_vm, direct_alice)

    case = contract.get_case(case_id)
    direct_vm.warp(case["challenge_window_ends_at"])

    precedent_id = contract.finalize_case(case_id)
    assert precedent_id == "precedent-1"

    case = contract.get_case(case_id)
    assert case["status"] == "FINALIZED"
    assert case["filing_bond_settled"] is True
    assert case["precedent_id"] == precedent_id

    prec = contract.get_precedent(precedent_id)
    assert prec["case_id"] == case_id
    assert prec["protocol_id"] == protocol_id
    assert prec["commitment_id"] == commitment_id
    assert prec["clause_id"] == clause_id
    assert prec["substantive_result"] == "CONSISTENT"
    assert prec["temporal_result"] == "SATISFIED"
    assert prec["topic_tags"] == ["marketing", "ecosystem-development"]

    assert contract.get_precedent_ids_for_protocol(protocol_id, 0, 10) == [precedent_id]
    assert contract.get_precedent_ids_for_commitment(commitment_id, 0, 10) == [precedent_id]
    assert contract.get_precedent_ids_by_topic_tag("marketing", 0, 10) == [precedent_id]
    assert contract.get_precedent_ids_by_topic_tag("ecosystem-development", 0, 10) == [precedent_id]
    assert contract.get_precedent_ids_by_topic_tag("nonexistent-tag", 0, 10) == []


def test_finalize_before_window_elapses_reverts(direct_deploy, direct_accounts, direct_vm, direct_alice):
    contract = _deploy(direct_deploy, direct_accounts)
    case_id, *_ = _setup_adjudicated_case(contract, direct_vm, direct_alice)
    with direct_vm.expect_revert("CHALLENGE_WINDOW_STILL_OPEN"):
        contract.finalize_case(case_id)


def test_finalize_blocked_while_challenge_open(direct_deploy, direct_accounts, direct_vm, direct_alice):
    contract = _deploy(direct_deploy, direct_accounts)
    case_id, *_ = _setup_adjudicated_case(contract, direct_vm, direct_alice)
    evidence_id = contract.get_case(case_id)["evidence_ids"][0]

    direct_vm.value = CHALLENGE_BOND_ATOMS
    try:
        contract.open_challenge(case_id, "IGNORED_EVIDENCE", [evidence_id], "", "Argument text.")
    finally:
        direct_vm.value = 0

    case = contract.get_case(case_id)
    direct_vm.warp(case["challenge_window_ends_at"])

    with direct_vm.expect_revert("OPEN_CHALLENGE_PENDING"):
        contract.finalize_case(case_id)


def test_finalize_allowed_once_challenge_cap_exhausted_even_before_window(direct_deploy, direct_accounts, direct_vm, direct_alice):
    contract = _deploy(direct_deploy, direct_accounts)
    case_id, *_ = _setup_adjudicated_case(contract, direct_vm, direct_alice)
    evidence_id = contract.get_case(case_id)["evidence_ids"][0]

    for _ in range(3):  # MAX_CHALLENGES_PER_CASE
        _open_and_reject_challenge(contract, direct_vm, case_id, evidence_id)

    # Window has NOT been warped forward -- cap exhaustion alone must be
    # sufficient to finalize.
    precedent_id = contract.finalize_case(case_id)
    assert precedent_id != ""
    assert contract.get_case(case_id)["status"] == "FINALIZED"


def test_finalize_after_sustained_challenge_uses_latest_verdict(direct_deploy, direct_accounts, direct_vm, direct_alice):
    contract = _deploy(direct_deploy, direct_accounts)
    case_id, *_ = _setup_adjudicated_case(contract, direct_vm, direct_alice)
    evidence_id = contract.get_case(case_id)["evidence_ids"][0]

    direct_vm.value = CHALLENGE_BOND_ATOMS
    try:
        challenge_id = contract.open_challenge(case_id, "IGNORED_EVIDENCE", [evidence_id], "", "Argument text.")
    finally:
        direct_vm.value = 0
    confirmed = {
        "decision": "DEFECT_CONFIRMED",
        "corrected_substantive_result": "INCONSISTENT",
        "corrected_temporal_result": "UNCHANGED",
        "corrected_misfiled": "UNCHANGED",
        "reasoning": "The rationale never addressed the cited evidence, and on review the spend was not covered.",
    }
    direct_vm.mock_llm(REVIEW_PATTERN, json.dumps(confirmed))
    contract.resolve_challenge(challenge_id)
    direct_vm.clear_mocks()

    case = contract.get_case(case_id)
    direct_vm.warp(case["challenge_window_ends_at"])
    precedent_id = contract.finalize_case(case_id)

    prec = contract.get_precedent(precedent_id)
    assert prec["substantive_result"] == "INCONSISTENT"
    assert prec["verdict_id"] == case["current_verdict_id"]


def test_finalize_twice_reverts(direct_deploy, direct_accounts, direct_vm, direct_alice):
    contract = _deploy(direct_deploy, direct_accounts)
    case_id, *_ = _setup_adjudicated_case(contract, direct_vm, direct_alice)
    case = contract.get_case(case_id)
    direct_vm.warp(case["challenge_window_ends_at"])
    contract.finalize_case(case_id)

    with direct_vm.expect_revert("ALREADY_FINALIZED"):
        contract.finalize_case(case_id)


# ---------------------------------------------------------------------
# Finalize a MISFILED case -- no precedent
# ---------------------------------------------------------------------


def test_finalize_misfiled_case_produces_no_precedent(direct_deploy, direct_accounts, direct_vm, direct_alice):
    contract = _deploy(direct_deploy, direct_accounts)
    case_id, protocol_id, *_ = _setup_adjudicated_case(
        contract, direct_vm, direct_alice,
        judgment_overrides={"misfiled": True, "substantive_result": "UNCLEAR", "temporal_result": "NOT_SATISFIED"},
    )

    case = contract.get_case(case_id)
    assert case["status"] == "MISFILED"

    precedent_id = contract.finalize_case(case_id)
    assert precedent_id == ""

    case = contract.get_case(case_id)
    assert case["status"] == "FINALIZED"
    assert case["filing_bond_settled"] is True
    assert case["precedent_id"] == ""
    assert contract.get_precedent_ids_for_protocol(protocol_id, 0, 10) == []


def test_finalize_misfiled_case_does_not_require_challenge_window(direct_deploy, direct_accounts, direct_vm, direct_alice):
    # No warp() needed -- MISFILED never entered CHALLENGE_WINDOW at all.
    contract = _deploy(direct_deploy, direct_accounts)
    case_id, *_ = _setup_adjudicated_case(
        contract, direct_vm, direct_alice,
        judgment_overrides={"misfiled": True},
    )
    contract.finalize_case(case_id)  # must not revert
    assert contract.get_case(case_id)["status"] == "FINALIZED"
