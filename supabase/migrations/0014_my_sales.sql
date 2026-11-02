-- Creator shop orders page: every paid item sold by me, with buyer, payout (ledger) and refund state.
-- Sellers cannot read the buyer's whole order (other creators' items/totals), so this definer function
-- returns only the seller's own lines plus the order number and buyer's public name.
create or replace function private.my_sales() returns table (
  item_id uuid, order_no text, paid_at timestamptz, buyer_id uuid, product_id uuid, offer_id uuid, job_id uuid,
  title text, option_label text, gross int, fee int, net int, ledger_status text, release_after timestamptz,
  refund_id uuid, refund_status text, refund_reason text, refund_note text, refund_at timestamptz, thread_id uuid
)
language sql stable security definer set search_path = '' as $$
  select oi.id, o.order_no, o.paid_at, o.buyer_id, oi.product_id, oi.offer_id, oi.job_id,
         oi.title, oi.option_label, oi.unit_price - oi.discount,
         coalesce(l.fee, 0), coalesce(l.net, oi.unit_price - oi.discount), l.status::text, l.release_after,
         r.id, r.status, r.reason, r.note, r.created_at,
         coalesce(e.thread_id, j.thread_id)
  from public.order_items oi
  join public.orders o on o.id = oi.order_id and o.status in ('paid','refunded')
  left join lateral (select * from public.ledger l where l.order_item_id = oi.id order by l.created_at desc limit 1) l on true
  left join lateral (select * from public.refund_requests r where r.order_item_id = oi.id order by r.created_at desc limit 1) r on true
  left join lateral (select e.thread_id from public.entitlements e where e.order_item_id = oi.id limit 1) e on true
  left join public.hire_jobs j on j.id = oi.job_id
  where oi.creator_id = auth.uid() and oi.tip_creator_id is null
  order by o.paid_at desc nulls last
  limit 500
$$;
create or replace function public.my_sales() returns table (
  item_id uuid, order_no text, paid_at timestamptz, buyer_id uuid, product_id uuid, offer_id uuid, job_id uuid,
  title text, option_label text, gross int, fee int, net int, ledger_status text, release_after timestamptz,
  refund_id uuid, refund_status text, refund_reason text, refund_note text, refund_at timestamptz, thread_id uuid
)
language sql stable security invoker set search_path = '' as $$ select * from private.my_sales() $$;
revoke execute on function public.my_sales(), private.my_sales() from public, anon;
grant execute on function public.my_sales(), private.my_sales() to authenticated, service_role;
