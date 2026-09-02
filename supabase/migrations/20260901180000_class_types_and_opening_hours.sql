-- Le référentiel de la box : ce qu'elle propose, et quand elle est ouverte.
--
-- Premières tables métier depuis le socle. Toute la liste de
-- `.claude/rules/database.md` s'applique : `tenant_id not null`, RLS `enable`
-- **et** `force`, policies par commande, index avec `tenant_id` en tête,
-- **droits de table explicites** (les privilèges par défaut du schéma ont été
-- révoqués en `20260901140000` : une table sans grant échoue en
-- `permission denied`, ce qui est le but).

-- ---------------------------------------------------------------------------
-- class_types — le catalogue des cours proposés
-- ---------------------------------------------------------------------------

-- `classes.class_type_id` pointera ici en P1-002 (spec §7.3). La contrainte
-- d'unicité composite `(id, tenant_id)` plus bas est posée **maintenant** pour
-- que cette clé étrangère puisse être composite elle aussi — c'est la leçon de
-- `rooms_location_same_tenant` : une FK simple laisserait un cours de la box A
-- référencer un type de cours de la box B, et le `with check` de la policy, qui
-- ne regarde que `tenant_id`, n'y verrait rien.
create table public.class_types (
  id uuid primary key default public.uuid_generate_v7(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  -- Convention `*_i18n` de la spec §7.3, comme `plans.name_i18n`.
  -- La forme est contrainte **par la base**, pas seulement par Zod : une langue
  -- non supportée ne peut pas entrer par un client mal écrit ou par un script.
  name_i18n jsonb not null,
  description_i18n jsonb,
  duration_minutes integer not null,
  -- Couleur de la pastille au planning. C'est une **donnée de la box**, pas un
  -- token de thème : la règle 7 interdit les couleurs en dur dans le style, pas
  -- qu'une box choisisse la couleur de son WOD. L'information ne repose jamais
  -- sur elle seule — le nom du type est toujours affiché à côté.
  color text not null default '#E4572E',
  default_capacity integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  -- `is not null` en tête, et ce n'est pas de la ceinture-bretelles : une
  -- contrainte CHECK qui s'évalue à NULL **passe**. Sans ce premier terme,
  -- `{"en": "…"}` donnait `jsonb_typeof(null) = 'string'` → NULL, donc
  -- accepté — un nom sans français serait entré en base sous une contrainte qui
  -- prétend l'interdire. Trouvé par le test, pas par la relecture.
  constraint class_types_name_has_fr check (
    name_i18n -> 'fr' is not null
    and jsonb_typeof(name_i18n -> 'fr') = 'string'
    and length(trim(name_i18n ->> 'fr')) > 0
  ),
  constraint class_types_name_locales check (
    name_i18n - array['fr', 'en'] = '{}'::jsonb
  ),
  constraint class_types_description_locales check (
    description_i18n is null
    or description_i18n - array['fr', 'en'] = '{}'::jsonb
  ),
  -- 5 minutes à 8 heures. Les bornes ne prétendent pas connaître le métier :
  -- elles arrêtent les fautes de frappe (0, 900) avant qu'un planning entier
  -- soit généré dessus.
  constraint class_types_duration_sane check (duration_minutes between 5 and 480),
  constraint class_types_color_hex check (color ~* '^#[0-9a-f]{6}$'),
  constraint class_types_capacity_positive check (default_capacity > 0)
);

create index class_types_tenant_idx on public.class_types (tenant_id, created_at desc);
alter table public.class_types add constraint class_types_id_tenant_key unique (id, tenant_id);

-- Deux « WOD » dans la même box sont une erreur de saisie, pas un choix. Le
-- français fait foi parce que c'est la seule langue dont la présence est
-- garantie par `class_types_name_has_fr`.
create unique index class_types_name_key
  on public.class_types (tenant_id, lower(name_i18n ->> 'fr'))
  where deleted_at is null;

create trigger class_types_set_updated_at before update on public.class_types
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- opening_hours — les horaires d'ouverture, récurrents par jour de semaine
-- ---------------------------------------------------------------------------

-- **Une table, pas un `jsonb` sur `tenant_settings`.** Ces horaires ont un
-- consommateur SQL, pas seulement un formulaire : P1-002 génère le planning
-- récurrent à partir d'eux, l'open gym et le check-in les liront ensuite. Une
-- donnée qu'une fonction PLpgSQL doit joindre et contrôler dans une transaction
-- ne va pas dans un `jsonb`.
--
-- **`time` nu, jamais `timetz`.** Ces heures sont l'heure **locale de la box**,
-- interprétée dans `tenants.timezone` — comme toutes les règles métier du
-- projet (règle 9). `timetz` porte un décalage fixe, pas un fuseau : il se
-- trompe à chaque changement d'heure, et PostgreSQL lui-même le déconseille.
-- Sans cette phrase, quelqu'un les convertira un jour en UTC en croyant bien
-- faire, et la box ouvrira à 7 h en hiver et à 8 h en été.
--
-- **Les dérogations datées sont nommées ici, pas construites.** « Fermé le
-- 25 décembre », « horaires d'août » : ce sera une table `opening_exceptions`
-- avec ses dates, jamais une colonne `date` bricolée dans celle-ci. Une table
-- hebdomadaire qui se met à porter des exceptions cesse d'être hebdomadaire.
--
-- **Le chevauchement de deux créneaux le même jour n'est pas garanti ici.**
-- L'interdire demanderait `btree_gist` et un type intervalle sur des `time`,
-- que PostgreSQL ne fournit pas — donc un type maison, pour une box qui a deux
-- lignes par jour. La validation est côté Zod (`overlappingSlots`), et la
-- limite est écrite plutôt que prétendue : ne pas croire, en lisant cette
-- table, que la base l'interdit.
create table public.opening_hours (
  id uuid primary key default public.uuid_generate_v7(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  -- 0 = lundi … 6 = dimanche. La semaine commence là où elle commence en France.
  weekday smallint not null,
  opens_at time not null,
  closes_at time not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint opening_hours_weekday_range check (weekday between 0 and 6),
  -- Strict : un créneau de durée nulle n'est pas une ouverture. Un créneau qui
  -- passe minuit se saisit en deux lignes, une par jour.
  constraint opening_hours_order check (closes_at > opens_at)
);

create index opening_hours_tenant_idx on public.opening_hours (tenant_id, weekday);

create trigger opening_hours_set_updated_at before update on public.opening_hours
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.class_types enable row level security;
alter table public.class_types force row level security;
alter table public.opening_hours enable row level security;
alter table public.opening_hours force row level security;

-- Policies **par commande**, jamais un `for all` doublé d'un `_select` : les
-- policies permissives s'additionnent, et la garde de rôle du `for all`
-- deviendrait inerte en lecture (piège 6 de `.claude/rules/database.md`).
--
-- Lecture pour tout membre : les deux tables peignent le planning et la page
-- publique de la box. Écriture pour OWNER et MANAGER — c'est de l'opérationnel,
-- et la frontière du back-office se coupe **par table** : l'identité de la box
-- (`tenants`) reste au seul propriétaire, l'opérationnel s'ouvre au
-- gestionnaire, qui écrit déjà dans `tenant_settings`, `locations` et `rooms`.
--
-- `current_admin_tenant_ids()` plutôt que `current_tenant_role(tenant_id)` :
-- évaluée une fois par requête au lieu d'une fois par ligne (D-001).
--
-- Pas de policy `delete` : un type de cours retiré a des cours passés qui le
-- référencent, un créneau supprimé a un historique. `deleted_at` (règle 10).
create policy class_types_select on public.class_types for select to authenticated
  using (tenant_id in (select public.current_tenant_ids()));
create policy class_types_insert on public.class_types for insert to authenticated
  with check (tenant_id in (select public.current_admin_tenant_ids()));
create policy class_types_update on public.class_types for update to authenticated
  using (tenant_id in (select public.current_admin_tenant_ids()))
  with check (tenant_id in (select public.current_admin_tenant_ids()));

create policy opening_hours_select on public.opening_hours for select to authenticated
  using (tenant_id in (select public.current_tenant_ids()));
create policy opening_hours_insert on public.opening_hours for insert to authenticated
  with check (tenant_id in (select public.current_admin_tenant_ids()));
create policy opening_hours_update on public.opening_hours for update to authenticated
  using (tenant_id in (select public.current_admin_tenant_ids()))
  with check (tenant_id in (select public.current_admin_tenant_ids()));

-- ---------------------------------------------------------------------------
-- Droits de table — le miroir exact des policies ci-dessus
-- ---------------------------------------------------------------------------

-- Sans ces deux lignes, les policies seraient du code mort : `alter default
-- privileges … revoke all` (migration `20260901140000`) fait que toute nouvelle
-- table naît sans aucun droit pour `anon` et `authenticated`. C'est voulu — les
-- deux couches se posent ensemble, ou le test structurel les signale.
--
-- Ni `delete`, ni `truncate` : la première n'a pas de policy, la seconde
-- échappe à la RLS par construction.
grant select, insert, update on public.class_types to authenticated;
grant select, insert, update on public.opening_hours to authenticated;

comment on table public.class_types is
  'Catalogue des cours d''une box. Cible de classes.class_type_id (P1-002).';
comment on table public.opening_hours is
  'Horaires d''ouverture récurrents. time en heure LOCALE de la box (tenants.timezone), jamais UTC. Les dérogations datées viendront dans opening_exceptions.';
