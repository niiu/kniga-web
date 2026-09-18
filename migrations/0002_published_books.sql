create table if not exists published_books (
  id text primary key,
  title text not null,
  source text not null,
  scene_count integer not null default 0,
  story_json text not null,
  created_at timestamptz not null default now()
);

create index if not exists published_books_created_at_idx
  on published_books (created_at desc);
