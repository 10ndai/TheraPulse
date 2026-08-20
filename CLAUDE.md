# TheraPulse — Development Rules

> Mental health platform digitizing therapy workflows for Zimbabwean therapists and clients.
> **Security is the #1 priority.** This app handles heavily regulated mental health data.

---

## Project Overview

TheraPulse replaces pen-and-paper therapy tools (worksheets, assessments, session notes, progress tracking) with secure digital equivalents, enabling care continuity across borders for Zimbabwean clients in the diaspora.

**MVP targets:** 10+ therapists, 50+ clients, 100+ digital worksheet completions.

---

## Tech Stack

| Layer       | Technology                               |
| ----------- | ---------------------------------------- |
| Frontend    | Next.js 15 (App Router) + TypeScript     |
| UI          | shadcn/ui + Tailwind CSS + Radix UI      |
| Backend API | NestJS + TypeScript                      |
| Database    | PostgreSQL + Prisma ORM                  |
| Auth        | Custom JWT (access + refresh) + TOTP 2FA |
| Validation  | Zod (shared package)                     |
| Testing     | Vitest + Testing Library + Playwright    |
| Monorepo    | Turborepo                                |
| CI/CD       | GitHub Actions + Semgrep + npm audit     |

---

## Monorepo Structure

```
TheraPulse/
├── apps/
│   ├── web/          # Next.js 15 frontend
│   └── api/          # NestJS backend API
├── packages/
│   └── shared/       # Zod schemas, types, constants, utilities
├── turbo.json
├── package.json
└── CLAUDE.md
```

---

## Development Workflow (MANDATORY)

### TDD — Red, Green, Refactor

Every feature MUST follow this cycle:

1. **RED** — Write the test first. It MUST fail.
2. **GREEN** — Write the minimal implementation to pass the test.
3. **REFACTOR** — Clean up while keeping tests green.
4. **VERIFY** — Run the full test suite. Check coverage >= 80%.
5. **LOOP** — If any criteria not met, fix and repeat.

```bash
turbo test              # Unit + integration tests (Vitest)
turbo test:e2e          # E2E tests (Playwright)
turbo test -- --coverage # Coverage report
```

### Agent Workflow

For every major feature:

1. **Plan** — Use planner agent to design the approach
2. **Devils Advocate** — Deploy a second agent to challenge the solution and find flaws
3. **Implement** — Follow TDD cycle above
4. **Code Review** — Use code-reviewer agent immediately after writing code
5. **Security Review** — Use security-reviewer agent before committing
6. **Iterate** — Fix all CRITICAL and HIGH issues. Loop until perfect.

### Coverage Requirements

- **Minimum:** 80% across branches, functions, lines, statements
- **Critical paths (auth, encryption, RLS):** 90%+
- **Error handling:** 100%

---

## Architecture Principles

### SOLID + Liskov Substitution

- **Single Responsibility:** One module, one reason to change
- **Open/Closed:** Extend via interfaces, not modification
- **Liskov Substitution:** Subtypes MUST be substitutable for their base types. Every repository implementation must honor the BaseRepository contract. Every guard must honor the CanActivate interface.
- **Interface Segregation:** Small, focused interfaces over fat ones
- **Dependency Inversion:** Depend on abstractions. Services depend on repository interfaces, not Prisma directly.

### Immutability (CRITICAL)

NEVER mutate existing objects. ALWAYS return new copies:

```typescript
// WRONG
user.status = 'ACTIVE';
await this.repo.save(user);

// CORRECT
const updatedUser = await this.repo.update(user.id, { status: 'ACTIVE' });
```

Clinical data immutability rules:

- `worksheet_submissions`: Immutable after `finalized_at` is set. No updates allowed.
- `audit_logs`: Append-only. No UPDATE or DELETE operations ever.
- `session_notes`: Finalized notes cannot be edited. New version required.

### Repository Pattern

All data access goes through repositories:

```typescript
// Base interface — all repositories implement this
interface BaseRepository<T> {
  findAll(options: PaginationOptions): Promise<PaginatedResult<T>>;
  findById(id: string): Promise<T | null>;
  create(data: CreateInput<T>): Promise<T>;
  update(id: string, data: UpdateInput<T>): Promise<T>;
  softDelete(id: string): Promise<void>;
}
```

### API Response Envelope

All API responses use a consistent format:

```typescript
// Success
{ success: true, data: T, meta?: PaginationMeta }

// Error
{ success: false, error: { code: string, message: string, details?: unknown } }
```

---

## Security Rules (NON-NEGOTIABLE)

### Encryption

- **At rest:** AES-256-GCM field-level encryption on ALL clinical data
- **In transit:** HTTPS only, TLS 1.3, HSTS headers
- **Encrypted fields:** session note text fields, worksheet responses, phone numbers, date of birth, emergency contacts, TOTP secrets
- **Key management:** Encryption key from environment variable, support key rotation

### Authentication

- **Passwords:** bcrypt with cost factor 12, minimum 12 chars, 1 upper, 1 lower, 1 number, 1 special
- **Access tokens:** JWT, 15-minute expiry
- **Refresh tokens:** 7-day expiry, stored as bcrypt hash, single-use with rotation
- **2FA:** TOTP mandatory for therapists, 8 single-use backup codes
- **Rate limiting:** 5 failed login attempts per email per 15 minutes

### Authorization

- **Role-based:** ADMIN, THERAPIST, CLIENT
- **Row-Level Security:** PostgreSQL RLS on all clinical tables — defense-in-depth beyond application guards
- **Therapist isolation:** Therapist can ONLY access their own clients' data
- **Client isolation:** Client can ONLY see their own data
- **Audit logs:** No role can UPDATE or DELETE audit entries

### Security Headers (via Helmet)

```
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Strict-Transport-Security: max-age=31536000; includeSubDomains
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), microphone=(), camera=()
Cache-Control: no-store (on all authenticated responses)
```

### Input Validation

- Validate ALL inputs at API boundaries using Zod schemas from `packages/shared`
- Prisma parameterized queries prevent SQL injection
- React auto-escaping + server-side sanitization prevent XSS
- Never trust client-side data — re-validate server-side

### What NEVER Goes in Code

- API keys, secrets, passwords, tokens
- Encryption keys
- Database connection strings
- Any PII or PHI in logs, error messages, or comments

---

## Database Rules

### Prisma Schema Location

`apps/api/prisma/schema.prisma`

### Commands

```bash
cd apps/api
npx prisma migrate dev --name <migration_name>   # Create migration
npx prisma db seed                                  # Seed test data
npx prisma generate                                 # Regenerate client
npx prisma studio                                   # Visual DB browser
```

### Migration Rules

- Every schema change requires a migration
- Migrations are version-controlled
- Never edit a migration after it has been applied
- Test migrations against a clean database before merging

### Audit Logging

Every data mutation MUST create an audit log entry containing:

- `actor_id` — who performed the action
- `action` — what they did (e.g., `user.login`, `worksheet.submit`, `note.finalize`)
- `resource_type` + `resource_id` — what was affected
- `ip_address` + `user_agent` — request context
- `details` — contextual data (changed fields for non-sensitive data)

---

## Frontend Rules

### Component Patterns

- Use shadcn/ui components as the base — customize in `components/ui/`
- Form handling: react-hook-form + Zod schemas from `packages/shared`
- Data fetching: Server Components where possible, client-side fetch for interactive data
- Charts: Recharts for progress dashboards
- Tables: TanStack React Table for data grids

### Accessibility (WCAG 2.1 AA minimum)

- All interactive elements keyboard-navigable
- All inputs have associated labels
- Color contrast ratio >= 4.5:1
- Focus management on route changes and modals
- ARIA attributes on dynamic content
- Screen reader announcements for form errors (aria-live)

### BFF Proxy Pattern

Frontend NEVER calls the NestJS API directly. All API calls go through Next.js API routes (`/api/*`) which proxy to NestJS. This:

- Keeps JWT tokens in httpOnly cookies (not accessible to JS)
- Provides a single origin (no CORS issues for the browser)
- Allows server-side token refresh

---

## Code Quality Checklist

Before marking ANY ticket complete:

- [ ] Tests written FIRST (TDD)
- [ ] All tests pass (`turbo test`)
- [ ] Coverage >= 80% (90%+ for auth/encryption/RLS)
- [ ] No ESLint errors (`turbo lint`)
- [ ] TypeScript strict mode — no `any` types
- [ ] Functions < 50 lines
- [ ] Files < 800 lines (extract if larger)
- [ ] No deep nesting (> 4 levels)
- [ ] Immutable data patterns used
- [ ] Error handling at every level
- [ ] No hardcoded values (use constants or config)
- [ ] Sensitive fields encrypted
- [ ] Audit log entries created for mutations
- [ ] Input validated with Zod at API boundary
- [ ] No secrets in code
- [ ] Accessibility checked (keyboard nav, labels, contrast)

---

## Git Workflow

### Commit Messages

```
<type>: <description>

<optional body>
```

Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`, `ci`

### Branch Strategy

- `main` — production-ready, protected
- `develop` — integration branch
- `feat/TP-XXX-description` — feature branches per ticket
- `fix/TP-XXX-description` — bug fix branches

### PR Requirements

- All CI checks pass (lint, test, build, Semgrep, npm audit)
- Coverage >= 80%
- Code review completed
- Security review for auth/encryption/access control changes

---

## Plan Tracking (MANDATORY)

The master plan lives at **`/PLAN.md`** in the project root.

**After completing every major feature or ticket:**

1. Open `PLAN.md`
2. Mark the completed ticket(s) with `[x]` or strikethrough
3. Add a "Completed" date and any notes (deviations, decisions made, blockers resolved)
4. Update the phase summary with actual story points spent vs estimated
5. If the plan changed during implementation (new tickets, removed tickets, dependency changes), update the plan to reflect reality

This keeps the plan a living document — always reflecting the true state of the project.

---

## Ticket Reference

Tickets are numbered TP-001 through TP-061 across 6 phases.
Full ticket plan: `PLAN.md` (project root)

| Phase | Tickets          | Focus                                         |
| ----- | ---------------- | --------------------------------------------- |
| 1     | TP-001 to TP-024 | Foundation, auth, profiles, directory         |
| 2     | TP-025 to TP-033 | Worksheet engine, builder, assignments        |
| 3     | TP-034 to TP-040 | Worksheet submission, scoring, notifications  |
| 4     | TP-041 to TP-047 | Session notes, encryption, versioning         |
| 5     | TP-048 to TP-053 | Progress dashboards, charts, timeline         |
| 6     | TP-054 to TP-061 | Security audit, a11y, performance, deployment |

---

## Environment Variables

Required variables (validated at startup with Zod):

```env
# Database
DATABASE_URL=postgresql://...

# Auth
JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=
BCRYPT_COST_FACTOR=12

# Encryption
ENCRYPTION_KEY=           # 32-byte hex string for AES-256-GCM

# App
API_URL=http://localhost:3001
WEB_URL=http://localhost:3000
NODE_ENV=development

# Rate Limiting
LOGIN_RATE_LIMIT_MAX=5
LOGIN_RATE_LIMIT_WINDOW_MS=900000
```

---

## Running the Project

```bash
# Install dependencies
npm install

# Start development (all apps)
turbo dev

# Run tests
turbo test

# Run E2E tests
turbo test:e2e

# Lint
turbo lint

# Build
turbo build

# Database
cd apps/api && npx prisma migrate dev
cd apps/api && npx prisma db seed
```
