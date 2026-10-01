-- ตั้งค่าฐานข้อมูลสำหรับระบบเช็กการเข้าเรียนแบบ Vercel + Supabase
-- วิธีใช้: Supabase > SQL Editor > วางทั้งไฟล์ > Run
-- ก่อนรัน ให้แก้อีเมลผู้สอนที่บรรทัด "ใส่อีเมลผู้สอน" ท้ายไฟล์ (หลังสร้างบัญชีผู้สอนที่ Authentication > Users แล้ว)

-- ---------- ตาราง ----------
create table if not exists public.teachers (
  user_id uuid primary key references auth.users (id) on delete cascade
);

create table if not exists public.classes (
  id         text primary key check (char_length(id) between 1 and 40),
  created_at timestamptz not null default now()
);

create table if not exists public.events (
  id           bigint generated always as identity primary key,
  class_id     text not null references public.classes (id) on delete cascade,
  student_id   uuid not null default auth.uid(),
  student_name text not null check (char_length(student_name) between 1 and 60),
  type         text not null check (type in (
                 'join', 'share_started', 'share_stopped', 'share_rejected',
                 'heartbeat_sharing', 'heartbeat_stopped')),
  surface      text check (surface is null or char_length(surface) <= 20),
  created_at   timestamptz not null default now()   -- เวลาจากเซิร์ฟเวอร์ ผู้เรียนแก้ไม่ได้
);
create index if not exists events_class_id_idx on public.events (class_id, id);

create table if not exists public.thumbs (
  class_id     text not null references public.classes (id) on delete cascade,
  student_id   uuid not null default auth.uid(),
  student_name text not null check (char_length(student_name) between 1 and 60),
  data         text not null check (char_length(data) < 400000),
  updated_at   timestamptz not null default now(),
  primary key (class_id, student_id)
);
-- ขยายเพดานขนาดภาพสำหรับฐานข้อมูลที่สร้างตารางไว้แล้ว (เดิม 60000 ใช้กับภาพกว้าง 240 พิกเซล)
alter table public.thumbs drop constraint if exists thumbs_data_check;
alter table public.thumbs add constraint thumbs_data_check check (char_length(data) < 400000);
create index if not exists thumbs_updated_idx on public.thumbs (class_id, updated_at);

-- ตั้ง updated_at จากเวลาเซิร์ฟเวอร์เสมอ
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists thumbs_touch on public.thumbs;
create trigger thumbs_touch before insert or update on public.thumbs
  for each row execute function public.touch_updated_at();

-- ---------- ตรวจว่าเป็นผู้สอนหรือไม่ ----------
create or replace function public.is_teacher()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.teachers where user_id = (select auth.uid()))
$$;
revoke all on function public.is_teacher() from public;
grant execute on function public.is_teacher() to authenticated;

-- ---------- สิทธิ์ระดับตาราง (ผู้ใช้ที่ยังไม่ล็อกอินเข้าถึงอะไรไม่ได้เลย) ----------
revoke all on public.teachers, public.classes, public.events, public.thumbs from anon;
grant select                          on public.teachers to authenticated;
grant select, insert, delete          on public.classes  to authenticated;
grant select, insert, delete          on public.events   to authenticated;
grant select, insert, update, delete  on public.thumbs   to authenticated;

-- ---------- Row Level Security ----------
alter table public.teachers enable row level security;
alter table public.classes  enable row level security;
alter table public.events   enable row level security;
alter table public.thumbs   enable row level security;

-- ผู้เรียนเข้าระบบแบบ Anonymous sign-in (ได้ role authenticated เหมือนกัน) จึงแยกผู้สอนด้วยตาราง teachers
drop policy if exists "teachers read self" on public.teachers;
create policy "teachers read self" on public.teachers
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "classes teacher select" on public.classes;
create policy "classes teacher select" on public.classes
  for select to authenticated using (public.is_teacher());
drop policy if exists "classes teacher insert" on public.classes;
create policy "classes teacher insert" on public.classes
  for insert to authenticated with check (public.is_teacher());
drop policy if exists "classes teacher delete" on public.classes;
create policy "classes teacher delete" on public.classes
  for delete to authenticated using (public.is_teacher());

-- events: ผู้เรียนเพิ่มได้เฉพาะของตัวเอง (class_id ต้องมีอยู่จริงตาม foreign key) / ผู้สอนอ่านและลบได้
drop policy if exists "events student insert" on public.events;
create policy "events student insert" on public.events
  for insert to authenticated with check (student_id = (select auth.uid()));
drop policy if exists "events teacher select" on public.events;
create policy "events teacher select" on public.events
  for select to authenticated using (public.is_teacher());
drop policy if exists "events teacher delete" on public.events;
create policy "events teacher delete" on public.events
  for delete to authenticated using (public.is_teacher());

-- thumbs: ผู้เรียนเขียนทับได้เฉพาะภาพของตัวเอง / ผู้สอนอ่านได้ทุกภาพ
drop policy if exists "thumbs student insert" on public.thumbs;
create policy "thumbs student insert" on public.thumbs
  for insert to authenticated with check (student_id = (select auth.uid()));
drop policy if exists "thumbs student update" on public.thumbs;
create policy "thumbs student update" on public.thumbs
  for update to authenticated
  using (student_id = (select auth.uid())) with check (student_id = (select auth.uid()));
drop policy if exists "thumbs select own or teacher" on public.thumbs;
create policy "thumbs select own or teacher" on public.thumbs
  for select to authenticated using (student_id = (select auth.uid()) or public.is_teacher());
drop policy if exists "thumbs teacher delete" on public.thumbs;
create policy "thumbs teacher delete" on public.thumbs
  for delete to authenticated using (public.is_teacher());

-- ---------- ใส่อีเมลผู้สอน (แก้บรรทัดนี้ก่อนรัน) ----------
insert into public.teachers (user_id)
select id from auth.users where email = 'ใส่อีเมลผู้สอน@example.com'
on conflict do nothing;
