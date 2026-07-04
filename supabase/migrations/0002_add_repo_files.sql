-- Create repo_files table to cache scanned file metadata
CREATE TABLE IF NOT EXISTS studyig_cto.repo_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES studyig_cto.projects(id) ON DELETE CASCADE,
    path TEXT NOT NULL,
    name TEXT NOT NULL,
    size INTEGER NOT NULL,
    sha TEXT NOT NULL,
    download_url TEXT,
    content TEXT,
    summary TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_project_file_path UNIQUE (project_id, path)
);

ALTER TABLE studyig_cto.repo_files ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_repo_files_project_id ON studyig_cto.repo_files(project_id);
CREATE INDEX IF NOT EXISTS idx_repo_files_path ON studyig_cto.repo_files(path);

DROP TRIGGER IF EXISTS update_repo_files_modtime ON studyig_cto.repo_files;
CREATE TRIGGER update_repo_files_modtime BEFORE UPDATE ON studyig_cto.repo_files FOR EACH ROW EXECUTE FUNCTION studyig_cto.update_modified_column();
