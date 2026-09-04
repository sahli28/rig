-- P1-010 — L'annuaire des coachs, lisible par un membre.
--
-- Le planning mobile doit dire **qui anime** le cours. Aucune source ne le
-- permettait : `users` est en `id = auth.uid()`, `memberships` ne porte aucun
-- nom, et `member_admin_directory` est réservée à OWNER/MANAGER — elle porte
-- les adresses.
--
-- C'est la **troisième** vue d'exposition d'identité du produit, et la règle qui
-- les gouverne toutes est désormais écrite une fois dans
-- `.claude/rules/privacy.md`. Ce qu'elle impose ici :
--
--   * prénom et **initiale** du nom. Jamais d'e-mail, de téléphone, de date de
--     naissance ni de sexe ;
--   * une vue **par audience**, jamais une vue unique à colonnes
--     conditionnelles — le contrôle est un seul `WHERE`, pas un `case` par
--     colonne sensible ;
--   * filtrée par appartenance, et prouvée dans les deux sens.
--
-- Base juridique, consignée parce qu'elle se discute et ne se devine pas : le
-- coach exerce une **fonction publique de la box**. Son nom est sur le planning
-- au mur et sur le site ; l'afficher aux membres de sa propre box relève de
-- l'exécution de son contrat, pas d'un consentement qu'il pourrait retirer sans
-- cesser d'animer les cours. Ce qui ne dispense pas de l'**informer** — une base
-- qui n'est pas le consentement exempte de la case à cocher, pas de
-- l'information.
--
-- La photo (§6.1) n'est pas ici, et pas seulement par périmètre : elle **n'a pas
-- de producteur**. `users.avatar_url` existe comme colonne, mais il n'y a ni
-- stockage, ni téléversement, ni modération avant P1-001f. Elle entrera avec son
-- producteur, et elle sera du **consentement**.

-- `security_invoker = false`, comme `member_admin_directory` et pour la même
-- raison : en `true`, la policy `id = auth.uid()` de `users` s'appliquerait à
-- l'appelant, la vue ne rendrait que lui-même, et elle ne servirait à rien.
--
-- Conséquence à lire comme pour ses sœurs : **le `WHERE` ci-dessous est la seule
-- chose entre un membre et la table `users` entière, tous tenants confondus.**
-- Aucun paramètre du client n'influence la sélection ; le tenant se dérive
-- d'`auth.uid()`.
create view public.tenant_coaches
with (security_invoker = false)
as
select
  m.tenant_id,
  -- **Oui, l'identifiant d'appartenance.** C'est la clé de jointure du
  -- planning, qui part de `classes.coach_membership_id` — lisible par tout
  -- membre depuis P1-002. L'omettre ne retirerait rien du produit : ça rendrait
  -- la vue injoignable. La ligne à tenir est le **nom** et les **moyens de
  -- contacter**, pas les identifiants pseudonymes.
  m.id as membership_id,
  u.first_name,
  -- L'initiale, pas le nom. Une vue qui ne transporte qu'un caractère ne peut
  -- pas laisser fuir un patronyme par inadvertance — même règle que le partage
  -- inter-box, réutilisée plutôt que réinventée.
  nullif(left(coalesce(u.last_name, ''), 1), '') as last_initial
from public.memberships m
join public.users u on u.id = m.user_id
where u.deleted_at is null
  and m.status = 'ACTIVE'
  and m.left_at is null
  -- Qui anime : le propriétaire et le gestionnaire coachent aussi dans une box
  -- de cette taille. Un simple MEMBER n'est jamais un coach, et c'est ce que le
  -- test vérifie.
  and m.role in ('OWNER', 'MANAGER', 'COACH')
  and m.tenant_id in (select public.current_tenant_ids());

comment on view public.tenant_coaches is
  'Coachs d''une box, vus par ses membres : prénom et initiale, jamais d''adresse. Règle d''exposition dans .claude/rules/privacy.md.';

-- Sans grant, la vue est inaccessible : les privilèges par défaut du schéma ont
-- été retirés à `anon` et `authenticated` (D-006). C'est le bon défaut, et il se
-- diagnostique mal si on l'ignore.
grant select on public.tenant_coaches to authenticated;
