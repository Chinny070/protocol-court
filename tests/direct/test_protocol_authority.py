"""
Protocol / Commitment / Clause authority chain.

Renamed from the pre-spec scaffold (Lawbook -> Protocol, Instrument ->
Commitment, Provision -> Clause) with the same authority-chain guarantees:
versioned, sealed Commitments; immutable exact-version Clause citation;
ownership enforcement; bounded pagination; hard storage caps. Also covers
the new-in-Stage-2 supersession mechanic (mark_commitment_superseded),
which did not exist in the pre-spec scaffold.

Evidence/Verdict/Challenge/Precedent/Case behavior is covered in the other
test_*.py files in this directory, not here.
"""

import pytest

CONTRACT_PATH = "contracts/protocol_court.py"
POOL_ADDRESS_SEED = "pool"


def _deploy(direct_deploy, direct_accounts):
    pool_address = direct_accounts[9]
    return direct_deploy(CONTRACT_PATH, pool_address)


def _create_protocol(contract, name="Treasury DAO", description="A DAO treasury.", ns="treasury-dao"):
    return contract.create_protocol(name, description, ns)


def _create_commitment(
    contract,
    protocol_id,
    title="Treasury Charter",
    version_label="v1",
    authority_url="https://example.org/charter-v1",
    effective_from="2026-01-01",
    effective_until="",
):
    return contract.create_commitment(
        protocol_id, title, version_label, authority_url, effective_from, effective_until
    )


def _add_clause(
    contract,
    commitment_id,
    citation="Article VII",
    title="Ecosystem Development",
    text="Treasury funds may be used for ecosystem development.",
    source_ref="https://example.org/charter-v1#article-vii",
):
    return contract.add_clause(commitment_id, citation, title, text, source_ref)


# ---------------------------------------------------------------------
# Protocol creation
# ---------------------------------------------------------------------


def test_create_protocol_valid(direct_deploy, direct_accounts, direct_owner):
    contract = _deploy(direct_deploy, direct_accounts)
    protocol_id = _create_protocol(contract)
    assert protocol_id == "protocol-1"

    p = contract.get_protocol(protocol_id)
    assert p["name"] == "Treasury DAO"
    assert p["description"] == "A DAO treasury."
    assert p["canonical_namespace"] == "treasury-dao"
    assert p["creator"].lower() == "0x" + direct_owner.hex()
    assert p["commitment_count"] == 0
    assert contract.get_protocol_count() == 1


def test_protocol_ids_are_sequential(direct_deploy, direct_accounts):
    contract = _deploy(direct_deploy, direct_accounts)
    id1 = _create_protocol(contract, ns="ns-1")
    id2 = _create_protocol(contract, ns="ns-2")
    id3 = _create_protocol(contract, ns="ns-3")
    assert (id1, id2, id3) == ("protocol-1", "protocol-2", "protocol-3")
    assert contract.get_protocol_count() == 3


def test_protocol_creator_attribution(direct_deploy, direct_accounts, direct_vm, direct_alice):
    contract = _deploy(direct_deploy, direct_accounts)
    with direct_vm.prank(direct_alice):
        protocol_id = _create_protocol(contract)
    p = contract.get_protocol(protocol_id)
    assert p["creator"].lower() == "0x" + direct_alice.hex()


@pytest.mark.parametrize(
    "name,description,ns,expected_msg",
    [
        ("", "desc", "ns", "TOO_SHORT:name"),
        ("x" * 201, "desc", "ns", "TOO_LONG:name"),
        ("Name", "x" * 2001, "ns", "TOO_LONG:description"),
        ("Name", "desc", "", "TOO_SHORT:canonical_namespace"),
        ("Name", "desc", "x" * 65, "TOO_LONG:canonical_namespace"),
    ],
)
def test_create_protocol_field_boundaries(direct_deploy, direct_accounts, direct_vm, name, description, ns, expected_msg):
    contract = _deploy(direct_deploy, direct_accounts)
    with direct_vm.expect_revert(expected_msg):
        contract.create_protocol(name, description, ns)


def test_create_protocol_description_may_be_empty(direct_deploy, direct_accounts):
    contract = _deploy(direct_deploy, direct_accounts)
    protocol_id = contract.create_protocol("Name", "", "ns")
    assert contract.get_protocol(protocol_id)["description"] == ""


def test_max_protocols_cap(direct_deploy, direct_accounts, direct_vm):
    contract = _deploy(direct_deploy, direct_accounts)
    max_protocols = 100  # mirrors MAX_PROTOCOLS in contracts/protocol_court.py
    for i in range(max_protocols):
        _create_protocol(contract, ns=f"ns-{i}")
    with direct_vm.expect_revert("MAX_PROTOCOLS_REACHED"):
        _create_protocol(contract, ns="one-too-many")


# ---------------------------------------------------------------------
# Commitment creation
# ---------------------------------------------------------------------


def test_create_commitment_under_correct_protocol(direct_deploy, direct_accounts):
    contract = _deploy(direct_deploy, direct_accounts)
    protocol_id = _create_protocol(contract)
    commitment_id = _create_commitment(contract, protocol_id)
    assert commitment_id == "commitment-1"

    c = contract.get_commitment(commitment_id)
    assert c["protocol_id"] == protocol_id
    assert c["title"] == "Treasury Charter"
    assert c["version_label"] == "v1"
    assert c["sealed"] is False
    assert c["status"] == "DRAFT"
    assert c["clause_count"] == 0

    p = contract.get_protocol(protocol_id)
    assert p["commitment_count"] == 1


def test_create_commitment_nonexistent_protocol(direct_deploy, direct_accounts, direct_vm):
    contract = _deploy(direct_deploy, direct_accounts)
    with direct_vm.expect_revert("PROTOCOL_NOT_FOUND"):
        _create_commitment(contract, "protocol-999")


def test_create_commitment_unauthorized(direct_deploy, direct_accounts, direct_vm, direct_alice):
    contract = _deploy(direct_deploy, direct_accounts)
    protocol_id = _create_protocol(contract)  # created by direct_owner
    with direct_vm.prank(direct_alice):
        with direct_vm.expect_revert("NOT_PROTOCOL_CREATOR"):
            _create_commitment(contract, protocol_id)


@pytest.mark.parametrize(
    "authority_url,expected_msg",
    [
        ("", "EMPTY_URL:authority_url"),
        ("ftp://example.org/doc", "UNSUPPORTED_URL_SCHEME:authority_url"),
        ("javascript:alert(1)", "UNSUPPORTED_URL_SCHEME:authority_url"),
        ("http://" + "x" * 600, "TOO_LONG:authority_url"),
    ],
)
def test_create_commitment_authority_url_validation(direct_deploy, direct_accounts, direct_vm, authority_url, expected_msg):
    contract = _deploy(direct_deploy, direct_accounts)
    protocol_id = _create_protocol(contract)
    with direct_vm.expect_revert(expected_msg):
        _create_commitment(contract, protocol_id, authority_url=authority_url)


def test_update_commitment_metadata_while_unsealed(direct_deploy, direct_accounts):
    contract = _deploy(direct_deploy, direct_accounts)
    protocol_id = _create_protocol(contract)
    commitment_id = _create_commitment(contract, protocol_id)
    contract.update_commitment_metadata(
        commitment_id, "New Title", "v1-draft", "https://example.org/v2", "2026-02-01", ""
    )
    c = contract.get_commitment(commitment_id)
    assert c["title"] == "New Title"
    assert c["version_label"] == "v1-draft"


def test_update_commitment_metadata_blocked_after_seal(direct_deploy, direct_accounts, direct_vm):
    contract = _deploy(direct_deploy, direct_accounts)
    protocol_id = _create_protocol(contract)
    commitment_id = _create_commitment(contract, protocol_id)
    contract.seal_commitment(commitment_id)
    with direct_vm.expect_revert("COMMITMENT_SEALED"):
        contract.update_commitment_metadata(
            commitment_id, "New Title", "v1-draft", "https://example.org/v2", "2026-02-01", ""
        )


def test_seal_commitment_sets_status_active(direct_deploy, direct_accounts):
    contract = _deploy(direct_deploy, direct_accounts)
    protocol_id = _create_protocol(contract)
    commitment_id = _create_commitment(contract, protocol_id)
    contract.seal_commitment(commitment_id)
    c = contract.get_commitment(commitment_id)
    assert c["sealed"] is True
    assert c["status"] == "ACTIVE"
    assert c["sealed_at"] != ""


def test_seal_commitment_twice_reverts(direct_deploy, direct_accounts, direct_vm):
    contract = _deploy(direct_deploy, direct_accounts)
    protocol_id = _create_protocol(contract)
    commitment_id = _create_commitment(contract, protocol_id)
    contract.seal_commitment(commitment_id)
    with direct_vm.expect_revert("COMMITMENT_ALREADY_SEALED"):
        contract.seal_commitment(commitment_id)


# ---------------------------------------------------------------------
# Commitment versioning / supersession
# ---------------------------------------------------------------------


def test_mark_commitment_superseded(direct_deploy, direct_accounts):
    contract = _deploy(direct_deploy, direct_accounts)
    protocol_id = _create_protocol(contract)
    v1 = _create_commitment(contract, protocol_id, version_label="v1", effective_from="2026-01-01")
    contract.seal_commitment(v1)
    v2 = _create_commitment(contract, protocol_id, version_label="v2", effective_from="2026-06-01")
    contract.seal_commitment(v2)

    contract.mark_commitment_superseded(v1, v2)

    c1 = contract.get_commitment(v1)
    assert c1["status"] == "SUPERSEDED"
    assert c1["superseded_by"] == v2
    assert c1["effective_until"] == "2026-06-01"  # auto-closed to the new version's start

    c2 = contract.get_commitment(v2)
    assert c2["status"] == "ACTIVE"


def test_mark_commitment_superseded_requires_both_sealed(direct_deploy, direct_accounts, direct_vm):
    contract = _deploy(direct_deploy, direct_accounts)
    protocol_id = _create_protocol(contract)
    v1 = _create_commitment(contract, protocol_id, version_label="v1")
    contract.seal_commitment(v1)
    v2 = _create_commitment(contract, protocol_id, version_label="v2")  # not sealed

    with direct_vm.expect_revert("SUPERSEDING_COMMITMENT_NOT_SEALED"):
        contract.mark_commitment_superseded(v1, v2)


def test_mark_commitment_superseded_cross_protocol_rejected(direct_deploy, direct_accounts, direct_vm):
    contract = _deploy(direct_deploy, direct_accounts)
    p1 = _create_protocol(contract, ns="p1")
    p2 = _create_protocol(contract, ns="p2")
    v1 = _create_commitment(contract, p1)
    contract.seal_commitment(v1)
    v2 = _create_commitment(contract, p2)
    contract.seal_commitment(v2)

    with direct_vm.expect_revert("COMMITMENT_PROTOCOL_MISMATCH"):
        contract.mark_commitment_superseded(v1, v2)


def test_mark_commitment_superseded_unauthorized(direct_deploy, direct_accounts, direct_vm, direct_alice):
    contract = _deploy(direct_deploy, direct_accounts)
    protocol_id = _create_protocol(contract)
    v1 = _create_commitment(contract, protocol_id)
    contract.seal_commitment(v1)
    v2 = _create_commitment(contract, protocol_id)
    contract.seal_commitment(v2)

    with direct_vm.prank(direct_alice):
        with direct_vm.expect_revert("NOT_COMMITMENT_CREATOR"):
            contract.mark_commitment_superseded(v1, v2)


def test_multiple_sealed_versions_coexist(direct_deploy, direct_accounts):
    # Temporal authority: old sealed versions remain readable and citable
    # even after a newer version exists and the old one is superseded.
    contract = _deploy(direct_deploy, direct_accounts)
    protocol_id = _create_protocol(contract)
    v1 = _create_commitment(contract, protocol_id, version_label="v1")
    contract.seal_commitment(v1)
    v2 = _create_commitment(contract, protocol_id, version_label="v2")
    contract.seal_commitment(v2)
    contract.mark_commitment_superseded(v1, v2)

    assert contract.get_commitment(v1)["version_label"] == "v1"
    assert contract.get_commitment(v2)["version_label"] == "v2"
    ids = contract.get_commitment_ids_for_protocol(protocol_id, 0, 10)
    assert set(ids) == {v1, v2}


# ---------------------------------------------------------------------
# Clause creation
# ---------------------------------------------------------------------


def test_add_clause_and_resolve(direct_deploy, direct_accounts):
    contract = _deploy(direct_deploy, direct_accounts)
    protocol_id = _create_protocol(contract)
    commitment_id = _create_commitment(contract, protocol_id)
    clause_id = _add_clause(contract, commitment_id)
    assert clause_id == "clause-1"

    cl = contract.get_clause(clause_id)
    assert cl["commitment_id"] == commitment_id
    assert cl["citation"] == "Article VII"
    assert cl["ordinal"] == 0

    assert contract.get_clause_count(commitment_id) == 1
    assert contract.get_clause_by_ordinal(commitment_id, 0)["clause_id"] == clause_id


def test_add_clause_blocked_after_seal(direct_deploy, direct_accounts, direct_vm):
    contract = _deploy(direct_deploy, direct_accounts)
    protocol_id = _create_protocol(contract)
    commitment_id = _create_commitment(contract, protocol_id)
    contract.seal_commitment(commitment_id)
    with direct_vm.expect_revert("COMMITMENT_SEALED"):
        _add_clause(contract, commitment_id)


def test_add_clause_unauthorized(direct_deploy, direct_accounts, direct_vm, direct_alice):
    contract = _deploy(direct_deploy, direct_accounts)
    protocol_id = _create_protocol(contract)
    commitment_id = _create_commitment(contract, protocol_id)
    with direct_vm.prank(direct_alice):
        with direct_vm.expect_revert("NOT_COMMITMENT_CREATOR"):
            _add_clause(contract, commitment_id)


def test_clause_ordinals_sequential(direct_deploy, direct_accounts):
    contract = _deploy(direct_deploy, direct_accounts)
    protocol_id = _create_protocol(contract)
    commitment_id = _create_commitment(contract, protocol_id)
    c1 = _add_clause(contract, commitment_id, citation="Art. I")
    c2 = _add_clause(contract, commitment_id, citation="Art. II")
    c3 = _add_clause(contract, commitment_id, citation="Art. III")

    page = contract.get_clauses_page(commitment_id, 0, 10)
    assert [c["clause_id"] for c in page] == [c1, c2, c3]
    assert [c["ordinal"] for c in page] == [0, 1, 2]


def test_get_clause_nonexistent(direct_deploy, direct_accounts, direct_vm):
    contract = _deploy(direct_deploy, direct_accounts)
    with direct_vm.expect_revert("CLAUSE_NOT_FOUND"):
        contract.get_clause("clause-999")


def test_pagination_bounds(direct_deploy, direct_accounts, direct_vm):
    contract = _deploy(direct_deploy, direct_accounts)
    protocol_id = _create_protocol(contract)
    commitment_id = _create_commitment(contract, protocol_id)
    for i in range(3):
        _add_clause(contract, commitment_id, citation=f"Art. {i}")

    with direct_vm.expect_revert("PAGE_TOO_LARGE"):
        contract.get_clauses_page(commitment_id, 0, 26)
    with direct_vm.expect_revert("INVALID_LIMIT"):
        contract.get_clauses_page(commitment_id, 0, 0)
