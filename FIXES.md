# Stabilization Pass — 2026-08-20

A full sweep over the monorepo to get every CI gate green. Below is what was
broken, why, and what changed.

**Result — all gates pass:**

| Gate                                          | Before                | After              |
| --------------------------------------------- | --------------------- | ------------------ |
| `turbo test`                                  | 2 failing             | **1377 passing**   |
| `turbo build`                                 | failed (api + web)    | **3/3 successful** |
| `turbo lint`                                  | 1 warning             | **0 problems**     |
| `npm run format:check`                        | 176 files unformatted | **clean**          |
| `npm audit --omit=dev --audit-level=critical` | exit 1 (1 critical)   | **exit 0**         |

Test totals: `shared` 154 · `api` 830 · `web` 393.

---

## 1. Failing tests

### 1.1 `my-clients` controller test asserted a stale response shape

`apps/api/tests/modules/therapist-clients/therapist-clients.controller.spec.ts`

The test reused a bare `TherapistClient` fixture with no `client` relation, then
asserted the endpoint returned that object unchanged. The controller actually
flattens the row for the UI:

```ts
{ id: rel.clientId, name: rel.client.clientProfile?.name ?? null, email: rel.client.email }
```

The controller was right and the test was stale — confirmed on both sides:
`findByTherapist()` eager-loads the relation (`include: { client: { select: { email, clientProfile } } }`),
and `apps/web/src/app/therapist/clients/page.tsx` consumes `{ id, name, email }`.

**Fix:** added a `mockRelationshipWithClient` fixture carrying the relation, asserted
the flattened shape, and added a case covering a client with no profile yet
(`name: null`).

### 1.2 Root page test looked for text that is now an image

`apps/web/tests/unit/page.test.tsx`

The hero heading was replaced by a logo `<Image alt="TheraPulse">`, so
`getByText(/TheraPulse/i)` no longer matched.

**Fix:** assert the accessible name instead —
`getByRole('img', { name: /TheraPulse/i })` — which is a stronger check and matches
the WCAG requirements in CLAUDE.md. Also added coverage for the two CTA links and
the three "how it works" steps.

---

## 2. Build-blocking type errors

These never surfaced in tests because Vitest does not typecheck.

### 2.1 API — `readonly` array assigned to a mutable type (TS4104)

`apps/api/src/modules/worksheets/worksheet-assignments.controller.ts`

`PaginatedResult<T>.data` is `readonly T[]`, but `list()` declared
`ApiSuccessResponse<WorksheetAssignment[]>`.

The declared type was also **under-specified**: the service returns
`WorksheetAssignmentWithTemplate`, and the UI
(`apps/web/src/app/worksheet-assignments/page.tsx`) reads `assignment.template.title`
and `.type`. The signature was hiding a field the frontend depends on.

**Fix:** `Promise<ApiSuccessResponse<readonly WorksheetAssignmentWithTemplate[]> & { meta: PaginationMeta }>`
— honours immutability and states the real contract.

### 2.2 Web — `interface` extending a discriminated union (TS2312)

`apps/web/src/app/worksheet-templates/[id]/edit/page.tsx`

```ts
interface BuilderField extends WorksheetField {
  _key: string;
} // invalid
```

`WorksheetField` is a Zod discriminated union, and an interface cannot extend a
union. That single invalid declaration poisoned the type and cascaded into 10
further errors (`.label` / `.type` "does not exist", assignment failures).

**Fix:** an intersection, which distributes over the union and preserves the
`type` discriminant so per-variant narrowing still works:

```ts
type BuilderField = WorksheetField & { _key: string };
```

The `moveField` swap was also rewritten to satisfy `noUncheckedIndexedAccess`
without changing behaviour (explicit bounds check, then copy-and-assign).

### 2.3 Web — dashboards could render with null data

`apps/web/src/app/dashboard/{therapist,client,admin}/page.tsx`

The therapist dashboard dereferenced `stats` after the loading/error guards, but
`stats` can still be `null` there. The client and admin dashboards had the _same_
hole, papered over with `!` non-null assertions — a latent runtime crash rather
than a compile error.

**Fix:** a real `if (!stats)` / `if (!progress)` guard rendering an error state in
all three, and the `!` assertions removed.

### 2.4 Web — unchecked index access

`apps/web/src/app/worksheet-submissions/history/page.tsx`

`points[0].score` is `ScorePoint | undefined` under `noUncheckedIndexedAccess`;
TypeScript cannot narrow it from a `.length` check.

**Fix:** `const [only] = points;` then branch on `only` — behaviourally identical.

---

## 3. Prerender failure — `useSearchParams` without Suspense

`apps/web/src/app/auth/2fa/page.tsx`, `apps/web/src/app/directory/page.tsx`

`next build` aborted:

```
useSearchParams() should be wrapped in a suspense boundary at page "/auth/2fa"
```

`useSearchParams()` opts a subtree into client-side rendering, so App Router
requires a Suspense boundary above it to prerender the route. **Both** pages had
this; the build merely stopped at the first.

**Fix:** the page body moved into an inner component (`TwoFaForm`,
`DirectoryBrowser`) and the default export wraps it in `<Suspense>` with a spinner
fallback. All 45 routes now generate.

---

## 4. TypeScript configuration

### 4.1 jest-dom matchers were missing from the TS program (377 phantom errors)

`apps/web/tsconfig.json`, `apps/web/vitest.setup.ts`

`types: ["node"]` restricted ambient types, and `vitest.setup.ts` — the file that
imports the matchers — was in the tsconfig `exclude` list. So
`toBeInTheDocument`, `toHaveAttribute` etc. were unknown on every assertion:
**377 of 423 web type errors came from this one gap.**

**Fix:** `types: ["node", "@testing-library/jest-dom/vitest"]`, and the setup import
switched to the `/vitest` subpath, which is the entry that augments Vitest's
`Assertion` interface.

### 4.2 API `rootDir` conflicted with its own `include` (63 phantom errors)

`apps/api/tsconfig.json`, `apps/api/tsconfig.build.json`

`tsconfig.json` set `rootDir: ./src` while including `tests/**/*`, so every test
file raised TS6059 (`not under rootDir`) in the IDE and in `tsc --noEmit`.

**Fix:** `rootDir` moved to `tsconfig.build.json`, where emit actually happens.
`dist/` stays flat, so `node dist/main` is unchanged.

### 4.3 Cross-workspace deep import

`apps/api/tests/performance/performance.spec.ts` imported
`../../../../packages/shared/src/schemas/pagination.schema` — reaching into another
workspace's source and dragging it into the API's program.

**Fix:** import from the package entry, `@therapulse/shared`. Both symbols are
public exports.

---

## 5. Lint

`apps/api/src/modules/worksheets/worksheet-templates.service.ts`

`WorksheetType` was a value import used only in type position. This is _not_ the
NestJS DI-token false positive documented in CLAUDE.md — `UserRole` in the same
statement is a genuine value use (`UserRole.CLIENT`), `WorksheetType` is not.

**Fix:** `import { UserRole, type WorksheetType, type WorksheetTemplate }`.

---

## 6. Formatting — CI's `format:check` job would have failed

176 files did not match Prettier, including files untouched by this pass
(`PLAN.md`, `packages/shared/src/constants/enums.ts`). Since CI runs
`npm run format:check`, the lint job was failing regardless of code quality.

**Fix:** `prettier --write .` across the repo; full suite re-run afterwards to
confirm nothing broke.

---

## 7. Security — CRITICAL advisory cleared

`apps/api` pinned `bcrypt@5.1.1`, which depends on `@mapbox/node-pre-gyp` →
`tar <=7.5.20`: **node-tar arbitrary file creation/overwrite via hardlink path
traversal (CRITICAL)**. CI gates at `--audit-level=critical`, so the audit job
was failing.

The root workspace already declared `bcrypt@6.0.0`; only `apps/api` lagged, and a
stale nested `node_modules` copy plus stale `package-lock.json` entries kept
resolving 5.1.1.

**Fix:** bumped `bcrypt` and `@types/bcrypt` to `6.0.0` in `apps/api`, cleared the
stale lockfile entries, and reinstalled. bcrypt 6 drops `node-pre-gyp` entirely —
**36 packages removed**, whole vulnerable chain gone.

API surface is unchanged (only `hash`/`compare` are used). Verified end to end:

```
bcrypt6 hash ok, prefix: $2b$12$   (cost factor 12, as required)
compare match: true    compare mismatch: false
```

`npm audit --omit=dev --audit-level=critical` now exits 0. **10 HIGH advisories
remain** — see Known Issues.

---

## 8. Repository hygiene

### 8.1 Migrations were gitignored — including the RLS policies

`.gitignore` contained `apps/api/prisma/migrations/`. This directly contradicts
CLAUDE.md ("Every schema change requires a migration / Migrations are
version-controlled") and, more seriously, excluded
`20260328000001_rls_policies/migration.sql` — the Row-Level Security policies that
are the defence-in-depth layer for all clinical tables. A fresh deploy from this
repo would have had **no RLS**.

**Fix:** the ignore rule is removed and replaced with a comment explaining why
migrations stay tracked. Migrations were checked for secrets before being staged —
clean (the only `secret` match is the `totp_secret` column name).

### 8.2 Build artifact would have been committed

**Fix:** added `*.tsbuildinfo` (catches `apps/web/tsconfig.tsbuildinfo`).

`apps/api/.env` holds real secrets and is correctly ignored — verified it is not
staged.

---

## 9. Health endpoint returned 401 — found by actually running `npm run dev`

`apps/api/src/app.controller.ts`

`JwtAuthGuard` is registered globally via `APP_GUARD`, and `@Get('health')` was
missing `@Public()`. A live probe against the running dev server:

```
GET http://localhost:3001/api/health
{"success":false,"error":{"code":"UNAUTHORIZED","message":"Missing auth token"}}   HTTP 401
```

This is a deployment blocker, not a cosmetic issue. Two things require an
unauthenticated `200` from that exact path:

- `apps/api/Dockerfile` — `HEALTHCHECK ... wget -qO- http://localhost:3001/api/health`.
  A permanently failing healthcheck means the orchestrator marks the container
  unhealthy and restarts it forever.
- `.github/workflows/deploy.yml` — the post-deploy gate fails the deployment
  unless the status is exactly `200`.

No test covered it, so the whole suite stayed green while the endpoint was
unreachable.

**Fix (TDD):** added a failing test asserting the handler carries `IS_PUBLIC_KEY`
metadata, then added `@Public()` with a comment explaining why it must stay.
Verified live against the running server:

```
GET http://localhost:3001/api/health
{"status":"ok","timestamp":"2026-08-21T19:02:34.653Z"}   HTTP 200
```

Also smoke-tested the full stack end to end — web → BFF → API → Postgres returns
seeded directory data (`HTTP 200`), and `/`, `/auth/login`, `/directory` all render.

---

## Known issues (not fixed, nothing is blocked)

1. **234 type errors in test files** — `apps/api` 194, `apps/web` 40; `packages/shared` is
   clean. All come from strict flags meeting partial mocks:
   `exactOptionalPropertyTypes` on mock `Request` objects (88), and
   `noUncheckedIndexedAccess` on `mock.calls[0]` / `getAllByRole()[0]` (~67), across
   ~40 files. These block **nothing** — `next build` and `nest build` typecheck only
   `src`, and CI has no typecheck step — but they are IDE noise. In `apps/api` they
   were previously masked by the TS6059 config bug fixed in §4.2. Options: fix the
   sites (a shared `makeAuthedRequest()` test helper would clear the 88 in one go),
   or relax those two flags for test files only.

2. **10 HIGH npm advisories** remain (`next`, `@nestjs/core`, `@nestjs/platform-express`,
   `@nestjs/config`, `lodash`, `multer`, `path-to-regexp`, `postcss`, `sharp`,
   `brace-expansion`). PLAN.md's TP-003 note already records the decision to gate at
   `critical` for this reason. All have non-major fixes available
   (`next@15.5.23`, `@nestjs/core@11.2.1`, `@nestjs/config@4.0.4`), so a dependency
   bump could raise the gate back to `--audit-level=high` — worth its own verification
   pass rather than folding into this one.

3. **The web container's healthcheck can fail the same way, by configuration.**
   `apps/web/src/app/api/health/route.ts` returns `500 CONFIG_ERROR` when `API_URL`
   is unset — deliberate, and pinned by a test — but every one of the other 30 BFF
   routes falls back to `http://localhost:3001`, and `apps/web/Dockerfile` never
   sets `API_URL` while its `HEALTHCHECK` probes that route. So a web container
   started without an explicit `API_URL` is permanently unhealthy. Left as-is
   because the strict behaviour is intentional; the deployment must supply
   `API_URL`, or the Dockerfile should default it.

4. **`package.json#prisma` config key is deprecated** and will be removed in Prisma 7 —
   migrate to `prisma.config.ts`.
