# PROTOCOL COURT — Stage 3 Design Selection

## 1. Selected template

**HashiCorp**, from the getdesign.md DESIGN.md collection — described there as
"Enterprise-clean" with a "Black and white" palette, built for "Infrastructure
automation."

## 2. Why it fits Protocol Court

Two sources had to be reconciled before picking a template:

- The **new Stage 3 brief** asks for a feel that reads as trust, authority, technical
  sophistication, research/exploration, and Web3 infrastructure — explicitly naming
  "developer infrastructure" as one of the inspirations to draw from.
- The **original Stage 1 Product Specification** (source of truth for this project since
  its first document) already committed to a design direction: *"The Court of the
  Internet"* — "obsidian backgrounds, evidence trails, gold verdict seals, holographic
  timelines, precedent graphs... a mixture of: blockchain explorer + Supreme Court archive
  + AI research terminal."

HashiCorp is the DESIGN.md entry that satisfies both at once. Its enterprise-clean,
black-and-white infrastructure aesthetic is built for exactly the audience Protocol Court
needs to read as credible to — people evaluating trust and process in technical systems,
not consumers being sold something. Its dark, restrained surfaces are a close, honest match
for "obsidian backgrounds," and its category (infrastructure automation) is the closest
DESIGN.md analogue to "blockchain explorer + developer infrastructure" of anything in the
collection. What it does *not* supply on its own is "gold verdict seals" or "Supreme Court
archive" gravitas — HashiCorp's own accent colors run toward purple/green, tuned for a
DevOps product, not a court record. That gap is closed by deliberate adaptation, not by
picking a different template wholesale (see below).

Templates considered and set aside:
- **WIRED** ("paper-white broadsheet density, ink-blue") — the closest match for
  "editorial investigation interfaces" and dense, reading-optimized long-form text, but
  its light, newsprint-toned palette directly contradicts the Product Spec's committed
  "obsidian backgrounds" direction. Its *typographic density and citation conventions*
  were still worth borrowing — see the adaptation notes below.
- **Vercel** ("black and white precision, Geist font") — an extremely strong
  technical-trust black/white system, and the runner-up. Passed over in favor of
  HashiCorp specifically because HashiCorp's *category* (infrastructure automation, i.e.
  the plumbing other systems rely on) maps onto Protocol Court's own self-conception —
  a trust layer other protocols and users rely on — more directly than Vercel's
  deployment-tooling category does.
- **Coinbase** ("trust-focused, institutional, clean blue") — strong on institutional
  trust, but its light, consumer-fintech polish reads as a product asking to be trusted
  with money, not a record asking to be independently checked. Protocol Court's whole
  point is the opposite posture: show the evidence, don't ask for faith.

## 3. Design principles adapted, and how

| Principle | Source | How it's applied |
|---|---|---|
| Dark, restrained enterprise surfaces | HashiCorp | Root background is a true near-black ("obsidian"), never pure `#000`, with layered dark panels for cards/sections rather than a single flat plane — gives depth without ornament. |
| Black-and-white-first, color used sparingly and with intent | HashiCorp | Body text, structure, and navigation are monochrome (off-white on obsidian). Color is reserved for state — never decoration. |
| A single institutional accent used for the moments that matter most | Adapted from HashiCorp's restraint, recolored per the Product Spec's "gold verdict seals" | A warm gold/amber is the *only* saturated accent in the system, deployed exclusively for finality and authority: `FINALIZED` status, a settled `Precedent` card, a sealed `Commitment`. Every other state (open, pending, disputed) stays in cooler, quieter tones, so gold reads as *earned*, not decorative. |
| Dense, reading-optimized citation typography | WIRED | Evidence excerpts, rationale text, and clause text use a slightly tighter measure and a monospace treatment for anything that is effectively an on-chain citation (hashes, fingerprints, addresses, tx-shaped IDs) — reinforcing that this is a record being examined, not marketing copy. |
| "Blockchain explorer + AI research terminal" texture | Product Spec, expressed via HashiCorp's infra-tool conventions | Structural elements borrow explorer/terminal conventions: monospace IDs, a persistent status-pill vocabulary (`FILED` / `EVIDENCE_FROZEN` / `CHALLENGE_WINDOW` / `FINALIZED` / `MISFILED`), and timeline rails for Commitment versions and Case lifecycles rendered as vertical evidence trails, not carousels or cards-in-a-grid. |

## 4. What this explicitly avoids

- No gradients-as-decoration, no glassmorphism, no marketing-site hero animation —
  Protocol Court is not selling a feeling, it is presenting a record.
- No generic "crypto dashboard" grid-of-stat-tiles homepage. The landing page leads with
  the trust problem in prose, not a token price ticker.
- Gold is never used as a generic brand color (button fills, link color, etc.) — only as
  the seal-of-finality signal described above. Overusing it would cheapen the one place it
  is supposed to mean something.
