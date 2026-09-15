"use client";

import { useEffect, useState } from "react";

type ReadState<T> =
  | { status: "loading"; data: null; error: null }
  | { status: "error"; data: null; error: string }
  | { status: "ready"; data: T; error: null };

/**
 * Fetches from the deployed Intelligent Contract directly in the browser
 * (via the functions in lib/genlayer/contract.ts, which use the read-only
 * genlayer-js client) -- no server, no API route, no caching layer of our
 * own. Re-runs whenever `deps` changes.
 */
export function useContractRead<T>(
  fetcher: () => Promise<T>,
  deps: unknown[],
): ReadState<T> {
  const [state, setState] = useState<ReadState<T>>({ status: "loading", data: null, error: null });

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading", data: null, error: null });
    fetcher()
      .then((data) => {
        if (!cancelled) setState({ status: "ready", data, error: null });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setState({
            status: "error",
            data: null,
            error: err instanceof Error ? err.message : "Failed to read from the contract.",
          });
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return state;
}
