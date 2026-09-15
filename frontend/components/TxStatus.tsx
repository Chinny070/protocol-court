import type { TxSnapshot } from "@/hooks/useTxAction";

const UNDECIDED = new Set(["PENDING", "PROPOSING", "COMMITTING", "REVEALING", "APPEAL_REVEALING", "APPEAL_COMMITTING"]);

export function TxStatusLine({ snapshot }: { snapshot: TxSnapshot }) {
  if (snapshot.phase === "idle") return null;

  if (snapshot.phase === "signing") {
    return (
      <p className="pc-mono mt-2 text-[0.75rem]" style={{ color: "var(--pc-text-faint)" }}>
        Waiting for wallet signature…
      </p>
    );
  }

  if (snapshot.phase === "failed") {
    return (
      <p className="pc-mono mt-2 text-[0.75rem]" style={{ color: "var(--pc-red)" }}>
        {snapshot.error ?? "Failed."}
      </p>
    );
  }

  if (snapshot.phase === "pending" || (snapshot.phase === "settled" && snapshot.statusName && UNDECIDED.has(snapshot.statusName))) {
    return (
      <p className="pc-mono mt-2 text-[0.75rem]" style={{ color: "var(--pc-blue)" }}>
        Submitted — awaiting consensus… ({snapshot.hash?.slice(0, 10)}…)
      </p>
    );
  }

  if (snapshot.phase === "settled") {
    const isUndetermined = snapshot.statusName === "UNDETERMINED";
    const isFinal = snapshot.statusName === "FINALIZED" || snapshot.statusName === "ACCEPTED";
    return (
      <p
        className="pc-mono mt-2 text-[0.75rem]"
        style={{ color: isUndetermined ? "var(--pc-red)" : isFinal ? "var(--pc-green)" : "var(--pc-text-muted)" }}
      >
        {isUndetermined
          ? "Consensus Undetermined — validators disagreed, no state change committed. Safe to retry."
          : `${snapshot.statusName ?? "Unknown status"}${snapshot.resultName ? ` · ${snapshot.resultName}` : ""}`}
        {" — "}
        <span style={{ color: "var(--pc-text-faint)" }}>state re-read below reflects the real result, not this label.</span>
      </p>
    );
  }

  return null;
}
