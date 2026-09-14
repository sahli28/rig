-- ---------------------------------------------------------------------------
-- P1-027 — la feuille des inscrits porte le nom complet, pour le staff
-- ---------------------------------------------------------------------------
--
-- Décision commanditaire du 14 septembre 2026, prise à l'usage réel du
-- pilote : le staff gère la box, et une feuille d'appel de salle porte des
-- noms complets — « prénom + initiale » y faisait deviner qui est qui.
-- L'exception à la règle commune d'identité est **datée et nommée** dans
-- `.claude/rules/privacy.md` (point 3), mise à jour dans ce même commit.
-- Ni e-mail, ni téléphone, ni naissance n'entrent : la ligne reste celle-là.
--
-- Le pendant, posé le même jour dans `P1-008b` AVANT que le kiosque soit
-- codé : une surface semi-publique (tablette à l'entrée) ne consomme JAMAIS
-- cette vue — projection minimisée obligatoire. `last_initial` reste servi
-- ici, précisément pour que cette projection existe déjà.
--
-- **La portée ne bouge pas** : box entière pour tout le staff
-- (`current_staff_tenant_ids()`), COACH compris — le strict « ses cours »
-- de la spec §5.2 est reporté, décision datée du 14 septembre 2026, à
-- rouvrir quand une box plus grande le demandera (et ce jour-là ici, dans le
-- WHERE — jamais côté client, règle 2).
--
-- `create or replace view` : PostgreSQL exige que les colonnes existantes
-- gardent position et nom — `last_name` s'ajoute donc en fin de liste.
-- `security_invoker = false` est restaté : même raison que ses trois sœurs,
-- en `true` la policy `id = auth.uid()` de `users` ne rendrait que l'appelant.

create or replace view public.class_attendance_sheet
with (security_invoker = false)
as
select
  b.tenant_id,
  b.class_id,
  b.id as booking_id,
  m.id as membership_id,
  u.first_name,
  nullif(left(coalesce(u.last_name, ''), 1), '') as last_initial,
  b.attended_at,
  b.no_show_at,
  u.last_name
from public.bookings b
join public.memberships m on m.id = b.membership_id
join public.users u on u.id = m.user_id
where b.status = 'CONFIRMED'
  and m.status = 'ACTIVE'
  and m.left_at is null
  and u.deleted_at is null
  and b.tenant_id in (select public.current_staff_tenant_ids());

comment on view public.class_attendance_sheet is
  'Feuille de présence d''un cours, vue par le staff de la box : nom complet depuis le 14 sept. 2026 (décision commanditaire, exception datée dans privacy.md — le staff gère la box), présence et no-show. Portée box entière, COACH compris (le strict « ses cours » de §5.2 est reporté, décision datée). Ignore hidden_from_roster (traitement légitime de la box). Une surface semi-publique (kiosque P1-008b) ne consomme jamais cette vue.';

grant select on public.class_attendance_sheet to authenticated;
