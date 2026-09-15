import { chains, createClient } from "genlayer-js";

/**
 * Protocol Court -- verified Stage 2.3 StudioNet TEST instance. This is NOT
 * the production/canonical deployment; see
 * ../../../docs/STAGE_2_FINAL_VERIFICATION_REPORT.md for the live lifecycle
 * proof this address was verified against. Swap this constant (only this
 * constant) when a production contract is deployed.
 */
export const PROTOCOL_COURT_ADDRESS =
  "0xd7D2D709bB334C2BAD1D6E185eE539dF5D3B3710" as const;

export const STUDIONET_CHAIN_ID = 61999;
export const STUDIONET_CHAIN_ID_HEX = "0xf22f";
export const STUDIONET_RPC = "https://studio.genlayer.com/api";

/**
 * Read-only client -- no account required, works before a wallet is
 * connected. Every browsing view in Protocol Court Explorer (protocols,
 * commitments, clauses, cases, evidence, precedents) uses this client, so a
 * visitor gains full value with no wallet at all.
 */
export const readClient = createClient({ chain: chains.studionet });

/** MetaMask "Add Network" params for StudioNet, used only when a wallet is
 * connected for a write action (filing a case, submitting evidence,
 * opening/resolving a challenge, finalizing). */
export const STUDIONET_WALLET_PARAMS = {
  chainId: STUDIONET_CHAIN_ID_HEX,
  chainName: "GenLayer Studio Network",
  nativeCurrency: { name: "GEN Token", symbol: "GEN", decimals: 18 },
  rpcUrls: [STUDIONET_RPC],
  blockExplorerUrls: ["https://explorer-studio.genlayer.com"],
};

/** Fixed V1 bond amounts, in atto (10^18 = 1 GEN) -- mirrors
 * FILING_BOND_ATOMS / CHALLENGE_BOND_ATOMS in contracts/protocol_court.py
 * exactly. No governance surface exists for these on-chain; this constant
 * must be kept in sync by hand if the contract is ever redeployed with
 * different amounts. */
export const FILING_BOND_ATTO = 5n * 10n ** 18n; // 5 GEN
export const CHALLENGE_BOND_ATTO = 1n * 10n ** 18n; // 1 GEN
