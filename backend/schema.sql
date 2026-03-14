create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  created_at timestamptz default now()
);

create table public.trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  destination text not null,
  start_date date not null,
  end_date date not null,
  created_at timestamptz default now()
);

create table public.activity_blocks (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  day_index integer not null,
  place_name text not null,
  resolved_place_id text,
  resolved_place_name text,
  resolved_lat numeric(10,6),
  resolved_lng numeric(10,6),
  activity_type text not null default 'other',
  energy_cost_estimate integer check (energy_cost_estimate between 1 and 10),
  start_time timestamptz not null,
  end_time timestamptz not null,
  created_at timestamptz default now()
);

create table public.check_ins (
  id uuid primary key default gen_random_uuid(),
  activity_block_id uuid not null references public.activity_blocks(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  energy_level integer not null check (energy_level between 1 and 10),
  current_lat numeric(10,6) not null,
  current_lng numeric(10,6) not null,
  agent_outcome text check (agent_outcome in ('affirmed', 'rerouted', 'dismissed')),
  selected_place_id text,
  selected_place_name text,
  timestamp timestamptz default now()
);

-- Row Level Security
alter table public.users enable row level security;
alter table public.trips enable row level security;
alter table public.activity_blocks enable row level security;
alter table public.check_ins enable row level security;

create policy "own_user" on public.users for all using (auth.uid() = id);
create policy "own_trips" on public.trips for all using (auth.uid() = user_id);
create policy "own_blocks" on public.activity_blocks for all
  using (exists (
    select 1 from public.trips where id = trip_id and user_id = auth.uid()
  ));
create policy "own_checkins" on public.check_ins for all using (auth.uid() = user_id);
