-- LUMI 0009: fix ambiguous alias in offers_before; allow hire offers in cart (product_id = hire listing)
create or replace function private.offers_before() returns trigger
language plpgsql set search_path = '' as $$
declare j public.hire_jobs; me uuid := auth.uid();
begin
  if tg_op = 'INSERT' then
    select * into j from public.hire_jobs where id = new.job_id;
    if not found then raise exception 'job not found' using errcode = 'P0002'; end if;
    if not private.bypass() and (j.creator_id <> me or j.status not in ('briefed','quoted')) then
      raise exception 'only the creator can quote before the job is accepted' using errcode = '42501';
    end if;
    new.creator_id := j.creator_id; new.buyer_id := j.buyer_id; new.thread_id := j.thread_id;
    new.status := 'pending'; new.responded_at := null;
    return new;
  end if;
  if not private.bypass() then
    if (new.job_id, new.thread_id, new.creator_id, new.buyer_id, new.title, new.amount, new.items) is distinct from
       (old.job_id, old.thread_id, old.creator_id, old.buyer_id, old.title, old.amount, old.items) then
      raise exception 'a sent quote cannot be edited; send a new one' using errcode = '42501';
    end if;
    if new.status is distinct from old.status and not (
         old.status = 'pending' and ((me = old.buyer_id and new.status in ('accepted','declined')) or (me = old.creator_id and new.status = 'withdrawn'))) then
      raise exception 'quote cannot move from % to %', old.status, new.status using errcode = '42501';
    end if;
    if new.status = 'accepted' and not exists (select 1 from public.hire_jobs hj where hj.id = old.job_id and hj.status = 'quoted') then
      raise exception 'job is not waiting for a quote answer' using errcode = '22023';
    end if;
  end if;
  if new.status is distinct from old.status then new.responded_at := now(); end if;
  return new;
end $$;

drop policy "add to own cart" on public.cart_items;
create policy "add to own cart" on public.cart_items for insert to authenticated
  with check (user_id = (select auth.uid())
    and (product_id is null or exists (select 1 from public.products p where p.id = product_id and p.status = 'published' and p.creator_id <> (select auth.uid()) and (p.sell_type <> 'hire' or offer_id is not null)))
    and (option_id is null or exists (select 1 from public.product_options o where o.id = option_id and o.product_id = cart_items.product_id and o.enabled))
    and (offer_id is null or exists (select 1 from public.offers f where f.id = offer_id and f.buyer_id = (select auth.uid()) and f.status = 'accepted'))
    and (tip_creator_id is null or tip_creator_id <> (select auth.uid())));
