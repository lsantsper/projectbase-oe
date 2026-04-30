-- ─── Diary: Open Points ───────────────────────────────────────────────────────

create table if not exists open_points (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references projects(id) on delete cascade,
  title         text not null,
  description   text,
  status        text not null default 'open' check (status in ('open', 'resolved')),
  priority      text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  responsible   text,
  due_date      date,
  resolved_at   timestamptz,
  resolved_by   text,
  resolution    text,
  linked_entry_id uuid,
  created_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now()
);

create index if not exists open_points_project_id_idx on open_points(project_id);

alter table open_points enable row level security;

create policy "Users can manage open points of their projects"
  on open_points for all
  using (
    exists (
      select 1 from projects p
      where p.id = open_points.project_id
        and p.created_by = auth.uid()
    )
  );

-- ─── Diary: Meeting Logs ──────────────────────────────────────────────────────

create table if not exists meeting_logs (
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid not null references projects(id) on delete cascade,
  title             text not null,
  date              date not null,
  duration_minutes  integer,
  location          text,
  attendees         text,
  objective         text,
  notes             text,
  linked_entry_id   uuid,
  items             jsonb not null default '[]'::jsonb,
  created_by        uuid references auth.users(id) on delete set null,
  created_at        timestamptz not null default now()
);

create index if not exists meeting_logs_project_id_idx on meeting_logs(project_id);

alter table meeting_logs enable row level security;

create policy "Users can manage meeting logs of their projects"
  on meeting_logs for all
  using (
    exists (
      select 1 from projects p
      where p.id = meeting_logs.project_id
        and p.created_by = auth.uid()
    )
  );

-- ─── Diary: History ───────────────────────────────────────────────────────────

create table if not exists history (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references projects(id) on delete cascade,
  event           text not null,
  title           text not null,
  detail          text,
  linked_id       uuid,
  linked_type     text check (linked_type in ('entry', 'risk', 'meeting', 'open_point')),
  is_manual_note  boolean not null default false,
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now()
);

create index if not exists history_project_id_idx on history(project_id);

alter table history enable row level security;

create policy "Users can manage history of their projects"
  on history for all
  using (
    exists (
      select 1 from projects p
      where p.id = history.project_id
        and p.created_by = auth.uid()
    )
  );

-- ─── Diary: Comments ──────────────────────────────────────────────────────────

create table if not exists diary_comments (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references projects(id) on delete cascade,
  parent_type  text not null check (parent_type in ('open_point', 'meeting', 'history')),
  parent_id    uuid not null,
  author_name  text not null,
  text         text not null,
  created_at   timestamptz not null default now()
);

create index if not exists diary_comments_project_id_idx on diary_comments(project_id);
create index if not exists diary_comments_parent_id_idx  on diary_comments(parent_id);

alter table diary_comments enable row level security;

create policy "Users can manage diary comments of their projects"
  on diary_comments for all
  using (
    exists (
      select 1 from projects p
      where p.id = diary_comments.project_id
        and p.created_by = auth.uid()
    )
  );

-- ─── Storage: project-files bucket ───────────────────────────────────────────
-- Run separately in the Supabase dashboard (Storage > New bucket):
--   name: project-files
--   public: false
--
-- Then add the policy below via SQL editor:

-- insert into storage.buckets (id, name, public)
-- values ('project-files', 'project-files', false)
-- on conflict do nothing;

-- create policy "Authenticated users can upload project files"
--   on storage.objects for insert
--   with check (bucket_id = 'project-files' and auth.role() = 'authenticated');

-- create policy "Authenticated users can read project files"
--   on storage.objects for select
--   using (bucket_id = 'project-files' and auth.role() = 'authenticated');

-- create policy "Authenticated users can delete their project files"
--   on storage.objects for delete
--   using (bucket_id = 'project-files' and auth.role() = 'authenticated');
