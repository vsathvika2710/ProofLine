GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT ON TABLE
    public.authorized_identities,
    public.organization_memberships,
    public.user_profiles
TO service_role;
