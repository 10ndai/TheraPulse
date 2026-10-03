# TheraPulse

A digital records platform for therapy practices that still run on paper.

Worksheets, assessments and session notes usually live in paper files that are hard to search, easy to lose and impossible to analyse. TheraPulse turns them into structured data. A therapist assigns a worksheet or screening measure, the client completes it online, and each result is stored against the client so progress can be tracked and charted over time.

Version 1 is built for therapists and clients in Zimbabwe and in the diaspora, so care can continue across borders.

## What it does

- **Digital worksheets and assessments.** Therapists build templates, assign them to clients and review submissions. Standard screening measures (PHQ-9, GAD-7) are scored automatically with a severity level.
- **Progress view.** Clients and therapists see results as a timeline and charts, not as loose pages.
- **Session notes.** Structured notes linked to each client. Once a note is finalised, it is locked and cannot be edited.
- **Roles.** Admin, therapist and client accounts. A therapist sees only their own clients, and a client sees only their own records.

## Security

This handles mental health data, so security came first.

- Field-level AES-256-GCM encryption for session notes, worksheet answers and personal details
- PostgreSQL row-level security policies on clinical tables, on top of the API's own access checks
- JWT access and refresh tokens, with optional TOTP two-factor login and single-use backup codes
- Login rate limiting per account and an append-only audit log that cannot be edited or deleted

All data in this repository is fake. The seed script creates demo accounts with invented names, and no real client data is stored here.

## Stack

| Layer | Tools |
| --- | --- |
| Frontend | Next.js 15, TypeScript, Tailwind CSS, shadcn/ui |
| API | NestJS, TypeScript |
| Database | PostgreSQL, Prisma |
| Validation | Zod (shared between frontend and API) |
| Testing | Vitest, Testing Library, Playwright |
| Monorepo and CI | Turborepo, GitHub Actions |

## Run locally

Requires Node 20.9+ and a local PostgreSQL database.

```bash
npm install
cp .env.example .env          # then set DATABASE_URL, secrets and ENCRYPTION_KEY
cd apps/api && npx prisma migrate dev && npx prisma db seed && cd ../..
npm run dev                   # web on :3000, API on :3001
npm test                      # all unit and integration tests
```

## Repository layout

```
apps/web/          Next.js frontend
apps/api/          NestJS API, Prisma schema, migrations and seed data
packages/shared/   Zod schemas, types and constants used by both apps
```

## Status

Version 1. Core records, worksheets, assessments, progress tracking and authentication are working and tested locally. It has not been deployed for live clinical use yet.