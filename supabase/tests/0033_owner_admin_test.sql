-- Run AFTER 0033; always ends with an exception so nothing is kept (fake users are rolled back).
do $$
declare a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); c uuid := gen_random_uuid(); out jsonb := '{}';
begin
  -- 1 unconfirmed sign-up with the owner's email -> no role
  insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
    values (a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'SongYiSong88@gmail.com', now(), now(), '{"provider":"email"}', '{}');
  out := out || jsonb_build_object('unconfirmed_role', (select count(*) from public.admin_roles where user_id = a));
  -- 2 confirms the email -> admin
  update auth.users set email_confirmed_at = now() where id = a;
  out := out || jsonb_build_object('confirmed_role', (select string_agg(role, ',') from public.admin_roles where user_id = a),
                                   'audit_logged', (select count(*) from public.audit_log where action = 'role.granted' and target_id = a::text),
                                   'pending_after', (select value -> 'pending' from private.settings where key = 'owner_admins'));
  -- owner can use staff powers
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  out := out || jsonb_build_object('owner_is_moderator', private.is_staff('moderator'), 'owner_is_admin', private.is_staff('admin'));
  perform set_config('request.jwt.claims', '', true);
  -- 3 account deleted, a NEW account with the same address later -> nothing (one-shot)
  delete from auth.users where id = a;
  insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
    values (b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'songyisong88@gmail.com', now(), now(), now(), '{"provider":"email"}', '{}');
  out := out || jsonb_build_object('second_account_role', (select count(*) from public.admin_roles where user_id = b));
  -- 4 an ordinary confirmed sign-up -> nothing, and is_staff works for the owner
  insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
    values (c, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'someone@example.com', now(), now(), now(), '{"provider":"email"}', '{}');
  out := out || jsonb_build_object('other_user_role', (select count(*) from public.admin_roles where user_id = c));
  raise exception 'TEST_RESULT %', out;
end $$;
