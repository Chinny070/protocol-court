# PROTOCOL COURT — Stage 3 Frontend Report

Status: **frontend built, verified live against the deployed test contract, not deployed
to any hosting.** No contract file was modified to produce this stage.

---

## 1. Selected DESIGN.md template and reasoning

**Selected: HashiCorp** (enterprise-clean, black-and-white, infrastructure automation),
adapted per `docs/STAGE_3_DESIGN_SELECTION.md`.

Two sources had to be reconciled: the new Stage 3 brief (trust, authority, technical
sophistication, Web3 infrastructure feel) and the original Product Specification's own
committed design direction ("The Court of the Internet" — obsidian backgrounds, gold
verdict seals, blockchain explorer + Supreme Court archive + AI research terminal).
HashiCorp is the DESIGN.md entry that satisfies both: its dark, restrained, black-and-
white infrastructure aesthetic is the closest match in the collection to "obsidian" and to
"developer infrastructure," and its category — the plumbing other systems rely on — maps
onto Protocol Court's own self-conception as a trust layer other protocols and users rely
on. It was adapted, not cloned: a single warm gold accent (absent from HashiCorp's own
palette) was added and reserved exclusively for finality/authority moments — a
`FINALIZED` case, a settled Precedent, a sealed Commitment — so it reads as earned, never
decorative. See the design doc for the full comparison against WIRED, Vercel, and
Coinbase, and the principle-by-principle adaptation table.

## 2. Frontend architecture

- **Stack**: Next.js 16 (App Router) + React 19 + TypeScript (strict) + Tailwind v4 +
  `genlayer-js` ^1.1.8 — the same stack already proven working in this workspace's
  AgentCourt project, reused deliberately to avoid introducing new, unverified tooling
  risk.
- **No backend, no database, no external APIs, no server infrastructure of our own.**
  Every page that reads data is a Client Component that calls `genlayer-js`'s
  `readContract` directly from the browser against the deployed Intelligent Contract — no
  Next.js API route, no server action, no proxy. The only "server" involved is `next dev`
  / `next build`'s own static asset serving, identical in kind to any static site host.
- **`lib/genlayer/config.ts`** — the contract address, chain config, and fixed bond
  amounts (mirrored from the contract's own `FILING_BOND_ATOMS` / `CHALLENGE_BOND_ATOMS`
  constants).
- **`lib/genlayer/types.ts`** — TypeScript interfaces mirroring every `to_dict()` shape in
  `contracts/protocol_court.py` exactly, field-for-field, snake_case preserved. Bond-
  amount fields are typed `bigint`, not `number` — u256 atto amounts routinely exceed
  `Number.MAX_SAFE_INTEGER`.
- **`lib/genlayer/contract.ts`** — one typed wrapper function per contract method actually
  used by the UI (27 read methods, 12 write methods). Verified against the contract's own
  Python source, not guessed.
- **`lib/wallet/WalletProvider.tsx`** — MetaMask (or compatible) connection, StudioNet
  chain add/switch, address checksum normalization (wallets return lowercase addresses;
  the contract stores checksummed addresses — a mismatch here would silently break
  address-keyed lookups).
- **`hooks/useContractRead.ts`** — a small fetch-on-mount hook used by every page.
- **`hooks/useTxAction.ts`** — the required write-transaction discipline, in one place: a
  write call's return value (a bare hash) is never trusted as proof of anything; the hook
  waits for a real status, then independently re-reads the transaction's own authoritative
  `statusName`/`resultName` record, and — regardless of what that says, including
  `UNDETERMINED` or a timeout — always triggers a full re-read of contract state rather
  than an optimistic UI update.

## 3. Pages created

| Route | Purpose |
|---|---|
| `/` | Landing — the trust problem, the pipeline, no wallet required |
| `/protocols` | Protocol Explorer — every registered protocol |
| `/protocols/[protocolId]` | Protocol identity + full commitment version timeline |
| `/commitments/[commitmentId]` | Commitment detail — clauses + precedent under it |
| `/clauses/[clauseId]` | Clause text + full case history against it |
| `/cases` | All dispute cases, any lifecycle state |
| `/cases/[caseId]` | The courtroom page — claim, evidence, timeline, verdict, challenges, actions |
| `/evidence/[evidenceId]` | Evidence viewer — source, fingerprint, frozen excerpt |
| `/precedents` | Precedent Explorer — search by topic tag |
| `/precedents/[precedentId]` | Single precedent — result, rationale, links back to its case |

Every browsing page works with **no wallet connected**. Wallet-gated actions (submit
evidence, freeze evidence, adjudicate, open/resolve a challenge, finalize a case) appear
only on the case courtroom page, only when the connected account is eligible and the
case's lifecycle state allows that action.

## 4. Contract methods integrated

**Reads (27)**: `get_protocol`, `get_protocol_count`, `get_commitment_ids_for_protocol`,
`get_commitment`, `get_clause_count`, `get_clause`, `get_clause_by_ordinal` (wrapper
present, not yet used by a page), `get_clauses_page`, `get_case`, `get_case_count`,
`get_case_ids_page`, `get_case_ids_for_protocol` (wrapper present, not yet used by a page),
`get_case_ids_for_clause`, `get_evidence`, `get_evidence_ids_for_case` (wrapper present),
`get_verdict`, `get_current_verdict_for_case` (wrapper present), `get_challenge`,
`get_challenge_ids_for_case` (wrapper present), `get_precedent`,
`get_precedent_ids_for_protocol` (wrapper present), `get_precedent_ids_for_commitment`,
`get_precedent_ids_by_topic_tag`, `get_filing_bond_amount`, `get_challenge_bond_amount`,
`get_pool_address`, `get_total_forfeited_to_pool`, `get_balance`.

**Writes (12)**: `create_protocol`, `create_commitment`, `seal_commitment`,
`mark_commitment_superseded`, `add_clause` (wrappers present for protocol/commitment/
clause authoring, not yet exposed in a page's UI — see Remaining Limitations), `file_case`
(wrapper present, not yet exposed in a page's UI), `submit_evidence`, `freeze_evidence`,
`adjudicate`, `open_challenge`, `resolve_challenge`, `finalize_case`.

## 5. Tests / checks passed

- `npm run typecheck` (`tsc --noEmit`, strict mode): **0 errors**.
- `npm run lint` (ESLint, Next core-web-vitals + TypeScript config): **clean, exit 0**.
- `npm run build` (`next build`, Turbopack, production): **succeeded**, all 11 routes
  compiled (6 static, 5 dynamic).
- **Live smoke test** (not a unit test — a real browser session against the real deployed
  contract on StudioNet): navigated `/protocols`, `/protocols/protocol-1`,
  `/cases/case-1`, `/precedents/precedent-1`, and `/evidence/evidence-1`. Every field
  rendered matched the real, previously-recorded live transaction data exactly — creator
  address, commitment status, the full 3-challenge history with their real arguments and
  `REJECTED` outcomes, the verdict rationale text, the evidence fingerprint, and the frozen
  HTML excerpt from `https://example.org`. One transient "failed to fetch" RPC error was
  observed and resolved itself on retry — noted here rather than hidden, since it is
  exactly the kind of thing `useContractRead`'s error state exists to surface to a user
  rather than fail silently.

## 6. Build result

```
Route (app)
┌ ○ /
├ ○ /_not-found
├ ○ /cases
├ ƒ /cases/[caseId]
├ ƒ /clauses/[clauseId]
├ ƒ /commitments/[commitmentId]
├ ƒ /evidence/[evidenceId]
├ ○ /precedents
├ ƒ /precedents/[precedentId]
├ ○ /protocols
└ ƒ /protocols/[protocolId]

○  (Static)   prerendered as static content
ƒ  (Dynamic)  server-rendered on demand
```

## 7. Files changed

- `frontend/` — new Next.js app (config, `app/`, `components/`, `hooks/`, `lib/`), 32
  files.
- `docs/STAGE_3_DESIGN_SELECTION.md` — new.
- `docs/STAGE_3_FRONTEND_REPORT.md` — new (this file).

No file under `contracts/` or `tests/` was touched.

**Commit**: `3d72b29` — "feat: add Protocol Court Explorer frontend (Stage 3)"

## 8. Remaining limitations, stated plainly

- **Filing a new Case and authoring Protocol/Commitment/Clause content have no UI form
  yet.** The typed wrapper functions exist in `lib/genlayer/contract.ts` and are exercised
  by the same discipline as every other write, but no page currently renders a form for
  them — everything browsable in this build was authored via the direct contract calls
  already verified in Stage 2.3, not through this frontend. Adding those forms is
  straightforward follow-on work, intentionally not rushed into this pass.
- **No automated frontend test suite** (e.g. Playwright/Vitest) was added — verification
  here was typecheck + lint + build + a real live browser smoke test, not unit/integration
  tests. Worth adding before any wider release.
- **Still pointed at the Stage 2.3 StudioNet test contract**, not a production deployment
  — `lib/genlayer/config.ts` isolates this to one constant for when that changes.
- **Not deployed anywhere.** This report is a build-and-verify artifact, not a release.

## Final checks

- [x] No backend added.
- [x] No unnecessary dependencies (stack matches the already-proven AgentCourt baseline).
- [x] No generated artifacts committed (`node_modules/`, `.next/` excluded via
      `frontend/.gitignore`).
- [x] No contract modifications.
- [x] Not deployed.

**Stopping here for review, as instructed.**
