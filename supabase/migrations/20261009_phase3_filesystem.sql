-- MiniFS Phase 3: user-owned metadata plus a persisted simulated block map.
create table if not exists public.fs_directories (
  id uuid primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(btrim(name)) > 0),
  parent_id uuid references public.fs_directories(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (owner_id, parent_id, name)
);

create table if not exists public.fs_files (
  id uuid primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  parent_id uuid not null references public.fs_directories(id) on delete cascade,
  name text not null check (length(btrim(name)) > 0),
  content text not null default '',
  size_bytes integer not null check (size_bytes >= 0),
  allocation_method text not null check (allocation_method in ('contiguous', 'linked', 'indexed')),
  data_block_ids integer[] not null default '{}',
  index_block_id integer,
  created_at timestamptz not null default now(),
  modified_at timestamptz not null default now(),
  unique (owner_id, parent_id, name)
);

create table if not exists public.fs_virtual_disks (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  root_directory_id uuid not null references public.fs_directories(id) on delete restrict,
  default_allocation_method text not null check (default_allocation_method in ('contiguous', 'linked', 'indexed')),
  total_blocks integer not null check (total_blocks > 0),
  block_size_bytes integer not null check (block_size_bytes > 0),
  blocks jsonb not null check (jsonb_typeof(blocks) = 'array'),
  updated_at timestamptz not null default now()
);

create index if not exists fs_directories_owner_parent_idx on public.fs_directories(owner_id, parent_id);
create index if not exists fs_files_owner_parent_idx on public.fs_files(owner_id, parent_id);

alter table public.fs_directories enable row level security;
alter table public.fs_files enable row level security;
alter table public.fs_virtual_disks enable row level security;

-- This helper deliberately runs as the migration owner so RLS policies can
-- validate a parent directory without recursively invoking the policy on
-- fs_directories itself.
create or replace function public.current_user_owns_directory(directory_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.fs_directories directory
    where directory.id = directory_id
      and directory.owner_id = auth.uid()
  );
$$;

revoke all on function public.current_user_owns_directory(uuid) from public;
grant execute on function public.current_user_owns_directory(uuid) to authenticated;

drop policy if exists "Users manage their directories" on public.fs_directories;
drop policy if exists "Users manage their files" on public.fs_files;
drop policy if exists "Users manage their virtual disk" on public.fs_virtual_disks;

create policy "Users manage their directories" on public.fs_directories
  for all to authenticated
  using (owner_id = auth.uid())
  with check (
    owner_id = auth.uid()
    and (parent_id is null or public.current_user_owns_directory(parent_id))
  );
create policy "Users manage their files" on public.fs_files
  for all to authenticated
  using (owner_id = auth.uid())
  with check (
    owner_id = auth.uid()
    and public.current_user_owns_directory(parent_id)
  );
create policy "Users manage their virtual disk" on public.fs_virtual_disks
  for all to authenticated
  using (owner_id = auth.uid())
  with check (
    owner_id = auth.uid()
    and public.current_user_owns_directory(root_directory_id)
  );

-- A snapshot is committed in one database transaction. The API has already
-- validated the simulation state; this function enforces identity and writes
-- all user records atomically.
create or replace function public.save_filesystem_snapshot(p_snapshot jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  root_id uuid := (p_snapshot->>'rootDirectoryId')::uuid;
begin
  if current_user_id is null then
    raise exception 'Authentication is required';
  end if;
  if jsonb_typeof(p_snapshot->'directories') <> 'array'
     or jsonb_typeof(p_snapshot->'files') <> 'array'
     or jsonb_typeof(p_snapshot->'disk'->'blocks') <> 'array' then
    raise exception 'Invalid MiniFS snapshot';
  end if;

  delete from public.fs_files where owner_id = current_user_id;
  delete from public.fs_virtual_disks where owner_id = current_user_id;
  delete from public.fs_directories where owner_id = current_user_id;

  insert into public.fs_directories (id, owner_id, name, parent_id, created_at)
  select (entry->>'id')::uuid, current_user_id, entry->>'name',
    nullif(entry->>'parentId', '')::uuid, (entry->>'createdAt')::timestamptz
  from jsonb_array_elements(p_snapshot->'directories') entry;

  if not exists (select 1 from public.fs_directories where id = root_id and owner_id = current_user_id and parent_id is null) then
    raise exception 'Snapshot root directory is invalid';
  end if;

  -- Even though this function bypasses table RLS to write an atomic snapshot,
  -- no child may point at another user's directory.
  if exists (
    select 1
    from public.fs_directories directory
    left join public.fs_directories parent on parent.id = directory.parent_id
    where directory.owner_id = current_user_id
      and directory.parent_id is not null
      and (parent.id is null or parent.owner_id <> current_user_id)
  ) then
    raise exception 'Snapshot contains an invalid directory parent';
  end if;

  insert into public.fs_files (
    id, owner_id, parent_id, name, content, size_bytes, allocation_method,
    data_block_ids, index_block_id, created_at, modified_at
  )
  select
    (entry->>'id')::uuid, current_user_id, (entry->>'parentId')::uuid,
    entry->>'name', entry->>'content', octet_length(entry->>'content'),
    entry->>'allocationMethod',
    coalesce(array(select jsonb_array_elements_text(entry->'dataBlockIds')::integer), '{}'),
    nullif(entry->>'indexBlockId', '')::integer,
    (entry->>'createdAt')::timestamptz, (entry->>'modifiedAt')::timestamptz
  from jsonb_array_elements(p_snapshot->'files') entry;

  if exists (
    select 1
    from public.fs_files file
    join public.fs_directories parent on parent.id = file.parent_id
    where file.owner_id = current_user_id
      and parent.owner_id <> current_user_id
  ) then
    raise exception 'Snapshot contains an invalid file parent';
  end if;

  insert into public.fs_virtual_disks (
    owner_id, root_directory_id, default_allocation_method, total_blocks,
    block_size_bytes, blocks, updated_at
  ) values (
    current_user_id, root_id, p_snapshot->>'defaultAllocationMethod',
    (p_snapshot->'disk'->>'totalBlocks')::integer,
    (p_snapshot->'disk'->>'blockSizeBytes')::integer,
    p_snapshot->'disk'->'blocks', now()
  );
end;
$$;

grant execute on function public.save_filesystem_snapshot(jsonb) to authenticated;
