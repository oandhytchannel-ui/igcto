-- StudyIG CTO - Project Management & Technical Planning Schema Extension
--
-- TARGET: Supabase (PostgreSQL)
-- PURPOSE: Introduces robust, relational project management tables (epics, milestones, features, subtasks, bug_reports, technical_debt, roadmap_items, engineering_notes, architecture_decisions, releases) inside the "studyig_cto" schema.

-- 1. Create auxiliary tables
-- Epics Table
CREATE TABLE IF NOT EXISTS studyig_cto.epics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES studyig_cto.projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'planned', -- planned, in_progress, completed, backlog
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Milestones Table
CREATE TABLE IF NOT EXISTS studyig_cto.milestones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES studyig_cto.projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    due_date TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'active', -- active, completed, delayed
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Features Table
CREATE TABLE IF NOT EXISTS studyig_cto.features (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES studyig_cto.projects(id) ON DELETE CASCADE,
    epic_id UUID REFERENCES studyig_cto.epics(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'planned', -- planned, in_progress, completed, backlog
    priority TEXT NOT NULL DEFAULT 'medium', -- low, medium, high, critical
    engineering_goal TEXT,
    backend_tasks TEXT[] NOT NULL DEFAULT '{}',
    frontend_tasks TEXT[] NOT NULL DEFAULT '{}',
    database_tasks TEXT[] NOT NULL DEFAULT '{}',
    security_considerations TEXT[] NOT NULL DEFAULT '{}',
    testing_checklist TEXT[] NOT NULL DEFAULT '{}',
    deployment_checklist TEXT[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Alter existing tasks table to link with Milestones, Epics, and Features
ALTER TABLE studyig_cto.tasks ADD COLUMN IF NOT EXISTS epic_id UUID REFERENCES studyig_cto.epics(id) ON DELETE SET NULL;
ALTER TABLE studyig_cto.tasks ADD COLUMN IF NOT EXISTS milestone_id UUID REFERENCES studyig_cto.milestones(id) ON DELETE SET NULL;
ALTER TABLE studyig_cto.tasks ADD COLUMN IF NOT EXISTS feature_id UUID REFERENCES studyig_cto.features(id) ON DELETE SET NULL;

-- Subtasks Table
CREATE TABLE IF NOT EXISTS studyig_cto.subtasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES studyig_cto.tasks(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    is_completed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Bug Reports Table
CREATE TABLE IF NOT EXISTS studyig_cto.bug_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES studyig_cto.projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    severity studyig_cto.task_priority NOT NULL DEFAULT 'medium',
    priority studyig_cto.task_priority NOT NULL DEFAULT 'medium',
    affected_files TEXT[] NOT NULL DEFAULT '{}',
    suspected_cause TEXT,
    status studyig_cto.bug_status NOT NULL DEFAULT 'open',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Technical Debt Table
CREATE TABLE IF NOT EXISTS studyig_cto.technical_debt (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES studyig_cto.projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    debt_type TEXT NOT NULL DEFAULT 'maintainability', -- duplicated logic, oversized files, poor abstractions, security concerns, performance issues, maintainability issues
    impact TEXT NOT NULL DEFAULT 'medium', -- low, medium, high, critical
    estimated_effort TEXT NOT NULL DEFAULT 'medium', -- low, medium, high
    recommendation TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Roadmap Items Table
CREATE TABLE IF NOT EXISTS studyig_cto.roadmap_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES studyig_cto.projects(id) ON DELETE CASCADE,
    feature_id UUID REFERENCES studyig_cto.features(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'planned', -- complete, in_progress, planned, missing, pending
    order_index INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Engineering Notes Table
CREATE TABLE IF NOT EXISTS studyig_cto.engineering_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES studyig_cto.projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Architecture Decisions Table (ADR)
CREATE TABLE IF NOT EXISTS studyig_cto.architecture_decisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES studyig_cto.projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    context TEXT NOT NULL,
    decision TEXT NOT NULL,
    consequences TEXT NOT NULL,
    alternatives_considered TEXT NOT NULL DEFAULT '',
    impact studyig_cto.decision_impact NOT NULL DEFAULT 'medium',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Releases Table
CREATE TABLE IF NOT EXISTS studyig_cto.releases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES studyig_cto.projects(id) ON DELETE CASCADE,
    version TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    release_date TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'draft', -- draft, pre-release, released, archived
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Enable Row Level Security (RLS) on all new tables
ALTER TABLE studyig_cto.epics ENABLE ROW LEVEL SECURITY;
ALTER TABLE studyig_cto.milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE studyig_cto.features ENABLE ROW LEVEL SECURITY;
ALTER TABLE studyig_cto.subtasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE studyig_cto.bug_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE studyig_cto.technical_debt ENABLE ROW LEVEL SECURITY;
ALTER TABLE studyig_cto.roadmap_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE studyig_cto.engineering_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE studyig_cto.architecture_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE studyig_cto.releases ENABLE ROW LEVEL SECURITY;

-- 3. Set up indexes
CREATE INDEX IF NOT EXISTS idx_epics_project_id ON studyig_cto.epics(project_id);
CREATE INDEX IF NOT EXISTS idx_milestones_project_id ON studyig_cto.milestones(project_id);
CREATE INDEX IF NOT EXISTS idx_features_project_id ON studyig_cto.features(project_id);
CREATE INDEX IF NOT EXISTS idx_features_epic_id ON studyig_cto.features(epic_id);
CREATE INDEX IF NOT EXISTS idx_subtasks_task_id ON studyig_cto.subtasks(task_id);
CREATE INDEX IF NOT EXISTS idx_bug_reports_project_id ON studyig_cto.bug_reports(project_id);
CREATE INDEX IF NOT EXISTS idx_technical_debt_project_id ON studyig_cto.technical_debt(project_id);
CREATE INDEX IF NOT EXISTS idx_roadmap_items_project_id ON studyig_cto.roadmap_items(project_id);
CREATE INDEX IF NOT EXISTS idx_roadmap_items_order ON studyig_cto.roadmap_items(order_index);
CREATE INDEX IF NOT EXISTS idx_engineering_notes_project_id ON studyig_cto.engineering_notes(project_id);
CREATE INDEX IF NOT EXISTS idx_architecture_decisions_project_id ON studyig_cto.architecture_decisions(project_id);
CREATE INDEX IF NOT EXISTS idx_releases_project_id ON studyig_cto.releases(project_id);

-- 4. Triggers to auto-update modified columns
DROP TRIGGER IF EXISTS update_epics_modtime ON studyig_cto.epics;
CREATE TRIGGER update_epics_modtime BEFORE UPDATE ON studyig_cto.epics FOR EACH ROW EXECUTE FUNCTION studyig_cto.update_modified_column();

DROP TRIGGER IF EXISTS update_milestones_modtime ON studyig_cto.milestones;
CREATE TRIGGER update_milestones_modtime BEFORE UPDATE ON studyig_cto.milestones FOR EACH ROW EXECUTE FUNCTION studyig_cto.update_modified_column();

DROP TRIGGER IF EXISTS update_features_modtime ON studyig_cto.features;
CREATE TRIGGER update_features_modtime BEFORE UPDATE ON studyig_cto.features FOR EACH ROW EXECUTE FUNCTION studyig_cto.update_modified_column();

DROP TRIGGER IF EXISTS update_subtasks_modtime ON studyig_cto.subtasks;
CREATE TRIGGER update_subtasks_modtime BEFORE UPDATE ON studyig_cto.subtasks FOR EACH ROW EXECUTE FUNCTION studyig_cto.update_modified_column();

DROP TRIGGER IF EXISTS update_bug_reports_modtime ON studyig_cto.bug_reports;
CREATE TRIGGER update_bug_reports_modtime BEFORE UPDATE ON studyig_cto.bug_reports FOR EACH ROW EXECUTE FUNCTION studyig_cto.update_modified_column();

DROP TRIGGER IF EXISTS update_technical_debt_modtime ON studyig_cto.technical_debt;
CREATE TRIGGER update_technical_debt_modtime BEFORE UPDATE ON studyig_cto.technical_debt FOR EACH ROW EXECUTE FUNCTION studyig_cto.update_modified_column();

DROP TRIGGER IF EXISTS update_roadmap_items_modtime ON studyig_cto.roadmap_items;
CREATE TRIGGER update_roadmap_items_modtime BEFORE UPDATE ON studyig_cto.roadmap_items FOR EACH ROW EXECUTE FUNCTION studyig_cto.update_modified_column();

DROP TRIGGER IF EXISTS update_engineering_notes_modtime ON studyig_cto.engineering_notes;
CREATE TRIGGER update_engineering_notes_modtime BEFORE UPDATE ON studyig_cto.engineering_notes FOR EACH ROW EXECUTE FUNCTION studyig_cto.update_modified_column();

DROP TRIGGER IF EXISTS update_architecture_decisions_modtime ON studyig_cto.architecture_decisions;
CREATE TRIGGER update_architecture_decisions_modtime BEFORE UPDATE ON studyig_cto.architecture_decisions FOR EACH ROW EXECUTE FUNCTION studyig_cto.update_modified_column();

DROP TRIGGER IF EXISTS update_releases_modtime ON studyig_cto.releases;
CREATE TRIGGER update_releases_modtime BEFORE UPDATE ON studyig_cto.releases FOR EACH ROW EXECUTE FUNCTION studyig_cto.update_modified_column();
