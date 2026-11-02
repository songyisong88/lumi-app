-- LUMI 0002: notifications, catalog (products, options, secrets, files), drafts, listing rules + server-side validator
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind public.notif_kind not null,
  text text not null check (char_length(text) <= 300),
  link text check (char_length(link) <= 300),
  actor_id uuid references public.profiles(id) on delete set null,
  image text check (char_length(image) <= 300),
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_actor_idx on public.notifications (actor_id);
alter table public.notifications enable row level security;
grant select, delete on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
grant all on public.notifications to service_role;
create policy "read own notifications" on public.notifications for select to authenticated using (user_id = (select auth.uid()));
create policy "mark own notifications read" on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "delete own notifications" on public.notifications for delete to authenticated using (user_id = (select auth.uid()));

-- trusted helper used by triggers/RPCs to notify someone (never a self-notification)
create or replace function private.notify(p_user uuid, p_kind public.notif_kind, p_text text, p_link text, p_actor uuid default null, p_image text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_user is null or p_user = p_actor then return; end if;
  insert into public.notifications (user_id, kind, text, link, actor_id, image)
  values (p_user, p_kind, left(p_text, 300), left(p_link, 300), p_actor, left(p_image, 300));
end $$;
revoke execute on function private.notify(uuid, public.notif_kind, text, text, uuid, text) from anon, authenticated;

-- ---------- listing rules (generated from app/src/data/listingSpec.ts, required fields only)
create table private.listing_rules (
  sell_type public.sell_type not null,
  field_id text not null,
  label text not null,
  kind text not null check (kind in ('text','textarea','chips','multi','toggle','list','files')),
  step int not null,
  min_items int not null default 1,
  must_be_on boolean not null default false,
  cond_op text check (cond_op in ('on','includes','some_not','eq','neq')),
  cond_field text,
  cond_value text,
  sort int not null,
  primary key (sell_type, field_id)
);
revoke all on private.listing_rules from public, anon, authenticated;
insert into private.listing_rules (sell_type, field_id, label, kind, step, min_items, must_be_on, cond_op, cond_field, cond_value, sort) values
('img','files','ไฟล์ภาพที่ผู้ซื้อได้รับ','files',1,1,false,null,null,null,1),
('img','count','จำนวนภาพในชุด','text',1,1,false,null,null,null,2),
('img','resolution','ความละเอียด','chips',1,1,false,null,null,null,3),
('img','formats','นามสกุลไฟล์','multi',1,1,false,null,null,null,4),
('img','aspect','สัดส่วนภาพ','chips',2,1,false,null,null,null,5),
('img','prompt','พรอมต์ฉบับเต็ม','textarea',3,1,false,'on','sellPrompt',null,6),
('img','model','โมเดลที่ใช้','chips',3,1,false,'on','sellPrompt',null,7),
('img','settings','ค่าตั้งที่ใช้ (seed / stylize / ar)','text',3,1,false,'on','sellPrompt',null,8),
('img','licPreset','แบบสิทธิ์การใช้งาน','chips',4,1,false,null,null,null,9),
('img','licAllowed','ผู้ซื้อทำอะไรได้บ้าง','multi',4,1,false,null,null,null,10),
('tpl','apps','ต้องเปิดด้วยแอปอะไร','multi',1,1,false,null,null,null,11),
('tpl','appVersion','เวอร์ชันแอปที่ต้องใช้','text',1,1,false,null,null,null,12),
('tpl','canvaLink','ลิงก์ Canva แบบ “ใช้เป็นเทมเพลต”','text',1,1,false,'includes','apps','Canva',13),
('tpl','files','ไฟล์เทมเพลต','files',1,1,false,'some_not','apps','Canva',14),
('tpl','formats','ไฟล์ที่ผู้ซื้อได้รับ','multi',1,1,false,null,null,null,15),
('tpl','count','จำนวนแบบ / หน้า','text',1,1,false,null,null,null,16),
('tpl','size','ขนาดชิ้นงาน','text',1,1,false,null,null,null,17),
('tpl','fonts','ฟอนต์ที่ใช้ + ลิงก์โหลดฟรี','list',2,1,false,null,null,null,18),
('tpl','editable','แก้อะไรได้บ้าง','multi',2,1,false,null,null,null,19),
('tpl','howOpen','วิธีเปิดและแก้ไข (ทีละขั้น)','list',2,1,false,null,null,null,20),
('tpl','licPreset','แบบสิทธิ์การใช้งาน','chips',4,1,false,null,null,null,21),
('tpl','licAllowed','ผู้ซื้อทำอะไรได้บ้าง','multi',4,1,false,null,null,null,22),
('sw','sub','เป็นแบบไหน','chips',1,1,false,null,null,null,23),
('sw','files','ไฟล์ติดตั้ง','files',1,1,false,null,null,null,24),
('sw','platforms','ใช้กับเครื่องอะไรได้','multi',1,1,false,null,null,null,25),
('sw','minSpec','สเปกขั้นต่ำ','text',1,1,false,null,null,null,26),
('sw','version','เวอร์ชัน','text',1,1,false,null,null,null,27),
('sw','changelog','มีอะไรใหม่ (ประวัติอัปเดต)','list',1,1,false,null,null,null,28),
('sw','deps','ต้องติดตั้งอะไรเพิ่ม','text',2,1,false,null,null,null,29),
('sw','install','วิธีติดตั้ง (ทีละขั้น)','list',2,1,false,null,null,null,30),
('sw','trialDays','ทดลองได้กี่วัน','chips',3,1,false,'on','trial',null,31),
('sw','keyType','แบบคีย์ใช้งาน','chips',4,1,false,null,null,null,32),
('sw','activation','วิธีใส่คีย์ / เปิดใช้งาน','list',4,1,false,'neq','keyType','ไม่ต้องใช้คีย์',33),
('sw','support','ซัพพอร์ตและอัปเดต','text',4,1,false,null,null,null,34),
('sw','refund','เงื่อนไขคืนเงิน','text',4,1,false,null,null,null,35),
('sw','licPreset','แบบสิทธิ์การใช้งาน','chips',4,1,false,null,null,null,36),
('sw','licAllowed','ผู้ซื้อทำอะไรได้บ้าง','multi',4,1,false,null,null,null,37),
('game','sub','เป็นแบบไหน','chips',1,1,false,null,null,null,38),
('game','files','ไฟล์ติดตั้ง','files',1,1,false,null,null,null,39),
('game','platforms','ใช้กับเครื่องอะไรได้','multi',1,1,false,null,null,null,40),
('game','minSpec','สเปกขั้นต่ำ','text',1,1,false,null,null,null,41),
('game','version','เวอร์ชัน','text',1,1,false,null,null,null,42),
('game','changelog','มีอะไรใหม่ (ประวัติอัปเดต)','list',1,1,false,null,null,null,43),
('game','deps','ต้องติดตั้งอะไรเพิ่ม','text',2,1,false,null,null,null,44),
('game','install','วิธีติดตั้ง (ทีละขั้น)','list',2,1,false,null,null,null,45),
('game','trialDays','ทดลองได้กี่วัน','chips',3,1,false,'on','trial',null,46),
('game','keyType','แบบคีย์ใช้งาน','chips',4,1,false,null,null,null,47),
('game','activation','วิธีใส่คีย์ / เปิดใช้งาน','list',4,1,false,'neq','keyType','ไม่ต้องใช้คีย์',48),
('game','support','ซัพพอร์ตและอัปเดต','text',4,1,false,null,null,null,49),
('game','refund','เงื่อนไขคืนเงิน','text',4,1,false,null,null,null,50),
('game','licPreset','แบบสิทธิ์การใช้งาน','chips',4,1,false,null,null,null,51),
('game','licAllowed','ผู้ซื้อทำอะไรได้บ้าง','multi',4,1,false,null,null,null,52),
('bot','platform','ใช้กับแพลตฟอร์มไหน','multi',1,1,false,null,null,null,53),
('bot','buyerNeeds','ผู้ซื้อต้องมีบัญชี / API key อะไร','list',1,1,false,null,null,null,54),
('bot','features','บอททำอะไรได้บ้าง','list',2,1,false,null,null,null,55),
('bot','setupMode','การติดตั้ง','chips',2,1,false,null,null,null,56),
('bot','setup','ขั้นตอนติดตั้ง','list',2,1,false,null,null,null,57),
('bot','limits','ข้อจำกัด / โควตา','text',2,1,false,null,null,null,58),
('bot','trialDays','ทดลองได้กี่วัน','chips',3,1,false,'on','trial',null,59),
('bot','trialLink','ลิงก์ทดลองคุย','text',3,1,false,'on','trial',null,60),
('bot','support','ซัพพอร์ตและอัปเดต','text',4,1,false,null,null,null,61),
('bot','refund','เงื่อนไขคืนเงิน','text',4,1,false,null,null,null,62),
('bot','licPreset','แบบสิทธิ์การใช้งาน','chips',4,1,false,null,null,null,63),
('bot','licAllowed','ผู้ซื้อทำอะไรได้บ้าง','multi',4,1,false,null,null,null,64),
('course','lessons','บทเรียน (ชื่อตอน · ความยาว)','list',1,2,false,null,null,null,65),
('course','freeLessons','ดูฟรีได้กี่ตอน','chips',1,1,false,null,null,null,66),
('course','materials','ไฟล์ประกอบที่ได้','multi',1,1,false,null,null,null,67),
('course','level','ระดับ','chips',2,1,false,null,null,null,68),
('course','prereq','ต้องรู้หรือมีอะไรก่อนเรียน','text',2,1,false,null,null,null,69),
('course','duration','ความยาวรวม','text',2,1,false,null,null,null,70),
('course','outcomes','เรียนจบแล้วทำอะไรได้','list',2,1,false,null,null,null,71),
('course','access','ดูได้นานแค่ไหน','chips',4,1,false,null,null,null,72),
('course','refund','เงื่อนไขคืนเงิน','text',4,1,false,null,null,null,73),
('course','licPreset','แบบสิทธิ์การใช้งาน','chips',4,1,false,null,null,null,74),
('course','licAllowed','ผู้ซื้อทำอะไรได้บ้าง','multi',4,1,false,null,null,null,75),
('font','sub','เป็นแบบไหน','chips',1,1,false,null,null,null,76),
('font','files','ไฟล์ที่ผู้ซื้อได้รับ','files',1,1,false,null,null,null,77),
('font','formats','นามสกุลไฟล์','multi',1,1,false,null,null,null,78),
('font','count','จำนวนในชุด','text',1,1,false,null,null,null,79),
('font','languages','รองรับภาษา / ตัวอักษร','multi',2,1,false,'eq','sub','ฟอนต์',80),
('font','compat','ใช้กับแอปอะไรได้','text',2,1,false,null,null,null,81),
('font','install','วิธีติดตั้ง / ใช้งาน','list',2,1,false,null,null,null,82),
('font','licPreset','แบบสิทธิ์การใช้งาน','chips',4,1,false,null,null,null,83),
('font','licAllowed','ผู้ซื้อทำอะไรได้บ้าง','multi',4,1,false,null,null,null,84),
('hire','deliverables','งานที่ส่งมอบ','list',1,1,false,null,null,null,85),
('hire','formats','ไฟล์ที่ส่งให้','multi',1,1,false,null,null,null,86),
('hire','briefNeeds','ผู้ซื้อต้องเตรียมอะไรในบรีฟ','list',2,1,false,null,null,null,87),
('hire','timeline','ส่งงานภายใน','chips',3,1,false,null,null,null,88),
('hire','revisions','แก้ไขได้','chips',3,1,false,null,null,null,89),
('hire','rights','สิทธิ์ในงานที่ส่ง','chips',4,1,false,null,null,null,90),
('hire','refund','เงื่อนไขคืนเงิน','text',4,1,false,null,null,null,91),
('media','sub','เป็นแบบไหน','chips',1,1,false,null,null,null,92),
('media','files','ไฟล์ที่ผู้ซื้อได้รับ','files',1,1,false,null,null,null,93),
('media','count','จำนวนชิ้นในชุด','text',1,1,false,null,null,null,94),
('media','duration','ความยาว','text',1,1,false,null,null,null,95),
('media','formats','นามสกุลไฟล์','multi',1,1,false,null,null,null,96),
('media','quality','ความละเอียด / บิตเรต','chips',1,1,false,null,null,null,97),
('media','appVersion','แอปตัดต่อที่ต้องใช้ + เวอร์ชัน','text',1,1,false,'eq','sub','เทมเพลตตัดต่อวิดีโอ',98),
('media','aiTool','สร้างด้วยเครื่องมือ AI อะไร','chips',2,1,false,null,null,null,99),
('media','howUse','วิธีใช้งาน (ทีละขั้น)','list',2,1,false,null,null,null,100),
('media','noClone','ยืนยัน: ไม่ได้เลียนเสียงหรือหน้าบุคคลจริงโดยไม่ได้รับอนุญาต','toggle',4,1,true,null,null,null,101),
('media','musicLic','สิทธิ์เพลง / เสียง','chips',4,1,false,null,null,null,102),
('media','refund','เงื่อนไขคืนเงิน','text',4,1,false,null,null,null,103),
('media','licPreset','แบบสิทธิ์การใช้งาน','chips',4,1,false,null,null,null,104),
('media','licAllowed','ผู้ซื้อทำอะไรได้บ้าง','multi',4,1,false,null,null,null,105),
('skill','platforms','ใช้กับ AI agent ตัวไหน','multi',1,1,false,null,null,null,106),
('skill','files','ไฟล์สกิล','files',1,1,false,null,null,null,107),
('skill','contents','ในชุดมีไฟล์อะไรบ้าง','list',1,1,false,null,null,null,108),
('skill','version','เวอร์ชัน','text',1,1,false,null,null,null,109),
('skill','features','สกิลนี้ทำให้ agent ทำอะไรได้','list',2,1,false,null,null,null,110),
('skill','install','วิธีติดตั้ง (ทีละขั้น)','list',2,2,false,null,null,null,111),
('skill','buyerNeeds','ผู้ซื้อต้องมีบัญชี / แพ็กเกจอะไร','list',2,1,false,null,null,null,112),
('skill','support','ซัพพอร์ตและอัปเดต','text',4,1,false,null,null,null,113),
('skill','refund','เงื่อนไขคืนเงิน','text',4,1,false,null,null,null,114),
('skill','licPreset','แบบสิทธิ์การใช้งาน','chips',4,1,false,null,null,null,115),
('skill','licAllowed','ผู้ซื้อทำอะไรได้บ้าง','multi',4,1,false,null,null,null,116),
('data','files','ไฟล์ชุดข้อมูล','files',1,1,false,null,null,null,117),
('data','formats','รูปแบบไฟล์','multi',1,1,false,null,null,null,118),
('data','size','ขนาด (แถว · คอลัมน์ · MB)','text',1,1,false,null,null,null,119),
('data','columns','คอลัมน์ / โครงสร้างข้อมูล','list',2,2,false,null,null,null,120),
('data','source','แหล่งที่มาของข้อมูล','textarea',2,1,false,null,null,null,121),
('data','updates','การอัปเดต','chips',2,1,false,null,null,null,122),
('data','useCases','นำไปใช้ทำอะไรได้','list',2,1,false,null,null,null,123),
('data','rights','ยืนยัน: ฉันมีสิทธิ์นำข้อมูลนี้มาขาย/แจกต่อ','toggle',4,1,true,null,null,null,124),
('data','noPII','ยืนยัน: ไม่มีข้อมูลส่วนบุคคล (ชื่อ เบอร์ อีเมล เลขบัตร ที่อยู่)','toggle',4,1,true,null,null,null,125),
('data','refund','เงื่อนไขคืนเงิน','text',4,1,false,null,null,null,126),
('data','licPreset','แบบสิทธิ์การใช้งาน','chips',4,1,false,null,null,null,127),
('data','licAllowed','ผู้ซื้อทำอะไรได้บ้าง','multi',4,1,false,null,null,null,128);

create or replace function private.spec_cond(p_spec jsonb, p_op text, p_field text, p_value text) returns boolean
language sql immutable set search_path = '' as $$
  select case
    when p_op is null then true
    when p_op = 'on' then coalesce(p_spec->p_field = 'true'::jsonb, false)
    when p_op = 'includes' then coalesce(jsonb_typeof(p_spec->p_field) = 'array' and (p_spec->p_field) ? p_value, false)
    when p_op = 'some_not' then exists (select 1 from jsonb_array_elements_text(case when jsonb_typeof(p_spec->p_field) = 'array' then p_spec->p_field else '[]'::jsonb end) e where e <> p_value)
    when p_op = 'eq' then coalesce(btrim(p_spec->>p_field), '') = p_value
    when p_op = 'neq' then coalesce(btrim(p_spec->>p_field), '') <> p_value
    else false end
$$;
create or replace function private.spec_filled(p_spec jsonb, p_kind text, p_field text, p_min int, p_must_on boolean) returns boolean
language sql immutable set search_path = '' as $$
  select case
    when p_kind = 'toggle' then (not p_must_on) or coalesce(p_spec->p_field = 'true'::jsonb, false)
    when p_kind in ('multi','list') then (select count(*) from jsonb_array_elements_text(case when jsonb_typeof(p_spec->p_field) = 'array' then p_spec->p_field else '[]'::jsonb end) e where btrim(e) <> '') >= p_min
    else coalesce(btrim(case when jsonb_typeof(p_spec->p_field) = 'string' then p_spec->>p_field end), '') <> ''
  end
$$;

-- ---------- products
create table public.products (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles(id) on delete cascade,
  sell_type public.sell_type not null,
  kind text not null default 'image',
  type_key text not null default 'img',
  layout text not null default 'img',
  label text check (char_length(label) <= 60),
  title text not null default '' check (char_length(title) <= 70),
  use_text text not null default '' check (char_length(use_text) <= 200),
  description text not null default '' check (char_length(description) <= 5000),
  tags text[] not null default '{}' check (cardinality(tags) <= 8),
  covers text[] not null default '{}' check (cardinality(covers) <= 6),
  spec jsonb not null default '{}' check (jsonb_typeof(spec) = 'object' and octet_length(spec::text) <= 60000),
  is_free boolean not null default false,
  tips_enabled boolean not null default false,
  price int not null default 0 check (price >= 0),
  has_prompt boolean not null default false,
  tryable boolean not null default false,
  instant boolean generated always as (sell_type <> 'hire') stored,
  days int,
  revisions int,
  status public.product_status not null default 'draft',
  favorite_count int not null default 0,
  sales_count int not null default 0,
  review_count int not null default 0,
  rating numeric(3,2),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index products_creator_idx on public.products (creator_id);
create index products_feed_idx on public.products (status, published_at desc);
create index products_type_idx on public.products (sell_type, status);
create index products_title_trgm on public.products using gin (title extensions.gin_trgm_ops);
create index products_tags_idx on public.products using gin (tags);

create table public.product_options (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  code text not null check (char_length(code) between 1 and 40),
  label text not null check (char_length(label) between 1 and 60),
  sub text not null default '' check (char_length(sub) <= 120),
  price int not null check (price between 0 and 1000000),
  suffix text check (char_length(suffix) <= 20),
  best text check (char_length(best) <= 40),
  enabled boolean not null default true,
  sort int not null default 0,
  unique (product_id, code)
);

-- data released to buyers only after payment (full prompt, Canva remix link, ...)
create table public.product_secrets (
  product_id uuid primary key references public.products(id) on delete cascade,
  data jsonb not null default '{}' check (jsonb_typeof(data) = 'object' and octet_length(data::text) <= 60000),
  updated_at timestamptz not null default now()
);

create table public.listing_drafts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  type public.sell_type,
  step int not null default 0 check (step between 0 and 6),
  title text not null default '' check (char_length(title) <= 70),
  use_text text not null default '' check (char_length(use_text) <= 200),
  description text not null default '' check (char_length(description) <= 5000),
  tags text[] not null default '{}' check (cardinality(tags) <= 8),
  covers text[] not null default '{}' check (cardinality(covers) <= 6),
  spec jsonb not null default '{}' check (jsonb_typeof(spec) = 'object' and octet_length(spec::text) <= 120000),
  is_free boolean not null default false,
  tips boolean not null default false,
  options jsonb not null default '[]' check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) <= 6),
  published_product_id uuid references public.products(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index listing_drafts_owner_idx on public.listing_drafts (owner_id, updated_at desc);
create index listing_drafts_product_idx on public.listing_drafts (published_product_id);
create trigger listing_drafts_touch before update on public.listing_drafts for each row execute function private.touch_updated_at();

-- every uploaded file (deliverables of a listing, chat attachments, hire deliveries)
create table public.product_files (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  product_id uuid references public.products(id) on delete cascade,
  draft_id uuid references public.listing_drafts(id) on delete set null,
  thread_id uuid,
  job_id uuid,
  role public.file_role not null default 'deliverable',
  bucket text not null default 'quarantine' check (bucket in ('quarantine','deliverables')),
  path text not null check (char_length(path) <= 400),
  name text not null check (char_length(name) between 1 and 200),
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 5368709120),
  mime text check (char_length(mime) <= 120),
  scan public.scan_status not null default 'pending',
  sha256 text check (sha256 ~ '^[0-9a-f]{64}$'),
  sort int not null default 0,
  created_at timestamptz not null default now(),
  unique (bucket, path)
);
create index product_files_owner_idx on public.product_files (owner_id);
create index product_files_product_idx on public.product_files (product_id);
create index product_files_draft_idx on public.product_files (draft_id);
create index product_files_thread_idx on public.product_files (thread_id);
create index product_files_job_idx on public.product_files (job_id);

-- ---------- validator
create or replace function private.listing_missing(p_product uuid, p_type public.sell_type, p_spec jsonb, p_title text, p_use text, p_desc text, p_covers text[], p_free boolean)
returns text[] language plpgsql stable security definer set search_path = '' as $$
declare
  missing text[] := '{}';
  full_spec jsonb := coalesce(p_spec, '{}'::jsonb) || coalesce((select s.data from public.product_secrets s where s.product_id = p_product), '{}'::jsonb);
  r record; n_ok int; n_bad int;
begin
  if coalesce(cardinality(p_covers), 0) < 1 then
    missing := array_append(missing, case when p_type = 'hire' then 'รูปผลงานตัวอย่าง (อย่างน้อย 1)' else 'รูปหน้าปก (อย่างน้อย 1)' end);
  end if;
  if char_length(btrim(coalesce(p_title, ''))) < 4 then missing := array_append(missing, 'ชื่อผลงาน (อย่างน้อย 4 ตัวอักษร)'); end if;
  if char_length(btrim(coalesce(p_use, ''))) < 4 then missing := array_append(missing, 'เหมาะกับใคร / ใช้ทำอะไร'); end if;
  if char_length(btrim(coalesce(p_desc, ''))) < 10 then missing := array_append(missing, 'รายละเอียด (อย่างน้อย 10 ตัวอักษร)'); end if;
  if not coalesce(p_free, false) and not exists (select 1 from public.product_options o where o.product_id = p_product and o.enabled and o.price > 0) then
    missing := array_append(missing, 'ราคา (เปิดขายอย่างน้อย 1 แบบ)');
  end if;
  for r in select * from private.listing_rules lr where lr.sell_type = p_type order by lr.sort loop
    continue when not private.spec_cond(full_spec, r.cond_op, r.cond_field, r.cond_value);
    if r.kind = 'files' then
      select count(*) filter (where f.scan = 'ok'), count(*) filter (where f.scan <> 'ok')
        into n_ok, n_bad from public.product_files f where f.product_id = p_product and f.role = 'deliverable';
      if n_ok < r.min_items then missing := array_append(missing, r.label);
      elsif n_bad > 0 then missing := array_append(missing, r.label || ' (มีไฟล์ที่ยังสแกนไวรัสไม่ผ่าน)');
      end if;
    elsif not private.spec_filled(full_spec, r.kind, r.field_id, r.min_items, r.must_be_on) then
      missing := array_append(missing, r.label);
    end if;
  end loop;
  return missing;
end $$;

create or replace function private.assert_listing_ok(p_product uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare p public.products; m text[];
begin
  select * into p from public.products where id = p_product;
  if not found or p.status <> 'published' then return; end if;
  m := private.listing_missing(p.id, p.sell_type, p.spec, p.title, p.use_text, p.description, p.covers, p.is_free);
  if cardinality(m) > 0 then
    raise exception 'LISTING_INCOMPLETE' using errcode = 'P0001', detail = array_to_string(m, ' | '), hint = 'ยังขาด ' || cardinality(m) || ' อย่าง';
  end if;
end $$;

create or replace function private.products_before() returns trigger
language plpgsql set search_path = '' as $$
declare m text[]; tm record;
begin
  select v.kind, v.type_key, v.layout, v.label into tm from (values
    ('img','image','img','img','ภาพ + พรอมต์'), ('tpl','image','tpl','tpl','เทมเพลต'), ('sw','image','tool','sw','โปรแกรม'),
    ('game','image','tool','sw','เกม'), ('bot','image','bot','bot','บอท'), ('course','course','course','course','คอร์สออนไลน์'),
    ('font','image','tpl','font','ฟอนต์'), ('hire','commission','svc','hire','งานจ้าง'), ('media','image','media','media','วิดีโอ เสียง เพลง'),
    ('skill','image','skill','skill','Agent Skills'), ('data','image','data','data','ชุดข้อมูล')
  ) v(st, kind, type_key, layout, label) where v.st = new.sell_type::text;
  new.kind := tm.kind; new.type_key := tm.type_key; new.layout := tm.layout;
  new.label := coalesce(nullif(btrim(new.label), ''), tm.label);
  new.spec := coalesce(new.spec, '{}'::jsonb) - 'prompt' - 'canvaLink' - 'files';   -- secrets live in product_secrets, files in product_files
  new.has_prompt := coalesce(new.spec->'sellPrompt' = 'true'::jsonb, false);
  new.tryable := coalesce(new.spec->'trial' = 'true'::jsonb, false);
  new.days := nullif(substring(coalesce(new.spec->>'timeline', '') from '(\d+)\s*วัน'), '')::int;
  new.revisions := nullif(substring(coalesce(new.spec->>'revisions', '') from '(\d+)'), '')::int;
  new.price := case when new.is_free then 0 else coalesce((select min(o.price) from public.product_options o where o.product_id = new.id and o.enabled and o.price > 0), 0) end;
  new.updated_at := now();
  if exists (select 1 from unnest(new.covers) c where c not like new.creator_id::text || '/%') then
    raise exception 'covers must be files in your own previews folder' using errcode = '22023';
  end if;
  if tg_op = 'INSERT' then
    if not private.bypass() then
      new.status := 'draft'; new.published_at := null;
      new.favorite_count := 0; new.sales_count := 0; new.review_count := 0; new.rating := null;
    end if;
  else
    if new.status is distinct from old.status and (old.status = 'removed' or new.status = 'removed') and not private.bypass() then
      raise exception 'only moderators can change a removed listing' using errcode = '42501';
    end if;
    if new.sell_type is distinct from old.sell_type and old.status <> 'draft' then
      raise exception 'unpublish (draft) the listing before changing its type' using errcode = '22023';
    end if;
  end if;
  if new.status = 'published' then
    new.published_at := coalesce(new.published_at, now());
    if tg_op = 'INSERT' or old.status <> 'published'
       or (new.spec, new.title, new.use_text, new.description, new.covers, new.is_free, new.sell_type)
          is distinct from (old.spec, old.title, old.use_text, old.description, old.covers, old.is_free, old.sell_type) then
      m := private.listing_missing(new.id, new.sell_type, new.spec, new.title, new.use_text, new.description, new.covers, new.is_free);
      if cardinality(m) > 0 then
        raise exception 'LISTING_INCOMPLETE' using errcode = 'P0001', detail = array_to_string(m, ' | '), hint = 'ยังขาด ' || cardinality(m) || ' อย่าง';
      end if;
    end if;
  end if;
  return new;
end $$;
create trigger products_before before insert or update on public.products for each row execute function private.products_before();

create or replace function private.product_children_after() returns trigger
language plpgsql security definer set search_path = '' as $$
declare pid uuid;
begin
  pid := coalesce(case when tg_op = 'DELETE' then null else new.product_id end, old.product_id);
  if pid is null then return null; end if;
  if tg_table_name = 'product_options' then
    update public.products set updated_at = now() where id = pid;   -- re-derives price
  end if;
  perform private.assert_listing_ok(pid);
  if tg_op = 'UPDATE' and tg_table_name = 'product_files' and old.product_id is distinct from new.product_id and old.product_id is not null then
    perform private.assert_listing_ok(old.product_id);
  end if;
  return null;
end $$;
create trigger product_options_after after insert or update or delete on public.product_options for each row execute function private.product_children_after();
create trigger product_secrets_after after insert or update or delete on public.product_secrets for each row execute function private.product_children_after();
create trigger product_files_after after insert or update or delete on public.product_files for each row execute function private.product_children_after();

create or replace function private.product_files_before() returns trigger
language plpgsql set search_path = '' as $$
begin
  if private.bypass() then return new; end if;
  if tg_op = 'INSERT' then
    new.owner_id := auth.uid();
    new.bucket := 'quarantine';
    new.scan := 'pending';
    new.sha256 := null;
    if new.path not like auth.uid()::text || '/%' then
      raise exception 'upload path must start with your user id' using errcode = '22023';
    end if;
  else
    if (new.bucket, new.path, new.scan, new.owner_id, new.size_bytes, new.sha256) is distinct from (old.bucket, old.path, old.scan, old.owner_id, old.size_bytes, old.sha256) then
      raise exception 'file storage fields are managed by LUMI' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
create trigger product_files_before before insert or update on public.product_files for each row execute function private.product_files_before();

grant execute on function private.listing_missing(uuid, public.sell_type, jsonb, text, text, text, text[], boolean), private.assert_listing_ok(uuid),
  private.spec_cond(jsonb, text, text, text), private.spec_filled(jsonb, text, text, int, boolean) to authenticated, service_role;

-- ---------- RLS + grants
alter table public.products enable row level security;
alter table public.product_options enable row level security;
alter table public.product_secrets enable row level security;
alter table public.listing_drafts enable row level security;
alter table public.product_files enable row level security;

grant select on public.products, public.product_options to anon, authenticated;
grant insert (creator_id, sell_type, label, title, use_text, description, tags, covers, spec, is_free, tips_enabled) on public.products to authenticated;
grant update (sell_type, label, title, use_text, description, tags, covers, spec, is_free, tips_enabled, status) on public.products to authenticated;
grant delete on public.products to authenticated;
grant insert (product_id, code, label, sub, price, suffix, best, enabled, sort) on public.product_options to authenticated;
grant update (label, sub, price, suffix, best, enabled, sort) on public.product_options to authenticated;
grant delete on public.product_options to authenticated;
grant select, insert, delete on public.product_secrets to authenticated;
grant update (data) on public.product_secrets to authenticated;
grant select, insert, delete on public.listing_drafts to authenticated;
grant update (type, step, title, use_text, description, tags, covers, spec, is_free, tips, options, published_product_id) on public.listing_drafts to authenticated;
grant select, delete on public.product_files to authenticated;
grant insert (product_id, draft_id, thread_id, job_id, role, path, name, size_bytes, mime, sort) on public.product_files to authenticated;
grant update (product_id, draft_id, name, sort) on public.product_files to authenticated;
grant all on public.products, public.product_options, public.product_secrets, public.listing_drafts, public.product_files to service_role;

create or replace function private.owns_product(p_product uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.products p where p.id = p_product and p.creator_id = auth.uid())
$$;
create or replace function private.product_visible(p_product uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.products p where p.id = p_product and (p.status = 'published' or p.creator_id = auth.uid()))
$$;
grant execute on function private.owns_product(uuid), private.product_visible(uuid) to anon, authenticated, service_role;

create policy "published or own products" on public.products for select to anon, authenticated
  using (status = 'published' or creator_id = (select auth.uid()));
create policy "create own products" on public.products for insert to authenticated
  with check (creator_id = (select auth.uid()));
create policy "edit own products" on public.products for update to authenticated
  using (creator_id = (select auth.uid())) with check (creator_id = (select auth.uid()));
create policy "delete own unsold drafts" on public.products for delete to authenticated
  using (creator_id = (select auth.uid()) and status = 'draft');

create policy "options of visible products" on public.product_options for select to anon, authenticated
  using ((select private.product_visible(product_id)));
create policy "add options to own products" on public.product_options for insert to authenticated
  with check ((select private.owns_product(product_id)));
create policy "edit options of own products" on public.product_options for update to authenticated
  using ((select private.owns_product(product_id))) with check ((select private.owns_product(product_id)));
create policy "delete options of own products" on public.product_options for delete to authenticated
  using ((select private.owns_product(product_id)));

create policy "creator writes secrets" on public.product_secrets for insert to authenticated
  with check ((select private.owns_product(product_id)));
create policy "creator edits secrets" on public.product_secrets for update to authenticated
  using ((select private.owns_product(product_id))) with check ((select private.owns_product(product_id)));
create policy "creator deletes secrets" on public.product_secrets for delete to authenticated
  using ((select private.owns_product(product_id)));
-- select policy (creator + paid buyers) is created in 0004 once entitlements exist

create policy "own drafts" on public.listing_drafts for select to authenticated using (owner_id = (select auth.uid()));
create policy "create own drafts" on public.listing_drafts for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "edit own drafts" on public.listing_drafts for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()) and (published_product_id is null or (select private.owns_product(published_product_id))));
create policy "delete own drafts" on public.listing_drafts for delete to authenticated using (owner_id = (select auth.uid()));
