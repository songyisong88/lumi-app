-- LUMI 0006: storage buckets + object policies
-- previews:     PUBLIC  covers, avatars, post images, watermarked samples. Path: <user_id>/<file>
-- quarantine:   PRIVATE every deliverable lands here first, waits for the virus scan. Path: <user_id>/<draft|thread>/<file>
-- deliverables: PRIVATE scanned files; only the server writes; buyers read through short-lived signed URLs.
--               Path: products/<product_id>/<file> or threads/<thread_id>/<file>
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('previews', 'previews', true, 10485760, array['image/jpeg','image/png','image/webp','image/gif','image/avif','video/mp4','audio/mpeg']),
  ('quarantine', 'quarantine', false, 52428800, null),
  ('deliverables', 'deliverables', false, 52428800, null)
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- previews: owner-only writes inside their own folder; reads go through the public CDN URL (no listing policy)
create policy "previews: own folder select" on storage.objects for select to authenticated
  using (bucket_id = 'previews' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "previews: upload to own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'previews' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "previews: replace own" on storage.objects for update to authenticated
  using (bucket_id = 'previews' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'previews' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "previews: delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'previews' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- quarantine: owner-only
create policy "quarantine: own select" on storage.objects for select to authenticated
  using (bucket_id = 'quarantine' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "quarantine: upload own" on storage.objects for insert to authenticated
  with check (bucket_id = 'quarantine' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "quarantine: replace own" on storage.objects for update to authenticated
  using (bucket_id = 'quarantine' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'quarantine' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "quarantine: delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'quarantine' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- deliverables: read only when entitled (creator, paying buyer, chat member; hire deliveries after acceptance). No client writes.
create policy "deliverables: entitled download" on storage.objects for select to authenticated
  using (bucket_id = 'deliverables' and (select private.can_download(bucket_id, name)));
