-- =============================================================
-- 0010_pgvector_doctor_embeddings.sql
-- Civic Access (Team Liquid / KayApp)
--
-- Enables pgvector extension, adds a 768-dimensional vector embedding
-- column to public.doctors for semantic specialist matching, builds an
-- IVFFlat approximate nearest-neighbour index, and creates a cosine
-- similarity search RPC function.
-- =============================================================

-- 1. Enable pgvector extension (pre-installed in Supabase)
create extension if not exists vector;

-- 2. Add nullable embedding column (768 dimensions for Gemini text-embedding-004)
alter table public.doctors
  add column if not exists embedding vector(768);

-- 3. Create IVFFlat approximate nearest-neighbour index for cosine distance
-- lists = 100 is optimized for ~200-500 doctor records
create index if not exists doctors_embedding_idx
  on public.doctors using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- 4. Supabase RPC function for semantic doctor matching
create or replace function match_doctors_by_embedding(
  query_embedding vector(768),
  match_count int default 20
)
returns table(id uuid, similarity float)
language sql stable
as $$
  select id, 1 - (embedding <=> query_embedding) as similarity
  from public.doctors
  where embedding is not null
  order by embedding <=> query_embedding
  limit match_count;
$$;
