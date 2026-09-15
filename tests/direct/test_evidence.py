"""
Evidence submission (Tier 1 nondet consensus: retrieval fidelity, not byte
equality) and evidence freeze (a transaction deliberately separate from
adjudication).

Uses the gltest direct-mode VM's mock_web / mock_llm / run_validator
cheatcodes to exercise both the leader path (gl.vm.run_nondet's leader_fn,
which always executes in direct mode) and the validator path (captured,
manually re-invoked via vm.run_validator() -- direct mode skips automatic
leader/validator consensus by design, so this is the only way to test
validator_fn's actual agreement/disagreement logic).

Deliberately does NOT use gl.eq_principle.prompt_comparative /
prompt_non_comparative: this workspace's installed gltest direct-mode
harness (genlayer-test 0.29.2) has no handler for the internal
'ExecPromptTemplate' call those wrappers issue (confirmed by reading
gltest/direct/wasi_mock.py), so they cannot be exercised in direct-mode
tests at all. gl.vm.run_nondet + gl.nondet.exec_prompt (mockable via
vm.mock_llm) is the only path that is both spec-correct (Stage 1 sec 4)
and testable in this toolchain -- see the Stage 2 report for the full
finding.
"""

import json

CONTRACT_PATH = "contracts/protocol_court.py"
FILING_BOND_ATOMS = 5 * 10**18  # 5 GEN, mirrors contracts/protocol_court.py
STATIC_URL = "https://example.org/announcement"


def _deploy(direct_deploy, direct_accounts):
    pool_address = direct_accounts[9]
    return direct_deploy(CONTRACT_PATH, pool_address)


def _as_address(raw):
    from genlayer.py.types import Address

    return raw if isinstance(raw, Address) else Address(raw)


def _setup_case(contract, direct_vm, respondent):
    protocol_id = contract.create_protocol("Treasury DAO", "A DAO treasury.", "treasury-dao")
    commitment_id = contract.create_commitment(
        protocol_id, "Treasury Charter", "v1", "https://example.org/charter-v1", "2026-01-01", ""
    )
    clause_id = contract.add_clause(
        commitment_id, "Article VII", "Ecosystem Development",
        "Treasury funds may be used for ecosystem development.",
        "https://example.org/charter-v1#article-vii",
    )
    contract.seal_commitment(commitment_id)

    direct_vm.value = FILING_BOND_ATOMS
    try:
        case_id = contract.file_case(
            protocol_id=protocol_id,
            commitment_id=commitment_id,
            clause_id=clause_id,
            respondent=_as_address(respondent),
            question_presented="Was the spend consistent with ecosystem development?",
            disputed_act_ref="https://explorer.example.org/tx/0xabc",
            disputed_act_summary="Contributor spent treasury funds on marketing.",
            topic_tags=["marketing"],
        )
    finally:
        direct_vm.value = 0
    return case_id


def _submit_evidence(contract, case_id, url=STATIC_URL, fetch_mode="get", published_at="2026-02-01", effective_at="2026-02-01"):
    return contract.submit_evidence(case_id, url, fetch_mode, published_at, effective_at)


# ---------------------------------------------------------------------
# Leader-path retrieval outcomes
# ---------------------------------------------------------------------


def test_submit_evidence_available(direct_deploy, direct_accounts, direct_vm, direct_alice):
    contract = _deploy(direct_deploy, direct_accounts)
    case_id = _setup_case(contract, direct_vm, direct_alice)

    direct_vm.mock_web(STATIC_URL, {"status": 200, "body": "The DAO commits to ecosystem development."})
    evidence_id = _submit_evidence(contract, case_id)
    assert evidence_id == "evidence-1"

    ev = contract.get_evidence(evidence_id)
    assert ev["case_id"] == case_id
    assert ev["retrieval_status"] == "AVAILABLE"
    assert ev["excerpt"] == "The DAO commits to ecosystem development."
    assert ev["content_fingerprint"] != ""
    assert ev["published_at"] == "2026-02-01"
    assert ev["timestamp_provenance"] == "SUBMITTER_ASSERTED"

    case = contract.get_case(case_id)
    assert case["evidence_ids"] == [evidence_id]


def test_submit_evidence_unavailable_on_http_error(direct_deploy, direct_accounts, direct_vm, direct_alice):
    contract = _deploy(direct_deploy, direct_accounts)
    case_id = _setup_case(contract, direct_vm, direct_alice)

    direct_vm.mock_web(STATIC_URL, {"status": 404, "body": ""})
    evidence_id = _submit_evidence(contract, case_id)

    ev = contract.get_evidence(evidence_id)
    assert ev["retrieval_status"] == "UNAVAILABLE"
    assert ev["excerpt"] == ""


def test_submit_evidence_fetch_failed_when_unmocked(direct_deploy, direct_accounts, direct_vm, direct_alice):
    # No mock registered at all -- the direct-mode harness raises
    # MockNotFoundError, which _fetch_evidence's broad except Exception
    # catches, yielding FETCH_FAILED. This is a normal, storable outcome,
    # never a revert (Stage 1 sec 6.2).
    contract = _deploy(direct_deploy, direct_accounts)
    case_id = _setup_case(contract, direct_vm, direct_alice)

    evidence_id = _submit_evidence(contract, case_id, url="https://example.org/never-mocked")
    ev = contract.get_evidence(evidence_id)
    assert ev["retrieval_status"] == "FETCH_FAILED"
    assert ev["excerpt"] == ""


def test_submit_evidence_excerpt_is_bounded(direct_deploy, direct_accounts, direct_vm, direct_alice):
    contract = _deploy(direct_deploy, direct_accounts)
    case_id = _setup_case(contract, direct_vm, direct_alice)

    huge = "x" * 10000
    direct_vm.mock_web(STATIC_URL, {"status": 200, "body": huge})
    evidence_id = _submit_evidence(contract, case_id)
    ev = contract.get_evidence(evidence_id)
    assert len(ev["excerpt"]) == 3000  # MAX_EVIDENCE_EXCERPT_LEN


def test_submit_evidence_render_mode(direct_deploy, direct_accounts, direct_vm, direct_alice):
    contract = _deploy(direct_deploy, direct_accounts)
    case_id = _setup_case(contract, direct_vm, direct_alice)

    direct_vm.mock_web(STATIC_URL, {"status": 200, "body": "Rendered page text."})
    evidence_id = _submit_evidence(contract, case_id, fetch_mode="render")
    ev = contract.get_evidence(evidence_id)
    assert ev["retrieval_status"] == "AVAILABLE"
    assert ev["excerpt"] == "Rendered page text."
    assert ev["fetch_mode"] == "render"


def test_submit_evidence_invalid_fetch_mode(direct_deploy, direct_accounts, direct_vm, direct_alice):
    contract = _deploy(direct_deploy, direct_accounts)
    case_id = _setup_case(contract, direct_vm, direct_alice)
    with direct_vm.expect_revert("INVALID_FETCH_MODE"):
        _submit_evidence(contract, case_id, fetch_mode="post")


def test_submit_evidence_only_case_parties(direct_deploy, direct_accounts, direct_vm, direct_alice, direct_bob):
    contract = _deploy(direct_deploy, direct_accounts)
    case_id = _setup_case(contract, direct_vm, direct_alice)  # owner=filer, alice=respondent

    direct_vm.mock_web(STATIC_URL, {"status": 200, "body": "text"})
    with direct_vm.prank(direct_bob):
        with direct_vm.expect_revert("NOT_CASE_PARTY"):
            _submit_evidence(contract, case_id)


def test_submit_evidence_respondent_may_submit(direct_deploy, direct_accounts, direct_vm, direct_alice):
    contract = _deploy(direct_deploy, direct_accounts)
    case_id = _setup_case(contract, direct_vm, direct_alice)

    direct_vm.mock_web(STATIC_URL, {"status": 200, "body": "text"})
    with direct_vm.prank(direct_alice):
        evidence_id = _submit_evidence(contract, case_id)
    assert contract.get_evidence(evidence_id)["submitted_by"].lower() == "0x" + direct_alice.hex()


def test_max_evidence_per_case_cap(direct_deploy, direct_accounts, direct_vm, direct_alice):
    contract = _deploy(direct_deploy, direct_accounts)
    case_id = _setup_case(contract, direct_vm, direct_alice)

    for i in range(12):  # MAX_EVIDENCE_PER_CASE
        url = f"https://example.org/doc-{i}"
        direct_vm.mock_web(url, {"status": 200, "body": f"doc {i}"})
        _submit_evidence(contract, case_id, url=url)

    direct_vm.mock_web("https://example.org/one-too-many", {"status": 200, "body": "x"})
    with direct_vm.expect_revert("MAX_EVIDENCE_PER_CASE_REACHED"):
        _submit_evidence(contract, case_id, url="https://example.org/one-too-many")


# ---------------------------------------------------------------------
# Tier 1 validator-path: retrieval fidelity, not byte equality
# ---------------------------------------------------------------------


def test_validator_agrees_on_identical_fetch(direct_deploy, direct_accounts, direct_vm, direct_alice):
    # Identical bytes on both sides skip the LLM fidelity judgment entirely
    # (cheap path) and agree trivially.
    contract = _deploy(direct_deploy, direct_accounts)
    case_id = _setup_case(contract, direct_vm, direct_alice)

    direct_vm.mock_web(STATIC_URL, {"status": 200, "body": "Stable content."})
    _submit_evidence(contract, case_id)

    agreed = direct_vm.run_validator()
    assert agreed is True


def test_validator_agrees_on_matching_non_available_status(direct_deploy, direct_accounts, direct_vm, direct_alice):
    # Both leader and validator independently observe the source is down
    # (same status) -- that itself is a form of retrieval-fidelity
    # agreement, per the Tier 1 design.
    contract = _deploy(direct_deploy, direct_accounts)
    case_id = _setup_case(contract, direct_vm, direct_alice)

    direct_vm.mock_web(STATIC_URL, {"status": 404, "body": ""})
    _submit_evidence(contract, case_id)

    agreed = direct_vm.run_validator()
    assert agreed is True


def test_validator_disagrees_on_status_mismatch(direct_deploy, direct_accounts, direct_vm, direct_alice):
    # Leader saw the page up; validator (re-fetching independently, after
    # the mock changes to simulate a different real-world observation)
    # sees it down. Genuine ambiguity -- must not agree.
    contract = _deploy(direct_deploy, direct_accounts)
    case_id = _setup_case(contract, direct_vm, direct_alice)

    direct_vm.mock_web(STATIC_URL, {"status": 200, "body": "Stable content."})
    _submit_evidence(contract, case_id)

    direct_vm.clear_mocks()
    direct_vm.mock_web(STATIC_URL, {"status": 404, "body": ""})
    agreed = direct_vm.run_validator()
    assert agreed is False


def test_validator_llm_judges_faithful_despite_differing_bytes(direct_deploy, direct_accounts, direct_vm, direct_alice):
    contract = _deploy(direct_deploy, direct_accounts)
    case_id = _setup_case(contract, direct_vm, direct_alice)

    direct_vm.mock_web(STATIC_URL, {"status": 200, "body": "Retrieved at 10:00: the DAO commits to X."})
    _submit_evidence(contract, case_id)

    direct_vm.clear_mocks()
    direct_vm.mock_web(STATIC_URL, {"status": 200, "body": "Retrieved at 10:05: the DAO commits to X."})
    direct_vm.mock_llm(
        r"checking whether two independently retrieved excerpts",
        json.dumps({"faithful": True, "reason": "Only the timestamp differs."}),
    )
    agreed = direct_vm.run_validator()
    assert agreed is True


def test_validator_llm_judges_not_faithful(direct_deploy, direct_accounts, direct_vm, direct_alice):
    contract = _deploy(direct_deploy, direct_accounts)
    case_id = _setup_case(contract, direct_vm, direct_alice)

    direct_vm.mock_web(STATIC_URL, {"status": 200, "body": "The DAO commits to funding marketing."})
    _submit_evidence(contract, case_id)

    direct_vm.clear_mocks()
    direct_vm.mock_web(STATIC_URL, {"status": 200, "body": "The DAO explicitly prohibits funding marketing."})
    direct_vm.mock_llm(
        r"checking whether two independently retrieved excerpts",
        json.dumps({"faithful": False, "reason": "The substantive claim is reversed."}),
    )
    agreed = direct_vm.run_validator()
    assert agreed is False


def test_validator_fail_closed_on_malformed_fidelity_judgment(direct_deploy, direct_accounts, direct_vm, direct_alice):
    # A malformed LLM response (wrong shape) must fail closed -- treated
    # as NOT faithful, never coerced into agreement.
    contract = _deploy(direct_deploy, direct_accounts)
    case_id = _setup_case(contract, direct_vm, direct_alice)

    direct_vm.mock_web(STATIC_URL, {"status": 200, "body": "Version A of the text."})
    _submit_evidence(contract, case_id)

    direct_vm.clear_mocks()
    direct_vm.mock_web(STATIC_URL, {"status": 200, "body": "Version B of the text."})
    direct_vm.mock_llm(
        r"checking whether two independently retrieved excerpts",
        json.dumps({"faithful": "yes", "extra_key": True}),  # wrong types/shape
    )
    agreed = direct_vm.run_validator()
    assert agreed is False


# ---------------------------------------------------------------------
# Evidence freeze
# ---------------------------------------------------------------------


def test_freeze_evidence(direct_deploy, direct_accounts, direct_vm, direct_alice):
    contract = _deploy(direct_deploy, direct_accounts)
    case_id = _setup_case(contract, direct_vm, direct_alice)

    direct_vm.mock_web(STATIC_URL, {"status": 200, "body": "Some evidence."})
    _submit_evidence(contract, case_id)

    fingerprint = contract.freeze_evidence(case_id)
    assert fingerprint != ""

    case = contract.get_case(case_id)
    assert case["status"] == "EVIDENCE_FROZEN"
    assert case["evidence_fingerprint"] == fingerprint
    assert case["evidence_frozen_at"] != ""


def test_freeze_evidence_requires_at_least_one_item(direct_deploy, direct_accounts, direct_vm, direct_alice):
    contract = _deploy(direct_deploy, direct_accounts)
    case_id = _setup_case(contract, direct_vm, direct_alice)
    with direct_vm.expect_revert("NO_EVIDENCE_SUBMITTED"):
        contract.freeze_evidence(case_id)


def test_freeze_evidence_only_filer(direct_deploy, direct_accounts, direct_vm, direct_alice):
    contract = _deploy(direct_deploy, direct_accounts)
    case_id = _setup_case(contract, direct_vm, direct_alice)

    direct_vm.mock_web(STATIC_URL, {"status": 200, "body": "Some evidence."})
    _submit_evidence(contract, case_id)

    with direct_vm.prank(direct_alice):  # respondent, not filer
        with direct_vm.expect_revert("NOT_CASE_FILER"):
            contract.freeze_evidence(case_id)


def test_freeze_evidence_blocks_further_submission(direct_deploy, direct_accounts, direct_vm, direct_alice):
    contract = _deploy(direct_deploy, direct_accounts)
    case_id = _setup_case(contract, direct_vm, direct_alice)

    direct_vm.mock_web(STATIC_URL, {"status": 200, "body": "Some evidence."})
    _submit_evidence(contract, case_id)
    contract.freeze_evidence(case_id)

    direct_vm.mock_web("https://example.org/late", {"status": 200, "body": "too late"})
    with direct_vm.expect_revert("CASE_NOT_OPEN_FOR_EVIDENCE"):
        _submit_evidence(contract, case_id, url="https://example.org/late")


def test_freeze_evidence_fingerprint_is_order_independent(direct_deploy, direct_accounts, direct_vm, direct_alice):
    contract = _deploy(direct_deploy, direct_accounts)

    case_a = _setup_case(contract, direct_vm, direct_alice)
    direct_vm.mock_web("https://example.org/a", {"status": 200, "body": "Doc A"})
    direct_vm.mock_web("https://example.org/b", {"status": 200, "body": "Doc B"})
    _submit_evidence(contract, case_a, url="https://example.org/a")
    _submit_evidence(contract, case_a, url="https://example.org/b")
    fp_ab = contract.freeze_evidence(case_a)

    case_b = _setup_case(contract, direct_vm, direct_alice)
    _submit_evidence(contract, case_b, url="https://example.org/b")
    _submit_evidence(contract, case_b, url="https://example.org/a")
    fp_ba = contract.freeze_evidence(case_b)

    assert fp_ab == fp_ba
