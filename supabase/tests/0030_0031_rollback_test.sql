-- Run AFTER the 0030 + 0031 SQL inside one transaction; always ends with an exception so nothing is kept.
do $$
declare
  c uuid := '6120f8e1-ecf0-435c-8838-b297a74cabfc';  -- lumi-qa-creator1 (test)
  b1 uuid := 'd27c8cd3-cf28-4a29-8cdd-580a66c10273'; -- lumi-qa-buyer1 (test)
  b2 uuid := '6ede628c-40a0-4f48-b2ff-a6a883824a66'; -- lumi-qa-buyer2 (test)
  b3 uuid := 'edfe2c5e-b8f6-44e2-a864-e145d795c7bd'; -- lumi-qa-buyer3 (test)
  out jsonb := '{}'; p uuid; p2 uuid; i int; e text; n int; prod uuid; f uuid; j record; v text; prod2 uuid; prod3 uuid;
begin
  -- helper pattern: become a user
  -- 1 rate limit posts (5 / 10 min)
  perform set_config('request.jwt.claims', json_build_object('sub', b1, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  begin
    for i in 1..6 loop insert into public.posts (body, tag) values ('qa rate ' || i, 'ถาม-ตอบ'); end loop;
    out := out || '{"rate_limit":"NOT TRIGGERED"}';
  exception when others then out := out || jsonb_build_object('rate_limit', sqlerrm, 'rate_posts_kept', (select count(*) from public.posts where body like 'qa rate %')); end;
  execute 'reset role';

  -- 2 creator posts, 3 people report -> auto hidden
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  insert into public.posts (body, tag) values ('qa creator post', 'ถาม-ตอบ') returning id into p;
  begin insert into public.reports (target_type, target_id, reason) values ('post', p::text, 'spam'); out := out || '{"report_own":"ALLOWED?!"}';
  exception when others then out := out || jsonb_build_object('report_own', sqlerrm); end;
  execute 'reset role';
  foreach f in array array[b1, b2, b3] loop
    perform set_config('request.jwt.claims', json_build_object('sub', f, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    insert into public.reports (target_type, target_id, reason, details) values ('post', p::text, 'spam', 'qa');
    execute 'reset role';
  end loop;
  out := out || jsonb_build_object('post_after_3_reports', (select status from public.posts where id = p),
     'owner_notified', (select count(*) from public.notifications where user_id = c and kind = 'moderation' and created_at > now() - interval '1 minute'),
     'audit_auto_hidden', (select count(*) from public.audit_log where action = 'report.auto_hidden' and target_id = p::text));
  -- b1 sees it? (hidden -> no)
  perform set_config('request.jwt.claims', json_build_object('sub', b1, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  out := out || jsonb_build_object('b1_sees_hidden_post', (select count(*) from public.posts where id = p));
  begin insert into public.reports (target_type, target_id, reason) values ('post', p::text, 'spam'); out := out || '{"dup_report":"ALLOWED?!"}';
  exception when others then out := out || jsonb_build_object('dup_report', sqlstate); end;
  begin insert into public.reports (target_type, target_id, reason) values ('post', gen_random_uuid()::text, 'spam'); out := out || '{"report_missing":"ALLOWED?!"}';
  exception when others then out := out || jsonb_build_object('report_missing', sqlerrm); end;
  out := out || jsonb_build_object('b1_sees_reports', (select count(*) from public.reports));
  execute 'reset role';
  -- restore by "moderator" (dismiss) needs staff: check refusal for b1
  perform set_config('request.jwt.claims', json_build_object('sub', b1, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  begin perform public.resolve_reports('post', p::text, 'dismiss', null); out := out || '{"resolve_by_user":"ALLOWED?!"}';
  exception when others then out := out || jsonb_build_object('resolve_by_user', sqlerrm); end;
  execute 'reset role';

  -- 3 block: b2 blocks creator; creator's visible post; b2 cannot comment; b2 cannot see c posts
  perform private.set_bypass(true);
  insert into public.posts (author_id, body, tag) values (c, 'qa visible post', 'ถาม-ตอบ') returning id into p2;
  insert into public.follows (follower_id, creator_id) values (b2, c) on conflict do nothing;
  perform private.set_bypass(false);
  perform set_config('request.jwt.claims', json_build_object('sub', b2, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  out := out || jsonb_build_object('b2_sees_c_post_before_block', (select count(*) from public.posts where id = p2));
  insert into public.user_blocks (target_id, kind) values (c, 'block');
  out := out || jsonb_build_object('b2_sees_c_post_after_block', (select count(*) from public.posts where id = p2),
    'follow_removed', not exists (select 1 from public.follows where follower_id = b2 and creator_id = c));
  begin insert into public.comments (post_id, body) values (p2, 'qa'); out := out || '{"comment_when_blocked":"ALLOWED?!"}';
  exception when others then out := out || jsonb_build_object('comment_when_blocked', sqlerrm); end;
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  begin insert into public.follows (follower_id, creator_id) values (c, b2); out := out || '{"blocked_user_follow":"ALLOWED?!"}';
  exception when others then out := out || jsonb_build_object('blocked_user_follow', sqlerrm); end;
  execute 'reset role';
  -- anon still sees visible post
  execute 'set local role anon';
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  out := out || jsonb_build_object('anon_sees_visible_post', (select count(*) from public.posts where id = p2),
                                   'anon_comments_ok', (select count(*) >= 0 from public.comments),
                                   'anon_stories_ok', (select count(*) >= 0 from public.stories));
  execute 'reset role';

  -- 4 content rules: block + flag
  insert into private.content_rules (pattern, action, note) values ('qa-blocked-word', 'block', 'qa');
  perform set_config('request.jwt.claims', json_build_object('sub', b3, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  begin insert into public.posts (body, tag) values ('hello qa-blocked-word', 'ถาม-ตอบ'); out := out || '{"content_block":"ALLOWED?!"}';
  exception when others then out := out || jsonb_build_object('content_block', sqlerrm); end;
  insert into public.posts (body, tag) values ('free keygen here', 'ถาม-ตอบ') returning id into p;
  execute 'reset role';
  out := out || jsonb_build_object('content_flag_report', (select count(*) from public.reports where source = 'system' and target_id = p::text));

  -- 5 sanctions
  insert into private.user_sanctions (user_id, kind, reason) values (b3, 'mute', 'qa');
  perform set_config('request.jwt.claims', json_build_object('sub', b3, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  begin insert into public.posts (body, tag) values ('qa muted', 'ถาม-ตอบ'); out := out || '{"muted_post":"ALLOWED?!"}';
  exception when others then out := out || jsonb_build_object('muted_post', sqlerrm); end;
  -- 6 export + trash
  out := out || jsonb_build_object('export_keys', (select count(*) from jsonb_object_keys(public.export_my_data())));
  delete from public.posts where id = p;
  begin perform public.restore_deleted(1); out := out || '{"restore_by_user":"ALLOWED?!"}';
  exception when others then out := out || jsonb_build_object('restore_by_user', sqlerrm); end;
  execute 'reset role';
  out := out || jsonb_build_object('trash_row', (select count(*) from private.trash where table_name = 'posts' and row_id = p::text));
  -- restore as admin
  insert into public.admin_roles (user_id, role) values (b1, 'admin');
  select id into i from private.trash where table_name = 'posts' and row_id = p::text;
  perform set_config('request.jwt.claims', json_build_object('sub', b1, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select private.restore_deleted(i) into v;
  execute 'reset role';
  out := out || jsonb_build_object('restored', v, 'post_back', exists (select 1 from public.posts where id = p));
  delete from public.admin_roles where user_id = b1;

  -- 7 scan pipeline: sw listing with .exe needs deep scan before going live
  -- (the listing-completeness triggers are switched off inside this rolled-back test only, so a tiny fake listing can be used)
  alter table public.products disable trigger products_before;
  alter table public.products disable trigger products_0_rules;
  alter table public.product_files disable trigger product_files_after;
  perform private.set_bypass(true);
  insert into public.products (creator_id, sell_type, title, status, review_status, is_free) values (c, 'sw', 'QA app', 'published', 'pending_review', true) returning id into prod;
  insert into public.product_files (owner_id, product_id, role, bucket, path, name, size_bytes, scan)
    values (c, prod, 'deliverable', 'deliverables', 'files/qa/app.exe', 'app.exe', 100, 'ok') returning id into f;
  perform private.set_bypass(false);
  out := out || jsonb_build_object('jobs', (select jsonb_agg(tier || ':' || status) from public.scan_jobs where file_id = f));
  begin v := private.decide_internal(prod, 'approve', null, null, true); out := out || jsonb_build_object('approve_without_deep', v);
  exception when others then out := out || jsonb_build_object('approve_without_deep', sqlerrm); end;
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  execute 'set local role service_role';
  select * into j from public.scan_claim('deep', 'clamav-qa', 'qa');
  perform public.scan_finish(j.job_id, 'clean', null, '{"qa":true}');
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
  v := private.decide_internal(prod, 'approve', null, null, true);
  out := out || jsonb_build_object('claimed_file_matches', j.file_id = f, 'approve_after_deep', v);
  -- client cannot claim scans
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  begin perform public.scan_claim('deep', 'x', 'x'); out := out || '{"client_scan_claim":"ALLOWED?!"}';
  exception when others then out := out || jsonb_build_object('client_scan_claim', sqlstate); end;
  out := out || jsonb_build_object('creator_sees_own_scan_jobs', (select count(*) from public.scan_jobs where file_id = f));
  execute 'reset role';
  -- infected -> scan fail + notify
  perform private.set_bypass(true);
  insert into public.product_files (owner_id, product_id, role, bucket, path, name, size_bytes, scan)
    values (c, prod, 'deliverable', 'deliverables', 'files/qa/app2.exe', 'app2.exe', 100, 'ok') returning id into f;
  perform private.set_bypass(false);
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  execute 'set local role service_role';
  select * into j from public.scan_claim('deep', 'clamav-qa', 'qa');
  perform public.scan_finish(j.job_id, 'infected', 'Eicar-Test-Signature', null);
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
  out := out || jsonb_build_object('infected_file_scan', (select scan from public.product_files where id = f));

  -- 8 AI review (enabled only inside this test)
  update private.settings set value = value || '{"enabled": true, "auto_approve": true, "auto_reject": true, "provider": "qa"}' where key = 'ai_review';
  perform private.set_bypass(true);
  insert into public.products (creator_id, sell_type, title, status, review_status, is_free) values (c, 'img', 'QA ai ok', 'published', 'pending_review', true) returning id into prod;
  insert into public.products (creator_id, sell_type, title, status, review_status, is_free) values (c, 'img', 'QA ai bad', 'published', 'pending_review', true) returning id into prod2;
  insert into public.products (creator_id, sell_type, title, status, review_status, is_free) values (c, 'bot', 'QA ai bot', 'published', 'pending_review', true) returning id into prod3;
  perform private.set_bypass(false);
  out := out || jsonb_build_object('ai_queued', (select count(*) from public.ai_reviews where product_id in (prod, prod2, prod3)));
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  execute 'set local role service_role';
  for i in 1..3 loop
    select * into j from public.ai_review_claim('qa');
    v := public.ai_review_finish(j.job_id, case when j.product_id = prod2 then 'reject' else 'approve' end, 'nsfw', 'ภาพไม่เหมาะสม', 0.97, '{}', 'qa', 'qa-model', 0.0001, null);
    out := out || jsonb_build_object('ai_' || (j.listing ->> 'title'), v);
  end loop;
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
  out := out || jsonb_build_object('ai_status', (select jsonb_object_agg(title, review_status) from public.products where id in (prod, prod2, prod3)),
     'ai_audit_role', (select actor_role from public.audit_log where action = 'listing.approve' and target_id = prod::text order by created_at desc limit 1));
  -- disabled -> nothing queued
  update private.settings set value = value || '{"enabled": false}' where key = 'ai_review';
  perform private.set_bypass(true);
  insert into public.products (creator_id, sell_type, title, status, review_status, is_free) values (c, 'img', 'QA ai off', 'published', 'pending_review', true) returning id into prod;
  perform private.set_bypass(false);
  out := out || jsonb_build_object('ai_queued_when_disabled', (select count(*) from public.ai_reviews where product_id = prod));

  -- 9 signup flood guard
  update private.settings set value = '{"signup_global": [[0, 3600]]}' where key = 'rate_limits';
  begin
    insert into auth.users (id, instance_id, aud, role, email) values (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'qa-flood@mailinator.com');
    out := out || '{"signup_guard":"ALLOWED?!"}';
  exception when others then out := out || jsonb_build_object('signup_guard', sqlerrm); end;

  -- 10 grants
  out := out || jsonb_build_object('anon_truncate_left', (select count(*) from information_schema.role_table_grants where grantee in ('anon','authenticated') and privilege_type = 'TRUNCATE' and table_schema = 'public'));
  raise exception 'RESULTS: %', out::text;
end $$;
