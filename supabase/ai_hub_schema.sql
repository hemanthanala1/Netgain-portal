-- ==========================================================================
-- AI Hub Schema Migration for Netgain Operating Portal
-- Run this in your Supabase SQL Editor
-- ==========================================================================

-- 1. AI Skills Library
CREATE TABLE IF NOT EXISTS ai_skills (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL DEFAULT 'Custom',
    current_version TEXT DEFAULT '1.0.0',
    compatible_ai TEXT DEFAULT 'Claude',
    compatible_version TEXT DEFAULT 'Claude 3.5+',
    file_name TEXT,
    file_size INTEGER DEFAULT 0,
    file_url TEXT,
    downloads INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active',
    created_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- 2. AI Skill Versions
CREATE TABLE IF NOT EXISTS ai_skill_versions (
    id TEXT PRIMARY KEY,
    skill_id TEXT NOT NULL REFERENCES ai_skills(id) ON DELETE CASCADE,
    version TEXT NOT NULL,
    release_notes TEXT,
    file_name TEXT,
    file_size INTEGER DEFAULT 0,
    file_url TEXT,
    status TEXT DEFAULT 'active',
    created_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- 3. AI Prompts Library
CREATE TABLE IF NOT EXISTS ai_prompts (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL DEFAULT 'Custom',
    content TEXT NOT NULL,
    tags TEXT[] DEFAULT '{}'::TEXT[],
    current_version INTEGER DEFAULT 1,
    status TEXT DEFAULT 'active',
    created_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- 4. AI Prompt Versions
CREATE TABLE IF NOT EXISTS ai_prompt_versions (
    id TEXT PRIMARY KEY,
    prompt_id TEXT NOT NULL REFERENCES ai_prompts(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    content TEXT NOT NULL,
    change_note TEXT,
    created_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- 5. AI Knowledge Base
CREATE TABLE IF NOT EXISTS ai_knowledge_base (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    folder TEXT DEFAULT 'General',
    file_name TEXT,
    file_type TEXT,
    file_size INTEGER DEFAULT 0,
    file_url TEXT,
    tags TEXT[] DEFAULT '{}'::TEXT[],
    status TEXT DEFAULT 'active',
    created_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- 6. AI Providers (future-ready, all disabled)
CREATE TABLE IF NOT EXISTS ai_providers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    icon TEXT,
    status TEXT DEFAULT 'coming_soon',
    api_key_configured BOOLEAN DEFAULT FALSE,
    config JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- 7. AI Documents (centralized Document Vault for AI-generated docs)
CREATE TABLE IF NOT EXISTS ai_documents (
    id TEXT PRIMARY KEY,
    doc_id TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    client TEXT,
    project TEXT,
    module TEXT NOT NULL,
    document_type TEXT NOT NULL,
    prompt_used TEXT,
    skill_version TEXT,
    file_name TEXT,
    file_type TEXT,
    file_size INTEGER DEFAULT 0,
    file_url TEXT,
    generated_by TEXT,
    current_version INTEGER DEFAULT 1,
    approval_status TEXT DEFAULT 'draft',
    approver TEXT,
    approver_notes TEXT,
    approval_date TIMESTAMP WITH TIME ZONE,
    tags TEXT[] DEFAULT '{}'::TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- 8. AI Document Versions
CREATE TABLE IF NOT EXISTS ai_document_versions (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL REFERENCES ai_documents(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    file_name TEXT,
    file_url TEXT,
    change_note TEXT,
    created_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- 9. AI Approvals
CREATE TABLE IF NOT EXISTS ai_approvals (
    id TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    entity_title TEXT,
    status TEXT DEFAULT 'draft',
    requested_by TEXT,
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
    reviewed_by TEXT,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    history JSONB DEFAULT '[]'::JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- 10. AI Notifications
CREATE TABLE IF NOT EXISTS ai_notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    title TEXT NOT NULL,
    message TEXT,
    type TEXT DEFAULT 'info',
    entity_type TEXT,
    entity_id TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- ── ENABLE RLS ──────────────────────────────────────────────────────────

ALTER TABLE ai_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_skill_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_prompt_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_knowledge_base ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_notifications ENABLE ROW LEVEL SECURITY;

-- ── RLS POLICIES (matching existing pattern) ────────────────────────────

CREATE POLICY "Public Full Access AI Skills" ON ai_skills FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Full Access AI Skill Versions" ON ai_skill_versions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Full Access AI Prompts" ON ai_prompts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Full Access AI Prompt Versions" ON ai_prompt_versions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Full Access AI Knowledge Base" ON ai_knowledge_base FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Full Access AI Providers" ON ai_providers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Full Access AI Documents" ON ai_documents FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Full Access AI Document Versions" ON ai_document_versions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Full Access AI Approvals" ON ai_approvals FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Full Access AI Notifications" ON ai_notifications FOR ALL USING (true) WITH CHECK (true);

-- ── INDEXES ─────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_ai_skills_category ON ai_skills(category);
CREATE INDEX IF NOT EXISTS idx_ai_skills_status ON ai_skills(status);
CREATE INDEX IF NOT EXISTS idx_ai_skill_versions_skill ON ai_skill_versions(skill_id);
CREATE INDEX IF NOT EXISTS idx_ai_prompts_category ON ai_prompts(category);
CREATE INDEX IF NOT EXISTS idx_ai_knowledge_base_folder ON ai_knowledge_base(folder);
CREATE INDEX IF NOT EXISTS idx_ai_documents_module ON ai_documents(module);
CREATE INDEX IF NOT EXISTS idx_ai_documents_client ON ai_documents(client);
CREATE INDEX IF NOT EXISTS idx_ai_documents_approval ON ai_documents(approval_status);
CREATE INDEX IF NOT EXISTS idx_ai_approvals_entity ON ai_approvals(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_ai_notifications_user ON ai_notifications(user_id, is_read);

-- ── SEED AI PROVIDERS ───────────────────────────────────────────────────

INSERT INTO ai_providers (id, name, description, icon, status) VALUES
('provider-claude', 'Claude', 'Anthropic''s Claude AI — advanced reasoning and document generation', 'brain', 'coming_soon'),
('provider-openai', 'OpenAI', 'GPT models for text generation and analysis', 'sparkles', 'coming_soon'),
('provider-gemini', 'Gemini', 'Google''s Gemini AI for multimodal tasks', 'gem', 'coming_soon'),
('provider-openrouter', 'OpenRouter', 'Unified API for multiple AI providers', 'route', 'coming_soon'),
('provider-deepseek', 'DeepSeek', 'Advanced reasoning and code generation', 'search', 'coming_soon'),
('provider-grok', 'Grok', 'xAI''s conversational AI assistant', 'message-circle', 'coming_soon'),
('provider-ollama', 'Ollama', 'Run open-source LLMs locally', 'server', 'coming_soon'),
('provider-netgain', 'Netgain AI', 'Custom AI models trained for your business', 'zap', 'coming_soon')
ON CONFLICT (id) DO NOTHING;
