-- Launch is free-only: a sale listing may not carry an enabled paid option (hire listings are quoted later and stay allowed).
-- Checked on the option row itself, because a product's updated_at does not change twice in one transaction.
create or replace function private.product_options_paid_rule() returns trigger
language plpgsql security definer set search_path = '' as $$
declare t public.sell_type;
begin
  if private.is_service() or not new.enabled or coalesce(new.price, 0) <= 0 then return new; end if;
  if coalesce((private.rule('paid_sales'))::text::boolean, true) then return new; end if;
  select p.sell_type into t from public.products p where p.id = new.product_id;
  if t is distinct from 'hire' then
    raise exception 'PAID_SALES_LATER' using errcode = 'P0001', hint = 'ช่วงแรกเปิดเฉพาะผลงานฟรี · ระบบชำระเงินจะเปิดภายหลัง';
  end if;
  return new;
end $$;
revoke execute on function private.product_options_paid_rule() from public, anon, authenticated;

drop trigger if exists product_options_0_paid on public.product_options;
create trigger product_options_0_paid before insert or update of price, enabled, product_id on public.product_options
  for each row execute function private.product_options_paid_rule();
