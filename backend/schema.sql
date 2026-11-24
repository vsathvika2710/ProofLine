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

-- 10. Office Workspace authorization (no duplicate auth or organization tables)
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    industry VARCHAR(255),
    website TEXT,
    is_demo BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_organizations_demo_name UNIQUE (name, is_demo)
);

CREATE TABLE IF NOT EXISTS user_profiles (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS authorized_identities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    normalized_email TEXT NOT NULL UNIQUE,
    account_type VARCHAR(32) NOT NULL CHECK (account_type IN ('employee', 'judge_demo')),
    global_role VARCHAR(32) NOT NULL DEFAULT 'employee'
        CHECK (global_role IN ('employee', 'super_admin')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE authorized_identities
    ADD COLUMN IF NOT EXISTS global_role VARCHAR(32) NOT NULL DEFAULT 'employee'
    CHECK (global_role IN ('employee', 'super_admin'));

CREATE TABLE IF NOT EXISTS organization_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    authorized_identity_id UUID REFERENCES authorized_identities(id) ON DELETE CASCADE,
    authenticated_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    assigned_role VARCHAR(32) NOT NULL CHECK (assigned_role IN ('creator', 'reviewer', 'admin')),
    membership_status VARCHAR(32) NOT NULL DEFAULT 'active'
        CHECK (membership_status IN ('active', 'inactive')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT membership_identity_or_user CHECK (
        (authorized_identity_id IS NOT NULL) <> (authenticated_user_id IS NOT NULL)
    ),
    CONSTRAINT uq_membership_identity_org_role
        UNIQUE (organization_id, authorized_identity_id, assigned_role)
);

ALTER TABLE authorized_identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT ON TABLE authorized_identities, organization_memberships, user_profiles TO service_role;

CREATE INDEX IF NOT EXISTS idx_authorized_identity_email
    ON authorized_identities(normalized_email) WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_memberships_org ON organization_memberships(organization_id);
CREATE INDEX IF NOT EXISTS idx_memberships_identity ON organization_memberships(authorized_identity_id);
CREATE INDEX IF NOT EXISTS idx_memberships_user ON organization_memberships(authenticated_user_id);

-- Organization data isolation at the table level.
ALTER TABLE evidence_documents ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);
ALTER TABLE structured_facts ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);
ALTER TABLE content_assets ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);
ALTER TABLE claims ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);
ALTER TABLE impact_events ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);
ALTER TABLE review_tasks ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);

ALTER TABLE evidence_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE structured_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE impact_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION proofline_user_organization_ids()
RETURNS SETOF UUID
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
    SELECT organization_id
    FROM organization_memberships
    WHERE membership_status = 'active'
      AND (
          authenticated_user_id = auth.uid()
          OR authorized_identity_id IN (
              SELECT id
              FROM authorized_identities
              WHERE normalized_email = (
                  SELECT lower(email) FROM auth.users WHERE id = auth.uid()
              )
          )
      )
$$;

DO $$
DECLARE table_name TEXT;
BEGIN
    FOREACH table_name IN ARRAY ARRAY[
        'evidence_documents','structured_facts','content_assets','claims',
        'impact_events','review_tasks','audit_log'
    ]
    LOOP
        EXECUTE format(
            'DROP POLICY IF EXISTS proofline_org_isolation_%s ON %I',
            table_name, table_name
        );
        EXECUTE format(
            'CREATE POLICY proofline_org_isolation_%1$s ON %1$I
             USING (organization_id IN (SELECT proofline_user_organization_ids()))
             WITH CHECK (organization_id IN (SELECT proofline_user_organization_ids()))',
            table_name
        );
    END LOOP;
END $$;

-- 11. Independent hackathon Evaluation Access
CREATE TABLE IF NOT EXISTS evaluation_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    normalized_email TEXT NOT NULL UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS evaluation_role_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    evaluation_account_id UUID NOT NULL REFERENCES evaluation_accounts(id) ON DELETE CASCADE,
    assigned_role VARCHAR(32) NOT NULL CHECK (assigned_role IN ('creator', 'reviewer', 'admin')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_evaluation_role UNIQUE (evaluation_account_id, assigned_role)
);
