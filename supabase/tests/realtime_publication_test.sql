-- P1-005a — Ce qui part vers le service Realtime.
--
-- ---------------------------------------------------------------------------
-- Ce que ce fichier établit, et ce qu'il n'établit pas
-- ---------------------------------------------------------------------------
--
-- Il établit **ce que Postgres publie**. Il n'établit rien de ce que Realtime
-- *livre* : c'est un service séparé, qui évalue `classes_select` pour chaque
-- abonné avec son propre JWT, dans un processus qu'aucun test de ce dépôt ne
-- touche. Un vert ici ne se lit **jamais** « le canal est isolé » — cette
-- question-là ne se répond qu'à deux comptes et deux tenants, à la main, et le
-- ticket le dit aussi.
--
-- Ce que ce fichier attrape en revanche, et que rien d'autre n'attraperait :
-- **une table ajoutée à la publication sans qu'on y pense.** C'est la règle des
-- sœurs appliquée à un objet qui n'est ni une policy ni un grant, donc que
-- `rls_leak_test.sql` ne regarde pas, et que `rls-auditor` ne verrait que si le
-- diff la contenait. Une publication est une surface de sortie : elle mérite
-- une liste close, pas une liste qui s'allonge.

begin;
select plan(7);

-- ---------------------------------------------------------------------------
-- Structurel — la publication porte ce qu'on croit
-- ---------------------------------------------------------------------------

select ok(
  exists (select 1 from pg_publication where pubname = 'supabase_realtime'),
  'la publication supabase_realtime existe — elle vient du socle du CLI, pas de nos migrations'
);

select ok(
  exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'classes'
  ),
  'public.classes y est : sans ça, aucun compteur ne bouge sur un second écran'
);

-- **La liste est close, et c'est l'assertion qui compte.** `classes` est la
-- seule table dont un changement part vers tous les abonnés de la box. Le jour
-- où quelqu'un ajoute `bookings` ou `memberships` à cette publication — pour
-- faire vivre un écran, avec les meilleures intentions — ce test rougit et pose
-- la question avant que la donnée parte.
--
-- **Et `memberships` est le cas piégé, donc il est nommé ici.** Une publication
-- **ne connaît pas les `grant` de colonne** : `add table` publie la ligne
-- entière telle qu'elle est sur le disque. `memberships` est protégée par un
-- grant de colonne qui exclut `hidden_from_roster` — une opposition RGPD
-- (`20260905090000_class_roster.sql:91`) — et un `add table` nu la republierait
-- à tout membre actif de la box, rouvrant par le transport ce que P1-003c a
-- fermé par le privilège. Le geste juste est la liste de colonnes explicite, la
-- même que le grant. Détail dans `.claude/rules/database.md`.
--
-- `classes`, elle, est accordée en `select` sur la table entière : la publier
-- n'ouvre rien qu'un `select` n'ouvrait déjà. C'est ce qui rend P1-005a sûre,
-- et ce n'est pas une propriété qui se généralise.
select is(
  (select coalesce(string_agg(schemaname || '.' || tablename, ', ' order by schemaname, tablename), '')
     from pg_publication_tables where pubname = 'supabase_realtime'),
  'public.classes',
  'une seule table publiée, et c''est une décision : toute autre est à justifier ici'
);

-- `replica identity` reste `default` (la clé primaire). En `full`, Postgres
-- mettrait **toutes** les colonnes de l'ancienne ligne dans le WAL, et Realtime
-- les enverrait à chaque abonné dans `old_record`. On n'a besoin que du nouvel
-- enregistrement ; le reste est de la donnée diffusée pour rien.
select is(
  (select relreplident from pg_class where oid = 'public.classes'::regclass),
  'd'::"char",
  'replica identity `default` : on ne diffuse pas l''ancienne ligne en entier'
);

-- ---------------------------------------------------------------------------
-- Comportemental — la policy que Realtime évaluera dit bien ce qu'on croit
-- ---------------------------------------------------------------------------
--
-- Un contrôle structurel dit que la forme est bonne, un contrôle comportemental
-- dit que ça se comporte bien (D-001, D-006). Ici : Realtime décidera de livrer
-- ou non en évaluant `classes_select`. Ce que ce test peut prouver, c'est que
-- **cette policy-là** ne rend pas les cours d'une autre box. Que Realtime
-- l'applique reste hors de portée.

select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'classes' and policyname = 'classes_select'
      and cmd = 'SELECT' and 'authenticated' = any (roles)
  ),
  'classes_select existe et vise `authenticated` — c''est elle que Realtime évaluera par abonné'
);

-- Le décor est celui du seed, exercé par le vrai chemin — `set local role`, pas
-- un superutilisateur qui verrait tout.
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"33333333-0000-4000-8000-000000000001","role":"authenticated","email":"lea@example.com"}';

-- **Le contrôle positif d'abord, et il n'est pas décoratif.** L'assertion
-- suivante — « aucun cours d'une autre box » — passerait toute seule si Léa ne
-- voyait *rien du tout* : une policy cassée dans l'autre sens, un seed vide, un
-- rôle mal posé, et le vert dirait « isolé » alors qu'il dit « aveugle ». C'est
-- exactement le faux vert que D-001 a rattrapé sur `rls_leak_test.sql`.
select cmp_ok(
  (select count(*) from public.classes),
  '>',
  0::bigint,
  'Léa voit les cours de sa box — sans quoi l''assertion suivante ne prouverait rien'
);

select is(
  (
    select count(*)
      from public.classes c
     where c.tenant_id not in (select public.current_tenant_ids())
  ),
  0::bigint,
  'aucun cours hors des box de l''appelant n''est lisible — le prédicat que Realtime rejouera'
);

reset role;
select * from finish();
rollback;
