import Link from "next/link";
import { Panel, GoldSeal } from "@/components/Primitives";

export default function LandingPage() {
  return (
    <div className="flex flex-col gap-20">
      {/* Hero */}
      <section className="pt-8">
        <p className="pc-mono mb-4 text-[0.75rem] uppercase tracking-[0.14em]" style={{ color: "var(--pc-text-faint)" }}>
          Web3 needs somewhere to argue.
        </p>
        <h1 className="max-w-3xl text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
          Smart contracts verify execution.
          <br />
          <span style={{ color: "var(--pc-gold-bright)" }}>Protocol Court verifies meaning.</span>
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed" style={{ color: "var(--pc-text-muted)" }}>
          A protocol&rsquo;s code can prove a transaction executed correctly. It cannot prove
          the transaction was <em>consistent with what the protocol told its users it would
          do</em>. Protocol Court is the layer that answers that question — with frozen
          evidence, semantic adjudication, and permanent, citable precedent.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/protocols"
            className="pc-mono rounded-sm border px-5 py-2.5 text-[0.8125rem] uppercase tracking-[0.06em]"
            style={{ borderColor: "var(--pc-gold-dim)", color: "var(--pc-gold-bright)" }}
          >
            Browse protocols
          </Link>
          <Link
            href="/precedents"
            className="pc-mono rounded-sm border px-5 py-2.5 text-[0.8125rem] uppercase tracking-[0.06em]"
            style={{ borderColor: "var(--pc-border-strong)", color: "var(--pc-text-muted)" }}
          >
            Search precedent
          </Link>
        </div>
        <p className="pc-mono mt-4 text-[0.75rem]" style={{ color: "var(--pc-text-faint)" }}>
          No wallet required to read anything on this site.
        </p>
      </section>

      {/* The problem */}
      <section className="grid gap-10 sm:grid-cols-2">
        <div>
          <h2 className="text-xl font-semibold">Why semantic disputes exist</h2>
          <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--pc-text-muted)" }}>
            Protocols make commitments constantly — governance proposals, documentation,
            announcements, specifications — and those commitments drift, get superseded, and
            sometimes contradict each other over time. When someone asks &ldquo;was this
            action consistent with what the protocol said it would do?&rdquo;, there is
            today no neutral place to get a checkable answer. It gets litigated informally,
            in a Discord thread, and whoever posts last wins.
          </p>
        </div>
        <div>
          <h2 className="text-xl font-semibold">How evidence and precedent work</h2>
          <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--pc-text-muted)" }}>
            A Case binds a disputed action to one exact, sealed version of a protocol&rsquo;s
            commitment — never &ldquo;the current rules.&rdquo; Evidence is fetched and frozen
            before any judgment happens, so an inconclusive or challenged verdict can never
            destroy the record it reasoned over. Every settled Case becomes a Precedent later
            cases can cite — the output that matters is not one verdict, it is the growing
            body of precedent those verdicts leave behind.
          </p>
        </div>
      </section>

      {/* Pipeline */}
      <section>
        <h2 className="text-xl font-semibold">The pipeline</h2>
        <div className="pc-rail mt-6 flex flex-col gap-6">
          {[
            ["Protocol Commitment", "A protocol seals a specific version of a stated commitment."],
            ["Dispute Case", "A filer binds a disputed action to that exact sealed version."],
            ["Frozen Evidence", "Sources are fetched, fingerprinted, and locked before judgment."],
            ["Semantic Adjudication", "GenLayer validator consensus reasons over the frozen evidence."],
            ["Challenge", "A specific, named defect can be raised against the verdict — not a re-vote."],
            ["Final Precedent", "A settled Case becomes citable, permanent, searchable precedent."],
          ].map(([title, body]) => (
            <div key={title} className="pc-rail-node relative pl-2">
              <div className="text-sm font-semibold">{title}</div>
              <div className="mt-1 text-sm" style={{ color: "var(--pc-text-muted)" }}>
                {body}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Finality example */}
      <section>
        <Panel className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-semibold">A finalized Case looks like this</div>
            <p className="mt-1 text-sm" style={{ color: "var(--pc-text-muted)" }}>
              Every field below is real, checkable, and linked back to its own evidence trail —
              nothing on this site is summarized away.
            </p>
          </div>
          <GoldSeal>Finalized</GoldSeal>
        </Panel>
      </section>
    </div>
  );
}
