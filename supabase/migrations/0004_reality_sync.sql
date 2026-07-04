-- StudyIG CTO - Reality Sync Schema Extension
--
-- TARGET: Supabase (PostgreSQL)
-- PURPOSE: Introduces the reality_checks table to enable truth-driven engineering reconciling.

CREATE TABLE IF NOT EXISTS studyig_cto.reality_checks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES studyig_cto.projects(id) ON DELETE CASCADE,
    feature_id UUID REFERENCES studyig_cto.features(id) ON DELETE SET NULL,
    repository_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    verification_status TEXT NOT NULL DEFAULT 'not_started', -- not_started, in_progress, implemented, verified, broken
    repository_files TEXT[] NOT NULL DEFAULT '{}',
    mismatch_report JSONB NOT NULL DEFAULT '{}'::jsonb,
    verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS for security
ALTER TABLE studyig_cto.reality_checks ENABLE ROW LEVEL SECURITY;

-- Establish indexing for lookups
CREATE INDEX IF NOT EXISTS idx_reality_checks_project_id ON studyig_cto.reality_checks(project_id);
CREATE INDEX IF NOT EXISTS idx_reality_checks_feature_id ON studyig_cto.reality_checks(feature_id);

-- Attach modification time trigger
DROP TRIGGER IF EXISTS update_reality_checks_modtime ON studyig_cto.reality_checks;
CREATE TRIGGER update_reality_checks_modtime BEFORE UPDATE ON studyig_cto.reality_checks FOR EACH ROW EXECUTE FUNCTION studyig_cto.update_modified_column();

-- Add schema comment
COMMENT ON TABLE studyig_cto.reality_checks IS 'Stores verification check reports comparing planned features with actual file existence/routes.';
