"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { createClient, chains } from "genlayer-js";
import type { Address } from "genlayer-js/types";
import { getAddress } from "viem";
import { STUDIONET_CHAIN_ID_HEX, STUDIONET_WALLET_PARAMS } from "@/lib/genlayer/config";

/** MetaMask returns addresses all-lowercase, but the contract stores
 * addresses checksummed (GenVM's `sender_address.as_hex`). Normalize once,
 * here, so nothing downstream has to think about it. */
function normalizeAddress(raw: string | undefined | null): Address | null {
  if (!raw) return null;
  try {
    return getAddress(raw) as Address;
  } catch {
    return null;
  }
}

type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
};

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

type WalletState = {
  address: Address | null;
  chainId: string | null;
  connecting: boolean;
  error: string | null;
  hasProvider: boolean;
  /** A GenLayer client bound to the connected wallet -- null until connected.
   * Browsing (every read in this app) never needs this; only actions do. */
  client: ReturnType<typeof createClient> | null;
  connect: () => Promise<void>;
  disconnect: () => void;
};

const WalletContext = createContext<WalletState | null>(null);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = useState<Address | null>(null);
  const [chainId, setChainId] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasProvider, setHasProvider] = useState(
    () => typeof window !== "undefined" && !!window.ethereum,
  );

  useEffect(() => {
    // window.ethereum is often injected by the wallet extension a tick after
    // this component's first render, so the synchronous check above can miss
    // it. Poll briefly for it rather than locking hasProvider to false forever.
    if (hasProvider) return;
    let attempts = 0;
    const id = setInterval(() => {
      attempts += 1;
      if (window.ethereum) {
        setHasProvider(true);
        clearInterval(id);
      } else if (attempts >= 20) {
        clearInterval(id);
      }
    }, 100);
    return () => clearInterval(id);
  }, [hasProvider]);

  const ensureStudioNetChain = useCallback(async () => {
    const eth = window.ethereum;
    if (!eth) return;
    try {
      await eth.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: STUDIONET_CHAIN_ID_HEX }],
      });
    } catch (switchErr) {
      const code =
        typeof switchErr === "object" && switchErr && "code" in switchErr
          ? (switchErr as { code?: number }).code
          : undefined;
      if (code === 4902) {
        await eth.request({
          method: "wallet_addEthereumChain",
          params: [STUDIONET_WALLET_PARAMS],
        });
      } else {
        throw switchErr;
      }
    }
  }, []);

  const connect = useCallback(async () => {
    const eth = window.ethereum;
    if (!eth) {
      setError("No wallet found. Install MetaMask (or a compatible wallet) to continue.");
      return;
    }
    setConnecting(true);
    setError(null);
    try {
      const accounts = (await eth.request({ method: "eth_requestAccounts" })) as string[];
      if (!accounts?.[0]) throw new Error("No account returned by wallet.");
      await ensureStudioNetChain();
      const cid = (await eth.request({ method: "eth_chainId" })) as string;
      setAddress(normalizeAddress(accounts[0]));
      setChainId(cid);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to connect wallet.");
    } finally {
      setConnecting(false);
    }
  }, [ensureStudioNetChain]);

  const disconnect = useCallback(() => {
    setAddress(null);
    setChainId(null);
  }, []);

  useEffect(() => {
    const eth = window.ethereum;
    if (!eth?.on) return;
    const onAccountsChanged = (...args: unknown[]) => {
      const accounts = args[0] as string[];
      setAddress(normalizeAddress(accounts?.[0]));
    };
    const onChainChanged = (...args: unknown[]) => {
      setChainId(args[0] as string);
    };
    eth.on("accountsChanged", onAccountsChanged);
    eth.on("chainChanged", onChainChanged);
    return () => {
      eth.removeListener?.("accountsChanged", onAccountsChanged);
      eth.removeListener?.("chainChanged", onChainChanged);
    };
  }, []);

  const client = useMemo(() => {
    if (!address || typeof window === "undefined" || !window.ethereum) return null;
    return createClient({
      chain: chains.studionet,
      account: address,
      provider: window.ethereum,
    });
  }, [address]);

  const value: WalletState = {
    address,
    chainId,
    connecting,
    error,
    hasProvider,
    client,
    connect,
    disconnect,
  };

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used within WalletProvider");
  return ctx;
}

export function isWrongChain(chainId: string | null) {
  return chainId !== null && chainId.toLowerCase() !== STUDIONET_CHAIN_ID_HEX;
}
