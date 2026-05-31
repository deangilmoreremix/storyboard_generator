-- Storyboards table
create table storyboards (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users,
    scene_description text,
    screenplay text,
    image_url text,
    panels jsonb,
    video_job_id text,
    video_error text,
    created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Video generations table for tracking
create table video_generations (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users,
    storyboard_id uuid references storyboards(id),
    job_id text,
    prompt text,
    status text default 'processing',
    video_url text,
    error text,
    created_at timestamp with time zone default timezone('utc'::text, now()),
    completed_at timestamp with time zone
);

-- Enable RLS
alter table storyboards enable row level security;
alter table video_generations enable row level security;

-- Policies
create policy "storyboards_select" on storyboards for select using (auth.uid() = user_id);
create policy "storyboards_insert" on storyboards for insert with check (auth.uid() = user_id);
create policy "storyboards_update" on storyboards for update using (auth.uid() = user_id);
create policy "storyboards_delete" on storyboards for delete using (auth.uid() = user_id);

create policy "video_generations_select" on video_generations for select using (auth.uid() = user_id);
create policy "video_generations_insert" on video_generations for insert with check (auth.uid() = user_id);
create policy "video_generations_update" on video_generations for update using (auth.uid() = user_id);
create policy "video_generations_delete" on video_generations for delete using (auth.uid() = user_id);