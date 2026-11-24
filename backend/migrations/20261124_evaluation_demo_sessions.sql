CREATE TABLE IF NOT EXISTS public.evaluation_demo_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token_hash TEXT NOT NULL UNIQUE
        CHECK (token_hash ~ '^[0-9a-f]{64}$'),
    data JSONB NOT NULL
        DEFAULT '{"assets":{},"reviews":{},"events":[]}'::jsonb
        CHECK (jsonb_typeof(data) = 'object'),
    version BIGINT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_activity_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_evaluation_demo_sessions_expiry
    ON public.evaluation_demo_sessions (expires_at);

ALTER TABLE public.evaluation_demo_sessions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.evaluation_demo_sessions
    FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE
    ON TABLE public.evaluation_demo_sessions
    TO service_role;
