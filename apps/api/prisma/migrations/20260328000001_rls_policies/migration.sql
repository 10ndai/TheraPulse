-- TheraPulse — Row-Level Security (RLS) Migration
-- TP-024: Enables RLS on all clinical tables and adds per-role policies.
--
-- Session variables set per-request by Prisma middleware:
--   app.user_id   — authenticated user's UUID
--   app.user_role — authenticated user's role (ADMIN, THERAPIST, CLIENT)
--
-- Helper function reads these variables safely (returns NULL if unset).

-- ─────────────────────────────────────────────────────────────────────────────
-- Helper functions
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION current_user_id() RETURNS UUID AS $$
  SELECT NULLIF(current_setting('app.user_id', true), '')::UUID;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION current_user_role() RETURNS TEXT AS $$
  SELECT NULLIF(current_setting('app.user_role', true), '');
$$ LANGUAGE sql STABLE;

-- ─────────────────────────────────────────────────────────────────────────────
-- users
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;

-- ADMIN: full access
CREATE POLICY users_admin ON users
  USING (current_user_role() = 'ADMIN');

-- THERAPIST / CLIENT: own row only
CREATE POLICY users_self ON users
  USING (id = current_user_id());

-- ─────────────────────────────────────────────────────────────────────────────
-- therapist_profiles
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE therapist_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE therapist_profiles FORCE ROW LEVEL SECURITY;

-- ADMIN: full access
CREATE POLICY tp_admin ON therapist_profiles
  USING (current_user_role() = 'ADMIN');

-- THERAPIST: own profile
CREATE POLICY tp_therapist_own ON therapist_profiles
  USING (current_user_role() = 'THERAPIST' AND user_id = current_user_id());

-- CLIENT: can read approved profiles (for directory)
CREATE POLICY tp_client_read_approved ON therapist_profiles
  FOR SELECT
  USING (current_user_role() = 'CLIENT' AND approval_status = 'APPROVED');

-- Unauthenticated / public directory reads (no session variables set)
CREATE POLICY tp_public_read_approved ON therapist_profiles
  FOR SELECT
  USING (current_user_id() IS NULL AND approval_status = 'APPROVED');

-- ─────────────────────────────────────────────────────────────────────────────
-- client_profiles
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE client_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_profiles FORCE ROW LEVEL SECURITY;

-- ADMIN: full access
CREATE POLICY cp_admin ON client_profiles
  USING (current_user_role() = 'ADMIN');

-- CLIENT: own profile
CREATE POLICY cp_client_own ON client_profiles
  USING (current_user_role() = 'CLIENT' AND user_id = current_user_id());

-- THERAPIST: can read profiles of their active clients
CREATE POLICY cp_therapist_read ON client_profiles
  FOR SELECT
  USING (
    current_user_role() = 'THERAPIST'
    AND EXISTS (
      SELECT 1 FROM therapist_clients tc
      WHERE tc.therapist_id = current_user_id()
        AND tc.client_id = client_profiles.user_id
        AND tc.status = 'ACTIVE'
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- therapist_clients (relationship table)
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE therapist_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE therapist_clients FORCE ROW LEVEL SECURITY;

-- ADMIN: full access
CREATE POLICY tc_admin ON therapist_clients
  USING (current_user_role() = 'ADMIN');

-- THERAPIST: own relationships
CREATE POLICY tc_therapist_own ON therapist_clients
  USING (current_user_role() = 'THERAPIST' AND therapist_id = current_user_id());

-- CLIENT: own relationships
CREATE POLICY tc_client_own ON therapist_clients
  USING (current_user_role() = 'CLIENT' AND client_id = current_user_id());

-- ─────────────────────────────────────────────────────────────────────────────
-- worksheet_templates
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE worksheet_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE worksheet_templates FORCE ROW LEVEL SECURITY;

-- ADMIN: full access
CREATE POLICY wt_admin ON worksheet_templates
  USING (current_user_role() = 'ADMIN');

-- THERAPIST: own templates
CREATE POLICY wt_therapist_own ON worksheet_templates
  USING (current_user_role() = 'THERAPIST' AND created_by_id = current_user_id());

-- CLIENT: can read templates for their assignments (via worksheet_assignments join)
CREATE POLICY wt_client_assigned ON worksheet_templates
  FOR SELECT
  USING (
    current_user_role() = 'CLIENT'
    AND EXISTS (
      SELECT 1 FROM worksheet_assignments wa
      WHERE wa.template_id = worksheet_templates.id
        AND wa.client_id = current_user_id()
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- worksheet_assignments
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE worksheet_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE worksheet_assignments FORCE ROW LEVEL SECURITY;

-- ADMIN: full access
CREATE POLICY wa_admin ON worksheet_assignments
  USING (current_user_role() = 'ADMIN');

-- THERAPIST: assignments they created
CREATE POLICY wa_therapist_own ON worksheet_assignments
  USING (current_user_role() = 'THERAPIST' AND therapist_id = current_user_id());

-- CLIENT: assignments for them
CREATE POLICY wa_client_own ON worksheet_assignments
  USING (current_user_role() = 'CLIENT' AND client_id = current_user_id());

-- ─────────────────────────────────────────────────────────────────────────────
-- worksheet_submissions
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE worksheet_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE worksheet_submissions FORCE ROW LEVEL SECURITY;

-- ADMIN: full access
CREATE POLICY ws_admin ON worksheet_submissions
  USING (current_user_role() = 'ADMIN');

-- CLIENT: own submissions
CREATE POLICY ws_client_own ON worksheet_submissions
  USING (current_user_role() = 'CLIENT' AND client_id = current_user_id());

-- THERAPIST: submissions from their active clients
CREATE POLICY ws_therapist_read ON worksheet_submissions
  FOR SELECT
  USING (
    current_user_role() = 'THERAPIST'
    AND EXISTS (
      SELECT 1 FROM therapist_clients tc
      WHERE tc.therapist_id = current_user_id()
        AND tc.client_id = worksheet_submissions.client_id
        AND tc.status = 'ACTIVE'
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- session_notes
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE session_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_notes FORCE ROW LEVEL SECURITY;

-- ADMIN: full access
CREATE POLICY sn_admin ON session_notes
  USING (current_user_role() = 'ADMIN');

-- THERAPIST: own notes
CREATE POLICY sn_therapist_own ON session_notes
  USING (current_user_role() = 'THERAPIST' AND therapist_id = current_user_id());

-- CLIENT: can read finalized notes about them
CREATE POLICY sn_client_read ON session_notes
  FOR SELECT
  USING (current_user_role() = 'CLIENT' AND client_id = current_user_id() AND status = 'FINALIZED');

-- ─────────────────────────────────────────────────────────────────────────────
-- session_note_versions
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE session_note_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_note_versions FORCE ROW LEVEL SECURITY;

-- ADMIN: full access
CREATE POLICY snv_admin ON session_note_versions
  USING (current_user_role() = 'ADMIN');

-- THERAPIST: versions of their own notes
CREATE POLICY snv_therapist_own ON session_note_versions
  USING (
    current_user_role() = 'THERAPIST'
    AND EXISTS (
      SELECT 1 FROM session_notes sn
      WHERE sn.id = session_note_versions.session_note_id
        AND sn.therapist_id = current_user_id()
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- audit_logs (append-only: INSERT only, no SELECT for non-ADMIN)
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs FORCE ROW LEVEL SECURITY;

-- ADMIN: can read audit logs
CREATE POLICY al_admin_read ON audit_logs
  FOR SELECT
  USING (current_user_role() = 'ADMIN');

-- Any authenticated user: can insert (audit logging happens server-side)
CREATE POLICY al_insert ON audit_logs
  FOR INSERT
  WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- refresh_tokens (own tokens only)
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE refresh_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE refresh_tokens FORCE ROW LEVEL SECURITY;

-- Any authenticated user: own tokens
CREATE POLICY rt_own ON refresh_tokens
  USING (user_id = current_user_id());

-- Allow insert for new tokens
CREATE POLICY rt_insert ON refresh_tokens
  FOR INSERT
  WITH CHECK (user_id = current_user_id());
