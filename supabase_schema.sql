-- Hapus tabel jika sudah ada sebelumnya agar tidak bentrok
drop table if exists messages;
drop table if exists group_members;
drop table if exists groups;
drop table if exists conversations;
drop table if exists users;

-- ==========================================
-- 1. Tabel Users
-- Mengambil data dari auth.users secara otomatis
-- ==========================================
create table public.users (
  user_id uuid references auth.users(id) on delete cascade not null primary key,
  username text not null,
  email text not null,
  status text default 'online',
  profile_picture text,
  created_at timestamptz default now()
);

-- Mengaktifkan Row Level Security (RLS)
alter table public.users enable row level security;
-- Policy: Semua orang yang login bisa melihat user lain
create policy "Users are viewable by everyone" on public.users for select using (auth.role() = 'authenticated');
-- Policy: User hanya bisa mengubah datanya sendiri
create policy "Users can insert their own profile" on public.users for insert with check (auth.uid() = user_id);
create policy "Users can update own profile" on public.users for update using (auth.uid() = user_id);

-- ==========================================
-- 2. Tabel Conversations (Chat Pribadi)
-- ==========================================
create table public.conversations (
  id uuid default gen_random_uuid() primary key,
  user1_id uuid references public.users(user_id) on delete cascade not null,
  user2_id uuid references public.users(user_id) on delete cascade not null,
  created_at timestamptz default now(),
  unique (user1_id, user2_id)
);

alter table public.conversations enable row level security;
-- Policy: User hanya bisa melihat percakapan mereka sendiri
create policy "Users can view their conversations" on public.conversations 
  for select using (auth.uid() = user1_id or auth.uid() = user2_id);
create policy "Users can insert conversations they are part of" on public.conversations 
  for insert with check (auth.uid() = user1_id or auth.uid() = user2_id);

-- ==========================================
-- 3. Tabel Groups
-- ==========================================
create table public.groups (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  profile_picture text,
  created_at timestamptz default now()
);

alter table public.groups enable row level security;
create policy "Groups are viewable by authenticated users" on public.groups for select using (auth.role() = 'authenticated');
create policy "Authenticated users can create groups" on public.groups for insert with check (auth.role() = 'authenticated');

-- ==========================================
-- 4. Tabel Group Members
-- ==========================================
create table public.group_members (
  group_id uuid references public.groups(id) on delete cascade not null,
  user_id uuid references public.users(user_id) on delete cascade not null,
  role text default 'member', -- 'admin' atau 'member'
  joined_at timestamptz default now(),
  primary key (group_id, user_id)
);

alter table public.group_members enable row level security;
create policy "Group members viewable by authenticated users" on public.group_members for select using (auth.role() = 'authenticated');
create policy "Users can join groups" on public.group_members for insert with check (auth.role() = 'authenticated');

-- ==========================================
-- 5. Tabel Messages
-- ==========================================
create table public.messages (
  id uuid default gen_random_uuid() primary key,
  conversation_id uuid references public.conversations(id) on delete cascade,
  group_id uuid references public.groups(id) on delete cascade,
  sender_id uuid references public.users(user_id) on delete cascade not null,
  content text,
  message_type text default 'text',
  image_url text,
  timestamp timestamptz default now(),
  check (
    (conversation_id is not null and group_id is null) or 
    (conversation_id is null and group_id is not null)
  )
);

alter table public.messages enable row level security;
-- Policy: User bisa melihat pesan di conversation-nya
create policy "Users can view messages in their conversations" on public.messages
  for select using (
    exists (
      select 1 from public.conversations c 
      where c.id = messages.conversation_id 
      and (c.user1_id = auth.uid() or c.user2_id = auth.uid())
    )
    or
    exists (
      select 1 from public.group_members gm
      where gm.group_id = messages.group_id
      and gm.user_id = auth.uid()
    )
  );

-- Policy: User bisa mengirim pesan jika dia sender_id dan anggota chat tersebut
create policy "Users can insert their own messages" on public.messages
  for insert with check (auth.uid() = sender_id);


-- ==========================================
-- 6. Trigger Otomatis Pembuatan User
-- Ketika ada user baru yang register di Supabase Auth,
-- otomatis masukkan datanya ke tabel public.users
-- ==========================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (user_id, email, username)
  values (
    new.id, 
    new.email, 
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1))
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ==========================================
-- 7. Realtime Publication
-- Aktifkan realtime untuk tabel messages agar fungsi chat berfungsi
-- ==========================================
begin;
  -- Hapus publikasi lama jika ada
  drop publication if exists supabase_realtime;
  create publication supabase_realtime;
commit;
alter publication supabase_realtime add table public.messages;
