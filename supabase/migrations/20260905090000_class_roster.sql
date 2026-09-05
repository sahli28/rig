-- P1-003c — La feuille d'inscrits, et le droit de ne pas y figurer.
--
-- **Quatrième vue d'exposition d'identité du produit**, et la première dont la
-- base juridique n'est pas l'exécution d'un contrat. La règle commune est
-- écrite une fois dans `.claude/rules/privacy.md` ; ce fichier ne la réécrit
-- pas, il dit **en quoi un pair diffère d'un coach**.
--
-- ---------------------------------------------------------------------------
-- 1. La base juridique — intérêt légitime, information, opposition
-- ---------------------------------------------------------------------------
--
-- Un coach exerce une **fonction publique de la box** : son nom est au mur et
-- sur le site, l'afficher relève de son contrat (P1-010). **Un pair n'exerce
-- aucune fonction.** Sa présence à un cours est un fait de vie privée, et rien
-- ne la rend nécessaire à l'exécution de son propre contrat avec la box.
--
-- Reste l'**intérêt légitime** — voir avec qui on s'entraîne est utile et
-- attendu — assorti d'une **information** et d'un **droit d'opposition**. C'est
-- déjà la forme que la spec applique au partage inter-box : réutilisée plutôt
-- que réinventée.
--
-- L'argument qui a failli trancher dans l'autre sens, et qu'il faut garder sous
-- la main parce qu'il a l'air imparable : « ils se voient déjà en vrai ».
-- **L'app ne montre pas ce que la salle montre.** Elle transforme « les gens
-- que je croise le mardi » en une liste consultable de chez soi de qui
-- s'entraîne quand. Ce n'est pas le même objet, et quelqu'un qui évite un ex —
-- ou qui préfère simplement que ses horaires ne soient pas lisibles par cent
-- personnes — a un intérêt réel.
--
-- ---------------------------------------------------------------------------
-- 2. Pourquoi une colonne et non une finalité de consentement
-- ---------------------------------------------------------------------------
--
-- Trois tickets ont refusé de prendre cette décision à la légère parce qu'une
-- valeur d'enum **ne se retire pas** (`alter type … add value` est additif).
-- La réponse est de n'en ajouter aucune :
--
--   * **une opposition n'est pas un consentement.** `consents` prouve un accord
--     donné, avec sa version de politique, son horodatage, son IP. Une
--     opposition sous intérêt légitime n'a pas cette forme ;
--   * **c'est par box**, par construction : Julie est membre de deux boxes et
--     peut vouloir être visible dans l'une et pas dans l'autre. Une colonne sur
--     `memberships` l'est sans qu'on ait à y penser ;
--   * **c'est réversible.** Une colonne se retire, une valeur d'enum non ;
--   * **la trace existe quand même** : `log_audit()` écrit chaque bascule, et
--     `audit_logs` est append-only.
--
-- Et `LEADERBOARD` **n'est pas** le contrôle, bien qu'elle existe et n'ait
-- toujours aucun lecteur. Elle dit à la personne « ton prénom et tes **scores**
-- visibles des membres de ta box » — le classement, qui est P2-014. Lui faire
-- gouverner la feuille d'inscrits ferait faire à une case l'inverse de ce
-- qu'elle annonce, ce qui est précisément ce qu'un consentement informé
-- interdit. Elle est en outre un **opt-in**, alors que la décision ci-dessus est
-- un opt-out : les croiser rendrait invisible par défaut quelqu'un qui n'a
-- jamais rien refusé.

alter table public.memberships
  add column hidden_from_roster boolean not null default false;

comment on column public.memberships.hidden_from_roster is
  'Opposition à figurer dans la feuille d''inscrits de cette box (P1-003c). Intérêt légitime + opt-out, jamais un consentement : voir .claude/rules/privacy.md. Hors du grant de lecture de la table — seule get_roster_visibility() la rend, et seulement à son propriétaire.';

-- ---------------------------------------------------------------------------
-- 2 bis. La sœur oubliée, trouvée par `rls-auditor` avant le commit
-- ---------------------------------------------------------------------------
--
-- **La colonne était lisible par n'importe quel membre de la box.**
-- `memberships` porte depuis P0-004 un `grant select` sur **toutes** ses
-- colonnes, et une policy `memberships_tenant_select` qui rend toutes les
-- lignes du tenant à tout membre. `.claude/rules/privacy.md` l'assume
-- explicitement — « aucun nom, donc aucune fuite d'identité » — et ce jugement
-- était vrai tant que la table ne portait que `user_id`, `role`, `status` et
-- des dates.
--
-- Ce ticket y a ajouté une **opposition RGPD**, et le jugement a cessé d'être
-- vrai sans que personne le rouvre. Reproduit en local avant correction : Léa,
-- simple MEMBER, lisait `hidden_from_roster = true` sur la ligne de Julie —
-- c'est-à-dire exactement ce que la vue, son `WHERE` et sa fonction d'écriture
-- ont été construits pour ne jamais dire à un pair. Le chemin gardé était la
-- vue ; le jumeau oublié était la table.
--
-- Le correctif est le patron de `.claude/rules/database.md`, « La RLS ne borne
-- pas les colonnes » : une policy dit *quelles lignes*, un grant dit *quelles
-- colonnes*.
--
-- **Conséquence à connaître avant de la découvrir** : `select *` sur
-- `memberships` échoue désormais en `42501` pour `authenticated` — donc
-- `tenantScope().select('memberships')`, qui ne sait pas projeter, aussi. C'est
-- volontaire, et c'est écrit dans `.claude/rules/database.md` : la lecture de sa
-- propre opposition passe par `get_roster_visibility()`.
revoke select on public.memberships from authenticated;
grant select (
  id, tenant_id, user_id, role, status, joined_at, left_at, created_at, updated_at
) on public.memberships to authenticated;

-- Le pendant de `set_roster_visibility()`. Symétrique jusque dans sa forme : ce
-- que l'une écrit, l'autre le lit, et **seulement pour son propriétaire**.
create or replace function public.get_roster_visibility(p_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select m.hidden_from_roster
  from public.memberships m
  where m.tenant_id = p_tenant_id
    and m.user_id = (select auth.uid())
    and m.left_at is null;
$$;

comment on function public.get_roster_visibility(uuid) is
  'Sa propre opposition à la feuille d''inscrits, dans une box donnée. Rend null si l''appelant n''y est pas membre — même réponse que « la box n''existe pas », pour ne pas faire un oracle d''existence.';

revoke execute on function public.get_roster_visibility(uuid) from public, anon;
grant execute on function public.get_roster_visibility(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. La vue — « les gens que je croise », pas « toute la box »
-- ---------------------------------------------------------------------------
--
-- `security_invoker = false`, comme ses trois sœurs et pour la même raison : en
-- `true`, la policy `id = auth.uid()` de `users` s'appliquerait à l'appelant et
-- la vue ne rendrait que lui-même.
--
-- Conséquence à lire comme pour ses sœurs : **le `WHERE` ci-dessous est la seule
-- chose entre un membre et la table `users` entière, tous tenants confondus.**
-- Aucun paramètre du client n'y entre ; tout se dérive d'`auth.uid()`.
--
-- La portée est celle que D-001 avait fixée et que personne n'a rediscutée :
-- **les inscrits d'un cours**, pas l'annuaire de la box. D'où la condition qui
-- porte tout le ticket — `exists (… l'appelant est inscrit à ce cours …)`. Elle
-- rend la vue vide pour qui regarde un cours qu'il n'a pas réservé, y compris
-- dans sa propre box.
--
-- Le filtre de tenant est **en plus**, et redondant par construction : partager
-- un cours implique déjà de partager la box. Il est écrit parce qu'une
-- redondance de sécurité ne coûte rien à la lecture et rattrape la jointure
-- qu'on ajoutera un jour sans y penser.
create view public.class_roster
with (security_invoker = false)
as
select
  -- **`tenant_id` d'abord, et ce n'est pas cosmétique.** Le test anti-fuite
  -- interroge chaque vue métier avec `where tenant_id is not null`, sous une
  -- session étrangère : une vue sans cette colonne fait échouer le contrôle
  -- **comportemental** (`rls_leak_test.sql`), pas seulement le structurel. Il
  -- l'a fait ici, au premier lancement. C'est aussi ce que `tenantScope()`
  -- exige d'une vue pour la filtrer sur la box active.
  b.tenant_id,
  b.class_id,
  -- L'identifiant d'appartenance, comme dans `tenant_coaches` : c'est la clé de
  -- jointure, il est déjà lisible par tout membre via `memberships`, et
  -- l'omettre rendrait la vue injoignable sans rien protéger.
  m.id as membership_id,
  u.first_name,
  -- L'initiale, pas le nom. Une vue qui ne transporte qu'un caractère ne peut
  -- pas laisser fuir un patronyme par inadvertance.
  nullif(left(coalesce(u.last_name, ''), 1), '') as last_initial
from public.bookings b
join public.memberships m on m.id = b.membership_id
join public.users u on u.id = m.user_id
where b.status = 'CONFIRMED'
  and m.status = 'ACTIVE'
  and m.left_at is null
  and u.deleted_at is null
  -- L'opposition. Elle retire la ligne, elle ne la vide pas : une case grisée
  -- « membre masqué » dirait qu'il y a quelqu'un, ce qui est exactement ce que
  -- l'opposition refuse.
  and m.hidden_from_roster = false
  and b.tenant_id in (select public.current_tenant_ids())
  and exists (
    select 1
    from public.bookings mine
    join public.memberships mm on mm.id = mine.membership_id
    where mine.class_id = b.class_id
      and mine.status = 'CONFIRMED'
      and mm.user_id = (select auth.uid())
      and mm.status = 'ACTIVE'
      and mm.left_at is null
  );

comment on view public.class_roster is
  'Inscrits d''un cours, vus par un autre inscrit du même cours : prénom et initiale. Intérêt légitime + opposition (memberships.hidden_from_roster). Règle d''exposition dans .claude/rules/privacy.md.';

-- Sans grant, la vue est inaccessible : les privilèges par défaut du schéma ont
-- été retirés à `anon` et `authenticated` (D-006).
grant select on public.class_roster to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Exercer l'opposition — une fonction, parce que `memberships` est en
--    lecture seule
-- ---------------------------------------------------------------------------
--
-- `authenticated` n'a que `select` sur `memberships` (`table_grants`), et toutes
-- ses écritures passent par des fonctions `security definer`. Ouvrir une policy
-- d'`update` pour une seule colonne serait une porte bien plus large que le
-- besoin : la fonction ci-dessous ne touche **que l'appartenance de
-- l'appelant**, et **que cette colonne**.
create or replace function public.set_roster_visibility(
  p_tenant_id uuid,
  p_hidden boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_membership public.memberships;
begin
  -- « La sienne » se dérive d'`auth.uid()`, jamais d'un identifiant reçu du
  -- client : c'est la règle 2, et c'est ce qui distingue cette fonction de
  -- `set_member_role()`, qui prend un `membership_id` **parce qu'elle est
  -- réservée aux administrateurs**.
  select * into v_membership
  from public.memberships m
  where m.tenant_id = p_tenant_id
    and m.user_id = (select auth.uid())
    and m.left_at is null;

  if not found then
    -- Même réponse pour « cette box n'existe pas » et « je n'en suis pas
    -- membre » : distinguer les deux serait un oracle d'existence.
    perform public.app_error(
      'FORBIDDEN_ROLE',
      'Cette appartenance n''est pas la vôtre.',
      '42501'
    );
  end if;

  -- Rien à écrire, donc rien à journaliser : un journal qui enregistre des
  -- non-changements devient illisible, et `audit_logs` est append-only.
  if v_membership.hidden_from_roster is not distinct from p_hidden then
    return;
  end if;

  update public.memberships
     set hidden_from_roster = p_hidden
   where id = v_membership.id;

  perform public.log_audit(
    p_tenant_id,
    'membership.roster_visibility_changed',
    'membership',
    v_membership.id,
    jsonb_build_object('hidden_from_roster', p_hidden)
  );
end;
$$;

comment on function public.set_roster_visibility(uuid, boolean) is
  'Opposition d''un membre à figurer dans la feuille d''inscrits de sa box. Ne touche que l''appartenance de l''appelant, dérivée d''auth.uid().';

-- **Une opposition survit à un départ et à un retour**, et c'est un choix, pas
-- un oubli : `accept_invitation()` fait un `on conflict … do update` qui remet
-- `status`, `left_at` et `role` sans toucher cette colonne. Quelqu'un qui a
-- refusé d'être listé n'a pas changé d'avis en revenant, et lui redemander en
-- silence serait le remettre par défaut dans une liste dont il était sorti.
-- Noté ici parce qu'un défaut de recouvrement de colonnes se lit autrement
-- comme un oubli.

revoke execute on function public.set_roster_visibility(uuid, boolean) from public, anon;
grant execute on function public.set_roster_visibility(uuid, boolean) to authenticated;
