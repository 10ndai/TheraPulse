-- TheraPulse — Initial Schema Migration
-- TP-005: Creates all 11 tables with indexes, constraints, and security rules.
--
-- Custom SQL beyond Prisma's schema.prisma capabilities:
--   1. GIN indexes on therapist_profiles TEXT[] columns (specializations, languages)
--   2. Immutability trigger on worksheet_submissions (blocks UPDATE after finalized_at set)
--   3. Append-only rule on audit_logs (blocks UPDATE and DELETE)
--
-- RLS policies are added separately in TP-024 to keep this migration focused.

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'THERAPIST', 'CLIENT');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'PENDING', 'SUSPENDED', 'DELETED');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "RelationshipStatus" AS ENUM ('ACTIVE', 'PAUSED', 'TERMINATED');

-- CreateEnum
CREATE TYPE "WorksheetType" AS ENUM ('PHQ9', 'GAD7', 'MOOD_TRACKING', 'CBT_THOUGHT_RECORD', 'GOAL_SETTING', 'CUSTOM');

-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'OVERDUE');

-- CreateEnum
CREATE TYPE "NoteStatus" AS ENUM ('DRAFT', 'FINALIZED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "totp_secret" TEXT,
    "totp_enabled" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "therapist_profiles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "bio" TEXT,
    "specializations" TEXT[],
    "qualifications" TEXT[],
    "license_number" TEXT,
    "languages" TEXT[],
    "city" TEXT,
    "province" TEXT,
    "phone" TEXT,
    "approval_status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "approved_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "therapist_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_profiles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT,
    "province" TEXT,
    "date_of_birth" TEXT,
    "phone" TEXT,
    "emergency_contact" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "therapist_clients" (
    "id" UUID NOT NULL,
    "therapist_id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "status" "RelationshipStatus" NOT NULL DEFAULT 'ACTIVE',
    "started_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "therapist_clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "worksheet_templates" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "type" "WorksheetType" NOT NULL,
    "schema" JSONB NOT NULL,
    "scoring_config" JSONB,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_by_id" UUID,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "worksheet_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "worksheet_assignments" (
    "id" UUID NOT NULL,
    "template_id" UUID NOT NULL,
    "therapist_id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "instructions" TEXT,
    "due_date" TIMESTAMPTZ,
    "status" "AssignmentStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "worksheet_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable: worksheet_submissions is IMMUTABLE after finalized_at is set.
-- No updated_at column by design — the trigger below enforces this.
CREATE TABLE "worksheet_submissions" (
    "id" UUID NOT NULL,
    "assignment_id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "responses" TEXT NOT NULL,
    "score" JSONB,
    "finalized_at" TIMESTAMPTZ,
    "integrity_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "worksheet_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session_notes" (
    "id" UUID NOT NULL,
    "therapist_id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "session_date" TIMESTAMPTZ NOT NULL,
    "session_type" TEXT NOT NULL,
    "subjective" TEXT,
    "objective" TEXT,
    "assessment" TEXT,
    "plan" TEXT,
    "status" "NoteStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "session_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable: session_note_versions are write-once audit artifacts — no updated_at.
CREATE TABLE "session_note_versions" (
    "id" UUID NOT NULL,
    "session_note_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "content_snapshot" TEXT NOT NULL,
    "changed_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "session_note_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable: audit_logs are append-only — no updated_at.
-- The rule below blocks UPDATE and DELETE at the database level.
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "actor_id" UUID,
    "action" TEXT NOT NULL,
    "resource_type" TEXT NOT NULL,
    "resource_id" TEXT,
    "details" JSONB,
    "ip_address" TEXT NOT NULL,
    "user_agent" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "revoked_at" TIMESTAMPTZ,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Standard indexes (generated by Prisma)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE INDEX "users_email_idx" ON "users"("email");
CREATE INDEX "users_role_status_idx" ON "users"("role", "status");

CREATE UNIQUE INDEX "therapist_profiles_user_id_key" ON "therapist_profiles"("user_id");
CREATE INDEX "therapist_profiles_approval_status_idx" ON "therapist_profiles"("approval_status");
CREATE INDEX "therapist_profiles_city_province_idx" ON "therapist_profiles"("city", "province");

CREATE UNIQUE INDEX "client_profiles_user_id_key" ON "client_profiles"("user_id");

CREATE INDEX "therapist_clients_therapist_id_status_idx" ON "therapist_clients"("therapist_id", "status");
CREATE INDEX "therapist_clients_client_id_status_idx" ON "therapist_clients"("client_id", "status");
CREATE UNIQUE INDEX "therapist_clients_therapist_id_client_id_key" ON "therapist_clients"("therapist_id", "client_id");

CREATE INDEX "worksheet_templates_type_is_published_idx" ON "worksheet_templates"("type", "is_published");
CREATE INDEX "worksheet_templates_is_system_is_published_idx" ON "worksheet_templates"("is_system", "is_published");

CREATE INDEX "worksheet_assignments_client_id_status_idx" ON "worksheet_assignments"("client_id", "status");
CREATE INDEX "worksheet_assignments_therapist_id_status_idx" ON "worksheet_assignments"("therapist_id", "status");
CREATE INDEX "worksheet_assignments_due_date_status_idx" ON "worksheet_assignments"("due_date", "status");

CREATE INDEX "worksheet_submissions_client_id_finalized_at_idx" ON "worksheet_submissions"("client_id", "finalized_at" DESC);
CREATE INDEX "worksheet_submissions_assignment_id_finalized_at_idx" ON "worksheet_submissions"("assignment_id", "finalized_at");

CREATE INDEX "session_notes_therapist_id_client_id_session_date_idx" ON "session_notes"("therapist_id", "client_id", "session_date" DESC);
CREATE INDEX "session_notes_client_id_session_date_idx" ON "session_notes"("client_id", "session_date" DESC);
CREATE INDEX "session_notes_therapist_id_status_idx" ON "session_notes"("therapist_id", "status");

CREATE INDEX "session_note_versions_session_note_id_version_idx" ON "session_note_versions"("session_note_id", "version");
CREATE UNIQUE INDEX "session_note_versions_session_note_id_version_key" ON "session_note_versions"("session_note_id", "version");

CREATE INDEX "audit_logs_actor_id_created_at_idx" ON "audit_logs"("actor_id", "created_at" DESC);
CREATE INDEX "audit_logs_resource_type_resource_id_created_at_idx" ON "audit_logs"("resource_type", "resource_id", "created_at" DESC);
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at" DESC);
CREATE INDEX "audit_logs_action_created_at_idx" ON "audit_logs"("action", "created_at" DESC);

CREATE INDEX "refresh_tokens_user_id_revoked_at_expires_at_idx" ON "refresh_tokens"("user_id", "revoked_at", "expires_at");

-- ─────────────────────────────────────────────────────────────────────────────
-- GIN indexes on TEXT[] columns (not expressible in Prisma schema syntax)
-- Required for efficient therapist directory search (TP-019)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE INDEX "idx_therapist_specializations" ON "therapist_profiles" USING GIN ("specializations");
CREATE INDEX "idx_therapist_languages" ON "therapist_profiles" USING GIN ("languages");

-- ─────────────────────────────────────────────────────────────────────────────
-- Immutability trigger on worksheet_submissions
-- Blocks any UPDATE once finalized_at IS NOT NULL.
-- Enforces the clinical data immutability rule at the database layer as
-- defense-in-depth (application layer in TP-035 is the primary enforcement).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION prevent_finalized_submission_update()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.finalized_at IS NOT NULL THEN
    RAISE EXCEPTION
      'worksheet_submission % is finalized and immutable — create a new submission instead',
      OLD.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_submission_immutability
  BEFORE UPDATE ON "worksheet_submissions"
  FOR EACH ROW
  EXECUTE FUNCTION prevent_finalized_submission_update();

-- ─────────────────────────────────────────────────────────────────────────────
-- Append-only rule on audit_logs
-- Blocks UPDATE and DELETE at the database level for ALL roles.
-- Defense-in-depth alongside the service-layer enforcement in TP-009.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE RULE audit_logs_no_update AS
  ON UPDATE TO "audit_logs"
  DO INSTEAD NOTHING;

CREATE RULE audit_logs_no_delete AS
  ON DELETE TO "audit_logs"
  DO INSTEAD NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- Foreign keys
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE "therapist_profiles"
  ADD CONSTRAINT "therapist_profiles_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "therapist_profiles"
  ADD CONSTRAINT "therapist_profiles_approved_by_id_fkey"
  FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "client_profiles"
  ADD CONSTRAINT "client_profiles_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "therapist_clients"
  ADD CONSTRAINT "therapist_clients_therapist_id_fkey"
  FOREIGN KEY ("therapist_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "therapist_clients"
  ADD CONSTRAINT "therapist_clients_client_id_fkey"
  FOREIGN KEY ("client_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "worksheet_templates"
  ADD CONSTRAINT "worksheet_templates_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "worksheet_assignments"
  ADD CONSTRAINT "worksheet_assignments_template_id_fkey"
  FOREIGN KEY ("template_id") REFERENCES "worksheet_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "worksheet_assignments"
  ADD CONSTRAINT "worksheet_assignments_therapist_id_fkey"
  FOREIGN KEY ("therapist_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "worksheet_assignments"
  ADD CONSTRAINT "worksheet_assignments_client_id_fkey"
  FOREIGN KEY ("client_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "worksheet_submissions"
  ADD CONSTRAINT "worksheet_submissions_assignment_id_fkey"
  FOREIGN KEY ("assignment_id") REFERENCES "worksheet_assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "worksheet_submissions"
  ADD CONSTRAINT "worksheet_submissions_client_id_fkey"
  FOREIGN KEY ("client_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "session_notes"
  ADD CONSTRAINT "session_notes_therapist_id_fkey"
  FOREIGN KEY ("therapist_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "session_notes"
  ADD CONSTRAINT "session_notes_client_id_fkey"
  FOREIGN KEY ("client_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "session_note_versions"
  ADD CONSTRAINT "session_note_versions_session_note_id_fkey"
  FOREIGN KEY ("session_note_id") REFERENCES "session_notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "session_note_versions"
  ADD CONSTRAINT "session_note_versions_changed_by_id_fkey"
  FOREIGN KEY ("changed_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "audit_logs"
  ADD CONSTRAINT "audit_logs_actor_id_fkey"
  FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "refresh_tokens"
  ADD CONSTRAINT "refresh_tokens_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
