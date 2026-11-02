-- LUMI 0008: functions get EXECUTE for PUBLIC by default; remove it everywhere and grant only what policies / invoker code need.
-- schema-scoped default privileges cannot remove the global PUBLIC default, so revoke it globally for the migration role
alter default privileges for role postgres revoke execute on functions from public;

revoke execute on all functions in schema private from public, anon, authenticated;

-- used by invoker triggers and RLS policies
grant execute on function private.is_service(), private.bypass(), private.owns_product(uuid), private.product_visible(uuid),
  private.post_visible(uuid) to anon, authenticated;
grant execute on function private.listing_missing(uuid, public.sell_type, jsonb, text, text, text, text[], boolean),
  private.is_thread_member(uuid), private.thread_role(uuid), private.has_entitlement(uuid), private.can_read_secrets(uuid),
  private.is_job_member(uuid), private.file_visible(uuid, uuid, uuid, uuid, public.file_role), private.can_download(text, text), private.job_step(public.job_status),
  private.finalize_free_order(uuid), private.notify_followers(uuid) to authenticated;
grant execute on all functions in schema private to service_role;
-- set_bypass / notify / mark_order_paid / license_key / ensure_thread / recompute_order stay owner-only (called from security definer code)
revoke execute on function private.set_bypass(boolean), private.notify(uuid, public.notif_kind, text, text, uuid, text) from service_role;
