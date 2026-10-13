-- A placeholder. Production's migration history holds version 20261006161037, "shine_products_bucket_policies": a
-- change made in production by hand on 6 Oct 2026, outside this repository and its production job, for another
-- project (a storage bucket of its own and two policies on storage.objects for that bucket alone). It touches no
-- table, bucket or policy of this app.
--
-- Deliberately empty: a database built from zero (locally, in CI, at go-live) never gets that bucket or those
-- policies. The file exists so that main and production's history hold the same migrations (V181), without which
-- `supabase db push` refuses to run. Production already holds this version, so the push never runs this file there.
-- Whether the bucket and its policies stay in production is the owner's call, never a migration's.
select 1;
