-- ---------------------------------------------------------------------------
-- P1-026 — Un cours ponctuel, sans série d'un jour
-- ---------------------------------------------------------------------------
--
-- L'usage réel du pilote (14 septembre 2026) : poser un cours unique — une
-- compétition, un séminaire, un rattrapage — obligeait à créer une série d'un
-- jour, qui encombrait la liste des séries pour toujours.
--
-- `schedule_id` devient nullable. L'invariant qui rend le montage sûr :
-- **une occurrence sans série est PAR CONSTRUCTION dérogatoire**
-- (`is_override = true`), donc aucun rafraîchissement ne la balaie. Double
-- ceinture, et les deux moitiés sont réelles :
--
--   1. les deux refresh (`materialize_class_occurrences`, celui des séances)
--      joignent `classes.schedule_id = s.id` — un NULL n'y correspond jamais ;
--   2. la contrainte ci-dessous interdit d'insérer le cas qui échapperait à
--      la première : `schedule_id` NULL sans le drapeau.
--
-- Ce qui ne bouge PAS, vérifié avant d'écrire :
--   - la FK composite `classes_schedule_same_tenant` est en MATCH SIMPLE :
--     une colonne NULL la désactive proprement, rien à modifier ;
--   - l'index unique `(schedule_id, starts_at)` ignore les NULL (distincts) :
--     deux ponctuels à la même heure restent possibles, comme deux séries ;
--   - policies et grants : l'insertion reste aux admins (`classes_insert`),
--     `schedule_id` est déjà dans la liste de colonnes du grant — un NULL
--     s'insère sans nouveau droit.
--
-- Piège 12 (« une CHECK qui s'évalue à NULL passe ») : les deux termes rendent
-- un booléen franc — `is not null` ne rend jamais NULL, `is_override` est
-- `not null`.
--
-- Réversible : `alter table public.classes alter column schedule_id set not
-- null` + `drop constraint classes_ponctuel_est_derogatoire`, après avoir
-- archivé les ponctuels.

alter table public.classes
  alter column schedule_id drop not null;

alter table public.classes
  add constraint classes_ponctuel_est_derogatoire
  check (schedule_id is not null or is_override);

comment on table public.classes is
  'Occurrence matérialisée en UTC. P1-003 réserve cette ligne sous verrou et modifie booked_count. schedule_id NULL = cours ponctuel (P1-026), dérogatoire par construction : aucun refresh de série ne le touche.';
