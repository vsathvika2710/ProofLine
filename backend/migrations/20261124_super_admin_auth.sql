ALTER TABLE public.authorized_identities
    ADD COLUMN IF NOT EXISTS global_role VARCHAR(32) NOT NULL DEFAULT 'employee'
    CHECK (global_role IN ('employee', 'super_admin'));

ALTER TABLE public.organization_memberships
    DROP CONSTRAINT IF EXISTS uq_membership_identity_org;

ALTER TABLE public.authorized_identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'uq_membership_identity_org_role'
          AND conrelid = 'public.organization_memberships'::regclass
    ) THEN
        ALTER TABLE public.organization_memberships
            ADD CONSTRAINT uq_membership_identity_org_role
            UNIQUE (organization_id, authorized_identity_id, assigned_role);
    END IF;
END $$;

CREATE OR REPLACE FUNCTION public.proofline_user_organization_ids()
RETURNS SETOF UUID
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
    SELECT organization_id
    FROM public.organization_memberships
    WHERE membership_status = 'active'
      AND (
          authenticated_user_id = auth.uid()
          OR authorized_identity_id IN (
              SELECT id
              FROM public.authorized_identities
              WHERE normalized_email = (
                  SELECT lower(email) FROM auth.users WHERE id = auth.uid()
              )
          )
      )
$$;

CREATE OR REPLACE FUNCTION public.proofline_register_super_admin(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    target_email TEXT;
    target_org UUID;
    identity_id UUID;
    existing_global_role TEXT;
BEGIN
    SELECT lower(email)
      INTO target_email
      FROM auth.users
     WHERE id = p_user_id;

    IF target_email IS DISTINCT FROM 'proofline.office@gmail.com' THEN
        RAISE EXCEPTION 'The requested auth user is not the configured ProofLine administrator';
    END IF;

    INSERT INTO public.organizations (name, industry, is_demo)
    VALUES ('ProofLine Isolated Test', 'Internal testing', TRUE)
    ON CONFLICT (name, is_demo) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO target_org;

    SELECT id, global_role
      INTO identity_id, existing_global_role
      FROM public.authorized_identities
     WHERE normalized_email = target_email;

    IF identity_id IS NOT NULL AND existing_global_role <> 'super_admin' THEN
        RAISE EXCEPTION 'The email is already registered as a non-admin identity';
    END IF;

    IF identity_id IS NULL THEN
        INSERT INTO public.authorized_identities (
            normalized_email, account_type, global_role, is_active
        )
        VALUES (target_email, 'employee', 'super_admin', TRUE)
        RETURNING id INTO identity_id;
    ELSE
        IF EXISTS (
            SELECT 1
              FROM public.organization_memberships
             WHERE authorized_identity_id = identity_id
               AND organization_id <> target_org
        ) THEN
            RAISE EXCEPTION 'The super-admin identity is already assigned to another organization';
        END IF;
        UPDATE public.authorized_identities
           SET account_type = 'employee',
               global_role = 'super_admin',
               is_active = TRUE
         WHERE id = identity_id;
    END IF;

    INSERT INTO public.user_profiles (user_id, full_name)
    VALUES (p_user_id, 'ProofLine Super Admin')
    ON CONFLICT (user_id) DO UPDATE
        SET full_name = EXCLUDED.full_name;

    DELETE FROM public.organization_memberships
     WHERE authorized_identity_id = identity_id
       AND organization_id = target_org;

    INSERT INTO public.organization_memberships (
        organization_id, authorized_identity_id, assigned_role, membership_status
    )
    VALUES
        (target_org, identity_id, 'admin', 'active'),
        (target_org, identity_id, 'creator', 'active'),
        (target_org, identity_id, 'reviewer', 'active');

    RETURN jsonb_build_object(
        'email', target_email,
        'global_role', 'super_admin',
        'organization_id', target_org,
        'authorized_workspaces', jsonb_build_array('admin', 'creator', 'reviewer')
    );
END;
$$;

REVOKE ALL ON FUNCTION public.proofline_register_super_admin(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.proofline_register_super_admin(UUID) TO service_role;
