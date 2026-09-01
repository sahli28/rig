-- « Qui, à l'intérieur d'une box, voit quoi sur les gens ? »
--
-- D-001 pose la question pour `users` : la policy est `id = auth.uid()`, donc
-- `Members List` (P1-001) ne peut afficher aucun nom. Élargir la policy
-- exposerait `email`, `birthdate` et `gender` de chaque adhérent à tous les
-- autres — la minimisation vaut aussi à l'intérieur d'une box
-- (`.claude/rules/privacy.md`). D'où une vue.
--
-- Posée aux tables voisines, la même question en trouve deux autres :
-- `audit_logs` et `ledger_entries` sont protégées au niveau du tenant, dans un
-- système où le rôle compte manifestement. Même motif que `tenants_member_update`
-- en P0-004. Elles sont corrigées ici : les séparer ferait relire deux fois le
-- même schéma pour la même raison.

-- ---------------------------------------------------------------------------
-- 1. current_admin_tenant_ids() — la sœur à garde de rôle de current_tenant_ids()
-- ---------------------------------------------------------------------------

-- Même forme que `current_tenant_ids()`, et pour les mêmes raisons :
-- `security definer` pour briser la récursion sur `memberships`, **sans
-- paramètre** donc sans surface d'attaque, filtrée sur `auth.uid()`.
--
-- Évaluée une fois par requête, là où `current_tenant_role(m.tenant_id)` placée
-- dans un `WHERE` serait appelée une fois par ligne.
create or replace function public.current_admin_tenant_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.tenant_id
  from public.memberships m
  where m.user_id = (select auth.uid())
    and m.status = 'ACTIVE'
    and m.left_at is null
    and m.role in ('OWNER', 'MANAGER');
$$;

comment on function public.current_admin_tenant_ids() is
  'Boxes où l''utilisateur courant administre (OWNER ou MANAGER). Sœur de current_tenant_ids() pour tout ce qui demande un rôle, pas seulement une appartenance.';

revoke execute on function public.current_admin_tenant_ids() from public, anon;
grant execute on function public.current_admin_tenant_ids() to authenticated;

-- ---------------------------------------------------------------------------
-- 2. member_admin_directory — l'annuaire administratif d'une box
-- ---------------------------------------------------------------------------

-- **`security_invoker = false` : la vue s'exécute avec les droits de son
-- propriétaire, donc la RLS de `users` est contournée.**
--
-- Ce n'est pas un raccourci, c'est la seule option : en `security_invoker = true`
-- la policy `id = auth.uid()` s'appliquerait à l'appelant, la vue ne rendrait
-- que lui-même, et elle ne servirait à rien.
--
-- Conséquence, à lire comme pour `current_tenant_ids()`, `current_tenant_role()`
-- et `tenant_public_profile()` : **le `WHERE` ci-dessous est la seule chose
-- entre un membre et la table `users` entière, tous tenants confondus.** Même
-- discipline que ses trois sœurs :
--   - aucun paramètre venant du client n'influence la sélection des lignes ;
--   - le tenant se dérive d'`auth.uid()`, jamais d'une valeur transmise ;
--   - un test pgTAP prouve qu'un membre de la box A ne voit personne de la box B.
--
-- C'est aussi ce qui justifie une vue par audience plutôt qu'une vue unique à
-- colonnes conditionnelles : le contrôle est **un seul `WHERE`**, pas un `case`
-- par colonne sensible. Un `case` oublié sur une colonne ajoutée plus tard est
-- une ligne de plus dans un long `select`, invisible en revue. Un `WHERE` faux
-- rend zéro ligne.
--
-- La moitié « pairs » de la paire — ce qu'un membre voit des autres membres —
-- n'est délibérément pas ici : elle n'a pas d'appelant avant P1-003, et sa forme
-- juste (« les gens que je croise », pas « tout l'annuaire ») suppose `bookings`.
create view public.member_admin_directory
with (security_invoker = false)
as
select
  m.tenant_id,
  m.id            as membership_id,
  m.role,
  m.status,
  m.joined_at,
  m.left_at,
  u.id            as user_id,
  u.email,
  u.first_name,
  u.last_name,
  u.avatar_url,
  u.locale
from public.memberships m
join public.users u on u.id = m.user_id
-- Les comptes anonymisés sortent : la RLS de `users` étant contournée, son
-- filtre habituel ne s'applique pas et ce `deleted_at` est le seul.
where u.deleted_at is null
  and m.tenant_id in (select public.current_admin_tenant_ids());

comment on view public.member_admin_directory is
  'Annuaire administratif d''une box, réservé à OWNER et MANAGER. Ce n''est PAS la vue des pairs : un membre n''y voit rien, un coach non plus. security_invoker = false, donc son WHERE est la seule protection.';

-- Toutes les appartenances y figurent, y compris SUSPENDED, LEFT et REMOVED :
-- Staff & Roles doit les voir pour les gérer. C'est l'**appelant** qui doit être
-- actif, pas la ligne lue.
--
-- `birthdate` et `gender` restent dehors : aucun écran ne les demande, et une
-- colonne qu'on n'expose pas est une colonne qu'on n'a pas à protéger.
-- `email` est dedans : l'OWNER est responsable de traitement, la spec §5.2 lui
-- accorde l'export des données membres, et l'import CSV de P1-001 en dépend.

-- La vue joint deux tables : elle n'est pas auto-modifiable, les écritures
-- échouent d'elles-mêmes. Le `revoke` est là quand même — une protection
-- implicite est une protection qu'on ne relit pas.
revoke all on public.member_admin_directory from public, anon;
grant select on public.member_admin_directory to authenticated;

-- ---------------------------------------------------------------------------
-- 3. audit_logs — le journal n'est pas public dans sa box
-- ---------------------------------------------------------------------------

-- `audit_logs_tenant_select` disait `tenant_id in (select current_tenant_ids())`,
-- sans garde de rôle. Un simple MEMBER lisait donc tout le journal de sa box,
-- `diff jsonb` compris : les changements de rôle et les exclusions d'autres
-- membres, avec leur avant/après.
--
-- Spec §5.2, « Consulter le journal d'audit » : OWNER ✅, MANAGER ❌, COACH ❌,
-- MEMBER ❌. C'est donc `current_tenant_role() = 'OWNER'`, et **pas**
-- `current_admin_tenant_ids()` qui inclurait les gestionnaires.
drop policy audit_logs_tenant_select on public.audit_logs;

create policy audit_logs_owner_select on public.audit_logs for select to authenticated
  using (public.current_tenant_role(tenant_id) = 'OWNER');

-- ---------------------------------------------------------------------------
-- 4. ledger_entries — la comptabilité n'est pas publique dans sa box
-- ---------------------------------------------------------------------------

-- Même trou, même forme. Un MEMBER lisait toutes les écritures comptables de sa
-- box : en les sommant, son chiffre d'affaires, et au passage qui a payé combien.
--
-- La table n'a **aucune colonne de personne** — ni `user_id`, ni
-- `membership_id`. C'est de la comptabilité de box, pas un relevé individuel :
-- il n'y a donc pas de « ses propres écritures » à préserver pour un membre, et
-- la policy se réduit au rôle. Spec §5.2, « Voir le CA et le reporting
-- financier » : OWNER ✅, MANAGER 👁, le reste ❌.
drop policy ledger_entries_tenant_select on public.ledger_entries;

create policy ledger_entries_admin_select on public.ledger_entries for select to authenticated
  using (tenant_id in (select public.current_admin_tenant_ids()));
