-- ════════════════════════════════════════════════════════════════════════════
--  APOTHICAL PLANNER — Schéma cloud Supabase
--  À exécuter UNE FOIS dans : Supabase → SQL Editor → New query → Run
--
--  Modèle d'accès : LECTURE LIBRE (toute l'équipe consulte) /
--                   ÉCRITURE réservée au propriétaire connecté (pharmanantu@gmail.com)
-- ════════════════════════════════════════════════════════════════════════════

-- 1) Table : une ligne par mois (ex. "Juin 2026")
create table if not exists public.plans (
  mois        text primary key,             -- clé = libellé du mois ("Juin 2026")
  data        jsonb,                         -- { labos, placementIds, placementNotes, photoColIdx, fileName }
  plan_b64    text,                          -- plan pharmacie (image/pdf en base64) — optionnel
  excel_b64   text,                          -- fichier OPEAZ brut en base64 — optionnel
  stock       jsonb,                         -- export stock LGO { stock, meta }
  updated_at  timestamptz not null default now(),
  updated_by  text                           -- email de l'auteur de la dernière écriture
);

-- 2) Index pour le tri par fraîcheur (sync « cloud-wins »)
create index if not exists plans_updated_at_idx on public.plans (updated_at desc);

-- 3) Active la sécurité au niveau des lignes
alter table public.plans enable row level security;

-- 4) Politiques (on les recrée proprement à chaque exécution)
drop policy if exists "plans_read_public"  on public.plans;
drop policy if exists "plans_write_owner"  on public.plans;
drop policy if exists "plans_update_owner" on public.plans;
drop policy if exists "plans_delete_owner" on public.plans;

-- 4a) LECTURE : tout le monde (anon + authentifié) peut lire
create policy "plans_read_public"
  on public.plans for select
  using (true);

-- 4b) ÉCRITURE (insert) : uniquement le propriétaire connecté
create policy "plans_write_owner"
  on public.plans for insert
  with check ( (auth.jwt() ->> 'email') = 'pharmanantu@gmail.com' );

-- 4c) MISE À JOUR : uniquement le propriétaire connecté
create policy "plans_update_owner"
  on public.plans for update
  using      ( (auth.jwt() ->> 'email') = 'pharmanantu@gmail.com' )
  with check ( (auth.jwt() ->> 'email') = 'pharmanantu@gmail.com' );

-- 4d) SUPPRESSION : uniquement le propriétaire connecté
create policy "plans_delete_owner"
  on public.plans for delete
  using ( (auth.jwt() ->> 'email') = 'pharmanantu@gmail.com' );

-- ────────────────────────────────────────────────────────────────────────────
-- 5) Met à jour automatiquement updated_at à chaque écriture
create or replace function public.plans_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists plans_touch on public.plans;
create trigger plans_touch
  before insert or update on public.plans
  for each row execute function public.plans_touch_updated_at();

-- ════════════════════════════════════════════════════════════════════════════
--  RAPPEL CONFIG (après exécution) :
--   • Supabase → Authentication → Providers → Email : activer.
--   • Supabase → Authentication → Providers → désactiver "Allow new users to sign up"
--     (seul ton compte propriétaire doit exister).
--   • Crée ton compte une fois : Authentication → Users → Add user → pharmanantu@gmail.com.
--   • Récupère URL + clé "anon public" dans : Project Settings → API,
--     puis colle-les dans cloud.js (CLOUD_CONFIG).
-- ════════════════════════════════════════════════════════════════════════════
