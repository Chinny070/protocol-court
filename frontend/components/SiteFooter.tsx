import { PROTOCOL_COURT_ADDRESS } from "@/lib/genlayer/config";

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t" style={{ borderColor: "var(--pc-border)" }}>
      <div className="mx-auto max-w-6xl px-6 py-8 text-[0.75rem]" style={{ color: "var(--pc-text-faint)" }}>
        <p className="pc-mono">
          Reading from GenLayer StudioNet contract{" "}
          <span style={{ color: "var(--pc-text-muted)" }}>{PROTOCOL_COURT_ADDRESS}</span> — a verified
          test instance. Not a production deployment.
        </p>
        <p className="mt-2">
          Protocol Court is not legal arbitration and does not issue legal advice. It records
          evidence-backed interpretations of publicly stated protocol commitments.
        </p>
      </div>
    </footer>
  );
}
