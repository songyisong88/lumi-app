-- Anonymous visitors read live listings; the products policy calls private.has_entitlement,
-- which returns false when auth.uid() is null, so anon needs execute on it.
grant execute on function private.has_entitlement(uuid) to anon;
