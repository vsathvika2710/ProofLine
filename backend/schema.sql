-- Proofline Schema: Brand Governance & Change-Impact Engine
-- Database: PostgreSQL with pgvector extension (Supabase compatible)

-- 1. Extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Evidence Documents (Approved source documents uploaded to the Vault)
CREATE TABLE IF NOT EXISTS evidence_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    doc_type VARCHAR(50) NOT NULL,            -- 'pdf', 'docx', 'txt'
    owner VARCHAR(255) NOT NULL,
    version VARCHAR(50) NOT NULL DEFAULT 'v1.0',
    approval_status VARCHAR(50) NOT NULL DEFAULT 'approved', -- 'approved', 'draft', 'archived'
    effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
    expiry_date DATE,
    file_path TEXT,
    raw_text TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Evidence Chunks (Text chunks with pgvector embeddings for evidence retrieval)
CREATE TABLE IF NOT EXISTS evidence_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES evidence_documents(id) ON DELETE CASCADE,
    chunk_index INT NOT NULL,
    passage_text TEXT NOT NULL,
    section_title VARCHAR(255),
    embedding vector(768),                    -- Compatible with text-embedding-004
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_chunks_doc_id ON evidence_chunks(document_id);

-- 4. Structured Facts (Approved business ground truth)
CREATE TABLE IF NOT EXISTS structured_facts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fact_key VARCHAR(100) NOT NULL UNIQUE,     -- e.g., 'warranty_period', 'water_resistance_depth'
    name VARCHAR(255) NOT NULL,               -- e.g., 'Standard Hardware Warranty'
    current_value TEXT NOT NULL,              -- e.g., '2' or '1'
    unit VARCHAR(50),                         -- e.g., 'years', 'days', 'meters'
    source_document_id UUID REFERENCES evidence_documents(id) ON DELETE SET NULL,
    source_passage TEXT NOT NULL,             -- exact quoted approval text
    version VARCHAR(50) NOT NULL DEFAULT 'v1.0',
    effective_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Content Assets (Marketing collateral, web pages, brochures, social posts)
CREATE TABLE IF NOT EXISTS content_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    asset_type VARCHAR(50) NOT NULL,          -- 'website_page', 'sales_brochure', 'instagram_post'
    channel VARCHAR(100) NOT NULL,            -- 'Web', 'Sales Collateral', 'Social Media'
    raw_text TEXT NOT NULL,
    approval_status VARCHAR(50) NOT NULL DEFAULT 'draft', -- 'approved', 'approval_invalidated', 'under_review', 'draft'
    last_scanned_at TIMESTAMP WITH TIME ZONE,
    last_approved_by VARCHAR(255),
    last_approved_at TIMESTAMP WITH TIME ZONE,
    version INT NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. Claims (Extracted factual claims from content assets)
CREATE TABLE IF NOT EXISTS claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID NOT NULL REFERENCES content_assets(id) ON DELETE CASCADE,
    claim_text TEXT NOT NULL,
    claim_type VARCHAR(50) NOT NULL,          -- 'numeric', 'comparative', 'date', 'promotional', 'other'
    exact_source_sentence TEXT NOT NULL,
    location_start INT,
    location_end INT,
    matched_fact_id UUID REFERENCES structured_facts(id) ON DELETE SET NULL,
    verification_status VARCHAR(50) NOT NULL, -- 'supported', 'contradicted', 'unsupported', 'outdated', 'needs_human_review', 'not_affected'
    confidence NUMERIC(5, 2) NOT NULL,        -- 0.00 to 1.00
    reason TEXT NOT NULL,
    quoted_passage TEXT,                      -- exact cited sentence from approved source
    suggested_correction TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_claims_asset_id ON claims(asset_id);
CREATE INDEX IF NOT EXISTS idx_claims_fact_id ON claims(matched_fact_id);

-- 7. Change Impact Events (Change-Impact Engine execution records)
CREATE TABLE IF NOT EXISTS impact_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fact_id UUID NOT NULL REFERENCES structured_facts(id) ON DELETE CASCADE,
    fact_key VARCHAR(100) NOT NULL,
    old_value TEXT NOT NULL,
    new_value TEXT NOT NULL,
    source_doc_version VARCHAR(50),
    triggered_by VARCHAR(255) NOT NULL,
    total_assets_scanned INT NOT NULL DEFAULT 0,
    items_need_review INT NOT NULL DEFAULT 0,
    items_unaffected INT NOT NULL DEFAULT 0,
    impact_summary JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. Human Review Tasks (Review Centre queue)
CREATE TABLE IF NOT EXISTS review_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID NOT NULL REFERENCES content_assets(id) ON DELETE CASCADE,
    claim_id UUID REFERENCES claims(id) ON DELETE SET NULL,
    impact_event_id UUID REFERENCES impact_events(id) ON DELETE SET NULL,
    trigger_type VARCHAR(50) NOT NULL,        -- 'fact_change_cascade', 'content_scan'
    priority VARCHAR(50) NOT NULL DEFAULT 'high', -- 'critical', 'high', 'medium', 'low'
    assigned_role VARCHAR(50) NOT NULL DEFAULT 'reviewer', -- 'reviewer', 'admin', 'creator'
    assigned_user VARCHAR(255),
    original_text TEXT NOT NULL,
    suggested_text TEXT NOT NULL,
    explanation TEXT NOT NULL,
    cited_source TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'edited'
    decision_notes TEXT,
    decided_by VARCHAR(255),
    decided_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tasks_status ON review_tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_asset ON review_tasks(asset_id);

-- 9. Audit Log (Immutable brand governance ledger)
CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor VARCHAR(255) NOT NULL,
    actor_role VARCHAR(50) NOT NULL,          -- 'admin', 'reviewer', 'creator', 'system'
    action VARCHAR(100) NOT NULL,             -- 'FACT_UPDATED', 'IMPACT_EVALUATED', 'APPROVAL_INVALIDATED', 'CORRECTION_APPLIED', 'CONTENT_APPROVED'
    target_entity VARCHAR(100) NOT NULL,      -- 'structured_facts', 'content_assets', 'review_tasks'
    target_id UUID,
    diff_payload JSONB DEFAULT '{}'::jsonb,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at DESC);
