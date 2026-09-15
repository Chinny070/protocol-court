# Protocol Court Explorer

Frontend-only Next.js/TypeScript app for Protocol Court. No backend, no database, no
server infrastructure of our own — every read and write talks directly to the deployed
GenLayer Intelligent Contract via `genlayer-js`.

See `../docs/STAGE_3_DESIGN_SELECTION.md` for the selected design template and rationale,
and `../docs/STAGE_3_FRONTEND_REPORT.md` for the full build report.

## Develop

```bash
npm install
npm run dev
```

## Verify

```bash
npm run typecheck
npm run lint
npm run build
```

## Contract

Currently pointed at the verified Stage 2.3 StudioNet **test** instance (see
`lib/genlayer/config.ts`). Not a production deployment.
