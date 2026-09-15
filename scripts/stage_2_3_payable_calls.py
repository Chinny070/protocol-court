"""
Stage 2.3 StudioNet verification -- payable methods only.

Covers exactly the two Protocol Court methods the genlayer CLI cannot
exercise, because `genlayer write` has no flag to attach native GEN value
(it always sends value=0):

    file_case        (requires exactly FILING_BOND_ATOMS   = 5 GEN)
    open_challenge   (requires exactly CHALLENGE_BOND_ATOMS = 1 GEN)

Every other lifecycle step (create_protocol, create_commitment, add_clause,
seal_commitment, submit_evidence, freeze_evidence, adjudicate,
resolve_challenge, finalize_case, and every get_* read) is a plain,
non-payable call -- use the genlayer CLI for those, per
docs/STAGE_2_3_STUDIONET_VERIFICATION_CHECKLIST.md.

----------------------------------------------------------------------------
WHO RUNS THIS, AND HOW YOUR KEY IS HANDLED
----------------------------------------------------------------------------

You run this script yourself, from your own terminal, with your own key.
This code never embeds a key, never asks Claude for one, and never sends
your key anywhere -- it reads ONE private key from an environment variable
you set in your own shell immediately before running, uses it locally via
genlayer-py to sign, and that's the only place it touches the key.

Before running, in your own shell (not committed anywhere, not shared):

    # PowerShell
    $env:PROTOCOL_COURT_SIGNER_KEY = "0xYOUR_PRIVATE_KEY_HERE"

    # bash
    export PROTOCOL_COURT_SIGNER_KEY="0xYOUR_PRIVATE_KEY_HERE"

Use a disposable/throwaway key funded with only as much StudioNet GEN as
this test needs -- never your primary wallet's key.

----------------------------------------------------------------------------
WHERE YOU FILL THINGS IN
----------------------------------------------------------------------------

Every value that needs YOUR input is collected in the CONFIG block below,
marked "<<< FILL IN >>>". Nothing else in this file should need editing.
This script is NOT executed by Claude -- it is prepared for you to read,
edit, and run yourself.
"""

import os
import sys

import genlayer_py
from genlayer_py import create_account, create_client, studionet

# ============================================================================
# CONFIG -- fill in before running
# ============================================================================

# The deployed Protocol Court test-instance address from Stage 2.3 section 1.
CONTRACT_ADDRESS = "0x8Df939387BfF25aF45ca5BD51a8Fb21c278FDB34"

# Which action to run. Run this script twice -- once per action -- rather
# than both in one run, so each transaction's result is easy to isolate
# and record separately in the Stage 2.3 report.
#   "file_case"       -> exercises the filing-bond path
#   "open_challenge"  -> exercises the challenge-bond path (needs a case
#                        already in CHALLENGE_WINDOW status, produced by
#                        running the non-payable CLI lifecycle steps first)
ACTION = "file_case"

# --- file_case arguments (only used when ACTION == "file_case") -----------
FILE_CASE_ARGS = {
    "protocol_id": "protocol-2",
    "commitment_id": "commitment-1",
    "clause_id": "clause-1",
    "respondent": "0x97108d254537d7db1c6b7521516572dfc2ec6be2",
    "question_presented": "Was the spend consistent with ecosystem development?",
    "disputed_act_ref": "https://explorer.example.org/tx/0xabc",
    "disputed_act_summary": "Contributor spent treasury funds on a marketing campaign.",
    "topic_tags": ["marketing", "ecosystem-development"],
}

# --- open_challenge arguments (only used when ACTION == "open_challenge") -
OPEN_CHALLENGE_ARGS = {
    "case_id": "case-1",  # <<< FILL IN >>> -- must be a case in CHALLENGE_WINDOW status
    "ground": "IGNORED_EVIDENCE",  # one of: IGNORED_EVIDENCE, WRONG_TEMPORAL_INTERPRETATION,
                                    # SOURCE_AUTHORITY_ERROR, IMPLEMENTATION_CONTRADICTION
    "cited_evidence_ids": ["evidence-1"],  # <<< FILL IN >>> -- must belong to case_id
    "cited_precedent_id": "",  # only required (non-empty) for IMPLEMENTATION_CONTRADICTION
    "argument": "The verdict's rationale never addresses evidence-1's exact wording.",
}

# ============================================================================
# Fixed bond amounts -- mirror contracts/protocol_court.py exactly. Do not
# change these to "make a call succeed": a mismatch here means something is
# wrong with your understanding of the deployed contract's configuration,
# not a reason to adjust the script.
# ============================================================================
FILING_BOND_ATOMS = 5 * 10**18  # 5 GEN
CHALLENGE_BOND_ATOMS = 1 * 10**18  # 1 GEN


def _load_signer():
    private_key = os.environ.get("PROTOCOL_COURT_SIGNER_KEY")
    if not private_key:
        print(
            "PROTOCOL_COURT_SIGNER_KEY is not set in this shell.\n"
            "Set it yourself before running this script -- see the module "
            "docstring at the top of this file for the exact command.",
            file=sys.stderr,
        )
        sys.exit(1)
    return create_account(private_key)


def _client(account):
    return create_client(chain=studionet, account=account)


def run_file_case(client, account):
    print(f"Signer address: {account.address}")
    print(f"Attaching value: {FILING_BOND_ATOMS} atoms (0.1 GEN)")
    print(f"Args: {FILE_CASE_ARGS}")

    tx_hash = client.write_contract(
        address=CONTRACT_ADDRESS,
        function_name="file_case",
        account=account,
        value=FILING_BOND_ATOMS,
        args=[
            FILE_CASE_ARGS["protocol_id"],
            FILE_CASE_ARGS["commitment_id"],
            FILE_CASE_ARGS["clause_id"],
            FILE_CASE_ARGS["respondent"],
            FILE_CASE_ARGS["question_presented"],
            FILE_CASE_ARGS["disputed_act_ref"],
            FILE_CASE_ARGS["disputed_act_summary"],
            FILE_CASE_ARGS["topic_tags"],
        ],
    )
    print(f"Submitted tx: {tx_hash}")

    receipt = client.wait_for_transaction_receipt(tx_hash, full_transaction=True)
    print("Receipt status:", receipt.status)
    print("Full receipt (record this for the Stage 2.3 report):")
    print(receipt)


def run_open_challenge(client, account):
    print(f"Signer address: {account.address}")
    print(f"Attaching value: {CHALLENGE_BOND_ATOMS} atoms (0.02 GEN)")
    print(f"Args: {OPEN_CHALLENGE_ARGS}")

    tx_hash = client.write_contract(
        address=CONTRACT_ADDRESS,
        function_name="open_challenge",
        account=account,
        value=CHALLENGE_BOND_ATOMS,
        args=[
            OPEN_CHALLENGE_ARGS["case_id"],
            OPEN_CHALLENGE_ARGS["ground"],
            OPEN_CHALLENGE_ARGS["cited_evidence_ids"],
            OPEN_CHALLENGE_ARGS["cited_precedent_id"],
            OPEN_CHALLENGE_ARGS["argument"],
        ],
    )
    print(f"Submitted tx: {tx_hash}")

    receipt = client.wait_for_transaction_receipt(tx_hash, full_transaction=True)
    print("Receipt status:", receipt.status)
    print("Full receipt (record this for the Stage 2.3 report):")
    print(receipt)


def main():
    if CONTRACT_ADDRESS.startswith("0xREPLACE"):
        print("Fill in CONTRACT_ADDRESS in the CONFIG block before running.", file=sys.stderr)
        sys.exit(1)

    account = _load_signer()
    client = _client(account)

    if ACTION == "file_case":
        run_file_case(client, account)
    elif ACTION == "open_challenge":
        run_open_challenge(client, account)
    else:
        print(f"Unknown ACTION {ACTION!r}: must be 'file_case' or 'open_challenge'.", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
