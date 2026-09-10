-- P1-007 — Le fuseau horaire du membre.
--
-- Les quiet hours (spec §5.3) sont « 21 h–7 h **heure locale du membre** ». La
-- seule donnée de fuseau du produit est `tenants.timezone` (le fuseau de la
-- box) ; le membre voyage, s'entraîne dans une box de Paris depuis New York. On
-- ajoute donc le fuseau **sur la personne**.
--
-- **Nullable, sans défaut** — à la différence de `tenants.timezone` qui vaut
-- `'Europe/Paris'`. `null` veut dire « pas encore connu » et déclenche le repli
-- sur le fuseau de la box, calculé là où la règle s'applique
-- (`notification_eligibility`, `coalesce(users.timezone, tenants.timezone)`).
-- Pas de CHECK de validité IANA, comme `tenants.timezone` n'en a pas : une
-- valeur inconnue passée à `at time zone` lève d'elle-même.
alter table public.users add column timezone text;

comment on column public.users.timezone is
  'Fuseau IANA du membre (spec §5.3, littéral). null => repli tenants.timezone. Écrit par l''app depuis expo-localization.';

-- Le grant de colonne est **cumulatif** : il s'ajoute aux six colonnes déjà
-- accordées à `authenticated` (`20260831103203:25`, `20260901140000:71`), il ne
-- les remplace pas. `timezone` devient donc éditable par le membre lui-même,
-- comme `locale` — la policy `users_self_update` (`20260830143106:338`,
-- `id = auth.uid()`) borne la **ligne**, ce grant borne la **colonne** (« la RLS
-- ne borne pas les colonnes », `.claude/rules/database.md`). `email` reste hors
-- liste et gelé par `forbid_email_change` ; `id`/dates restent hors liste.
grant update (timezone) on public.users to authenticated;
