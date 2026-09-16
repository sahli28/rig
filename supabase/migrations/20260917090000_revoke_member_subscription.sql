-- P2-026 — Retrait d'accès (le geste humain) + filtre `deleted_at` en lecture.
--
-- La correction de fond est faite depuis P2-018 : `member_has_booking_right()`
-- filtre `s.deleted_at is null`, donc retirer un accès bloque déjà la
-- réservation. Ce fichier ajoute ce qui manquait : le chemin d'écriture du
-- retrait — jusqu'ici un `update … set deleted_at` à la main en SQL — et
-- l'hygiène de lecture relevée par `rls-auditor` à la clôture de P2-018 : un
-- abonnement retiré ne doit plus être rendu, ni au membre ni à l'administration.
--
-- Migration neuve, `20260916100000` n'est pas retouchée : l'hébergé existe, la
-- bascule de la règle 13 est passée — on n'édite plus, on ajoute.

-- ---------------------------------------------------------------------------
-- Les lectures oublient les lignes retirées
-- ---------------------------------------------------------------------------

-- Piège 13 examiné avant d'amputer : « une policy de lecture qui masque les
-- lignes archivées interdit de les archiver par update » — POUR un archiveur
-- soumis à la RLS. Ici il n'y en a aucun : la table n'a ni policy ni grant
-- d'écriture (prouvé par rls_leak_test), et le seul archiveur est
-- `revoke_member_subscription()` ci-dessous, security definer sous le
-- propriétaire, que la RLS ne voit pas. « Qui archive voit ce qu'il archive »
-- est donc satisfait par construction, et le filtre peut porter sur tout le
-- monde. Le jour où un chemin d'écriture RLS apparaîtrait sur cette table, ce
-- raisonnement tombe avec lui — c'est écrit ici pour être retrouvé ce jour-là.

alter policy member_subscriptions_own_select
  on public.member_subscriptions
  using (
    deleted_at is null
    and membership_id in (
      select m.id from public.memberships m where m.user_id = (select auth.uid())
    )
  );

alter policy member_subscriptions_admin_select
  on public.member_subscriptions
  using (
    deleted_at is null
    and tenant_id in (select public.current_admin_tenant_ids())
  );

-- ---------------------------------------------------------------------------
-- revoke_member_subscription — le retrait, journalisé, en une transaction
-- ---------------------------------------------------------------------------

-- Calque de `grant_member_subscription()` : même garde, même journal, même
-- absence de chemin direct. Le retrait est un **archivage** (règle 10 : pas de
-- DELETE physique) : `deleted_at` sur les lignes encore utiles — celles dont
-- `ends_on` n'est pas passé, en date locale de la box. Une ligne expirée reste
-- intacte : c'est l'historique, et l'écran d'historique est un autre ticket.
create or replace function public.revoke_member_subscription(
  p_membership_id uuid
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target record;
  v_revoked integer;
begin
  -- Même réponse pour un COACH, un MEMBER, une autre box ou un identifiant
  -- inexistant : confirmer l'existence serait déjà une divulgation.
  select m.id, m.tenant_id, t.timezone
  into v_target
  from public.memberships m
  join public.tenants t on t.id = m.tenant_id
  where m.id = p_membership_id
    and m.left_at is null
    and m.tenant_id in (select public.current_admin_tenant_ids());

  if v_target.id is null then
    perform public.app_error(
      'FORBIDDEN_ROLE',
      'Cette appartenance n''existe pas, ou n''est pas administrable.',
      '42501'
    );
  end if;

  update public.member_subscriptions
  set deleted_at = now()
  where membership_id = p_membership_id
    and deleted_at is null
    and ends_on >= (now() at time zone v_target.timezone)::date;

  get diagnostics v_revoked = row_count;

  -- Un second clic rend 0 sans lever, et n'écrit pas de fausse trace : le
  -- journal ne porte que ce qui a réellement changé.
  if v_revoked > 0 then
    perform public.log_audit(
      v_target.tenant_id,
      'subscription.revoked',
      'membership',
      p_membership_id,
      jsonb_build_object(
        'membership_id', p_membership_id,
        'revoked_count', v_revoked
      )
    );
  end if;

  return v_revoked;
end;
$$;

comment on function public.revoke_member_subscription(uuid) is
  'Retire l''accès d''un membre (P2-026) : archive ses abonnements courants et futurs (deleted_at), en date locale de la box. OWNER/MANAGER seulement — la garde est dans le corps. Rend le nombre de lignes archivées ; 0 = rien à retirer, sans erreur. Seul chemin d''écriture du retrait.';

revoke all on function public.revoke_member_subscription(uuid) from public, anon;
grant execute on function public.revoke_member_subscription(uuid) to authenticated;
