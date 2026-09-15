"""
Case filing, extended from the pre-spec scaffold's Docket/Case-filing
behavior: same immutable governing-authority binding (Protocol -> sealed
Commitment -> sealed Clause), now payable and requiring the fixed V1
filing bond exactly (locked GEN economics: filing bond amount is fixed
deployment configuration, no governance surface).
"""

import pytest

CONTRACT_PATH = "contracts/protocol_court.py"
FILING_BOND_ATOMS = 5 * 10**18  # 5 GEN, mirrors contracts/protocol_court.py


def _deploy(direct_deploy, direct_accounts):
    pool_address = direct_accounts[9]
    return direct_deploy(CONTRACT_PATH, pool_address)


def _setup_sealed_clause(contract):
    protocol_id = contract.create_protocol("Treasury DAO", "A DAO treasury.", "treasury-dao")
    commitment_id = contract.create_commitment(
        protocol_id, "Treasury Charter", "v1", "https://example.org/charter-v1", "2026-01-01", ""
    )
    clause_id = contract.add_clause(
        commitment_id,
        "Article VII",
        "Ecosystem Development",
        "Treasury funds may be used for ecosystem development.",
        "https://example.org/charter-v1#article-vii",
    )
    contract.seal_commitment(commitment_id)
    return protocol_id, commitment_id, clause_id


def _as_address(raw):
    from genlayer.py.types import Address

    return raw if isinstance(raw, Address) else Address(raw)


def _file_case(contract, direct_vm, protocol_id, commitment_id, clause_id, respondent, value=FILING_BOND_ATOMS, **overrides):
    kwargs = dict(
        protocol_id=protocol_id,
        commitment_id=commitment_id,
        clause_id=clause_id,
        respondent=_as_address(respondent),
        question_presented="Was the $100k marketing spend consistent with ecosystem development?",
        disputed_act_ref="https://explorer.example.org/tx/0xabc",
        disputed_act_summary="Contributor spent $100k of treasury funds on a marketing campaign.",
        topic_tags=["marketing", "ecosystem-development"],
    )
    kwargs.update(overrides)
    direct_vm.value = value
    try:
        return contract.file_case(**kwargs)
    finally:
        direct_vm.value = 0


# ---------------------------------------------------------------------
# Filing
# ---------------------------------------------------------------------


def test_file_case_valid(direct_deploy, direct_accounts, direct_vm, direct_owner, direct_alice):
    contract = _deploy(direct_deploy, direct_accounts)
    protocol_id, commitment_id, clause_id = _setup_sealed_clause(contract)

    case_id = _file_case(contract, direct_vm, protocol_id, commitment_id, clause_id, direct_alice)
    assert case_id == "case-1"

    case = contract.get_case(case_id)
    assert case["filer"].lower() == "0x" + direct_owner.hex()
    assert case["respondent"].lower() == "0x" + direct_alice.hex()
    assert case["protocol_id"] == protocol_id
    assert case["commitment_id"] == commitment_id
    assert case["clause_id"] == clause_id
    assert case["status"] == "FILED"
    assert case["topic_tags"] == ["marketing", "ecosystem-development"]
    assert case["filing_bond_amount"] == FILING_BOND_ATOMS
    assert case["filing_bond_settled"] is False
    assert contract.get_case_count() == 1
    # Note: the gltest direct-mode runner does not model native GEN balance
    # movement (documented limitation, consistent with prior GenLayer
    # projects in this workspace) -- get_balance() custody verification is
    # a live-network-only concern, out of scope while Stage 2 stays
    # deploy-free. gl.message.value plumbing itself IS exercised here (see
    # test_file_case_requires_exact_bond) and is what the payable-amount
    # check above actually depends on.


def test_file_case_requires_exact_bond(direct_deploy, direct_accounts, direct_vm, direct_alice):
    contract = _deploy(direct_deploy, direct_accounts)
    protocol_id, commitment_id, clause_id = _setup_sealed_clause(contract)

    with direct_vm.expect_revert("FILING_BOND_MISMATCH"):
        _file_case(contract, direct_vm, protocol_id, commitment_id, clause_id, direct_alice, value=FILING_BOND_ATOMS - 1)

    with direct_vm.expect_revert("FILING_BOND_MISMATCH"):
        _file_case(contract, direct_vm, protocol_id, commitment_id, clause_id, direct_alice, value=FILING_BOND_ATOMS + 1)

    with direct_vm.expect_revert("FILING_BOND_MISMATCH"):
        _file_case(contract, direct_vm, protocol_id, commitment_id, clause_id, direct_alice, value=0)


def test_file_case_respondent_cannot_equal_filer(direct_deploy, direct_accounts, direct_vm, direct_owner):
    contract = _deploy(direct_deploy, direct_accounts)
    protocol_id, commitment_id, clause_id = _setup_sealed_clause(contract)
    with direct_vm.expect_revert("RESPONDENT_EQUALS_FILER"):
        _file_case(contract, direct_vm, protocol_id, commitment_id, clause_id, direct_owner)


def test_file_case_requires_sealed_commitment(direct_deploy, direct_accounts, direct_vm, direct_alice):
    contract = _deploy(direct_deploy, direct_accounts)
    protocol_id = contract.create_protocol("DAO", "desc", "ns")
    commitment_id = contract.create_commitment(
        protocol_id, "Charter", "v1", "https://example.org/v1", "2026-01-01", ""
    )
    clause_id = contract.add_clause(commitment_id, "Art. I", "Title", "Text.", "")
    # not sealed
    with direct_vm.expect_revert("COMMITMENT_NOT_SEALED"):
        _file_case(contract, direct_vm, protocol_id, commitment_id, clause_id, direct_alice)


def test_file_case_clause_commitment_mismatch(direct_deploy, direct_accounts, direct_vm, direct_alice):
    contract = _deploy(direct_deploy, direct_accounts)
    protocol_id, commitment_id, clause_id = _setup_sealed_clause(contract)

    other_commitment_id = contract.create_commitment(
        protocol_id, "Other Charter", "v2", "https://example.org/v2", "2026-06-01", ""
    )
    contract.seal_commitment(other_commitment_id)

    with direct_vm.expect_revert("CLAUSE_COMMITMENT_MISMATCH"):
        _file_case(contract, direct_vm, protocol_id, other_commitment_id, clause_id, direct_alice)


@pytest.mark.parametrize(
    "field,value,expected_msg",
    [
        ("question_presented", "", "TOO_SHORT:question_presented"),
        ("question_presented", "x" * 481, "TOO_LONG:question_presented"),
        ("disputed_act_ref", "", "EMPTY_URL:disputed_act_ref"),
        ("disputed_act_summary", "  ", "TOO_SHORT:disputed_act_summary"),
    ],
)
def test_file_case_field_boundaries(direct_deploy, direct_accounts, direct_vm, direct_alice, field, value, expected_msg):
    contract = _deploy(direct_deploy, direct_accounts)
    protocol_id, commitment_id, clause_id = _setup_sealed_clause(contract)
    with direct_vm.expect_revert(expected_msg):
        _file_case(contract, direct_vm, protocol_id, commitment_id, clause_id, direct_alice, **{field: value})


def test_file_case_too_many_topic_tags(direct_deploy, direct_accounts, direct_vm, direct_alice):
    contract = _deploy(direct_deploy, direct_accounts)
    protocol_id, commitment_id, clause_id = _setup_sealed_clause(contract)
    with direct_vm.expect_revert("TOO_MANY_TOPIC_TAGS"):
        _file_case(
            contract, direct_vm, protocol_id, commitment_id, clause_id, direct_alice,
            topic_tags=[f"tag-{i}" for i in range(9)],
        )


def test_case_ids_sequential_and_indexed(direct_deploy, direct_accounts, direct_vm, direct_alice, direct_bob):
    contract = _deploy(direct_deploy, direct_accounts)
    protocol_id, commitment_id, clause_id = _setup_sealed_clause(contract)

    c1 = _file_case(contract, direct_vm, protocol_id, commitment_id, clause_id, direct_alice)
    c2 = _file_case(contract, direct_vm, protocol_id, commitment_id, clause_id, direct_bob)
    assert (c1, c2) == ("case-1", "case-2")
    assert contract.get_case_count() == 2

    by_protocol = contract.get_case_ids_for_protocol(protocol_id, 0, 10)
    assert set(by_protocol) == {c1, c2}
    by_clause = contract.get_case_ids_for_clause(clause_id, 0, 10)
    assert set(by_clause) == {c1, c2}
