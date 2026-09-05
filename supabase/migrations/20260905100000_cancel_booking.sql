-- P1-004 — Annulation.
--
-- Symétrique de `book_class()`, et sous le même verrou : la place se rend là où
-- elle s'est prise. Ce qui compte n'est pas « une seule confirmée » mais
-- **`booked_count = count(bookings CONFIRMED)`** — un décrément perdu fait
-- dériver le compteur vers le haut, et le cours reste complet pour toujours
-- alors qu'il a des places. Silencieux, et la box perd des inscriptions sans
-- jamais savoir pourquoi.
--
-- ---------------------------------------------------------------------------
-- RM2.4, et ce que le pilote en fait
-- ---------------------------------------------------------------------------
--
-- La règle dit : « Avant : crédit restitué. Après : crédit consommé et/ou
-- frais. » **Aucune table de crédits n'existe** — elles arrivent en P2-007 — et
-- le seul libellé du dépôt qui parle de crédit est `errors.no_valid_entitlement`.
--
-- Le pilote **accepte** l'annulation tardive, la marque, et n'en tire aucune
-- conséquence dans l'app. Trois raisons, dans l'ordre de force :
--
-- 1. c'est le modèle de la spec elle-même : l'annulation a lieu dans les deux
--    cas, seule la restitution diffère. Refuser inventerait une règle plus
--    stricte que RM2.4 ;
-- 2. la place est libérée, et c'est ce qui compte pour la box. Refuser
--    laisserait un siège occupé par quelqu'un qui a dit ne pas venir — un
--    no-show garanti, invisible pour la liste d'attente de P1-006 ;
-- 3. l'écran de réglages le promet déjà : « au-delà desquelles l'annulation
--    n'est plus **libre** ». Pas impossible : non gratuite.
--
-- La microcopie ne promet donc aucun crédit tant qu'il n'y en a pas. Elle dit
-- que l'annulation sera enregistrée comme tardive, et que la box applique sa
-- règle hors de l'app.
--
-- **Mais « tardive » a une fin, et c'est le début du cours.** Les trois raisons
-- ci-dessus tiennent tant que la place peut encore servir ; passé `starts_at`,
-- annuler n'est plus une libération, c'est un effacement — celui du no-show de
-- RM3.4. `CLASS_ALREADY_STARTED`, à l'étape 3bis de `cancel_booking()`, où
-- l'arbitrage complet est écrit.

-- ---------------------------------------------------------------------------
-- Le fait est stocké, pas dérivé
-- ---------------------------------------------------------------------------
--
-- `cancel_window_minutes` est éditable depuis P1-001b. Un drapeau calculé après
-- coup — en comparant `cancelled_at` à `starts_at` avec le réglage **du jour** —
-- réécrirait l'histoire de toutes les annulations passées chaque fois qu'une box
-- change son réglage. Le jugement est rendu une fois, avec la règle en vigueur à
-- ce moment-là, et il ne bouge plus.
--
-- Même raisonnement que la dette de fuseau de P1-002 : ce qui a été converti à
-- un instant donné ne se reconvertit pas.
alter table public.bookings
  add column cancelled_within_window boolean;

comment on column public.bookings.cancelled_within_window is
  'Jugé à l''annulation, avec le réglage en vigueur alors. Jamais recalculé : cancel_window_minutes est éditable.';

-- ---------------------------------------------------------------------------
-- La restitution — le point de couture de P2-007 (et de P1-013)
-- ---------------------------------------------------------------------------
--
-- Corps vide au pilote : il n'y a rien à rendre. La fonction existe pour que
-- P2-007 **remplace** son corps au lieu d'ajouter un second chemin de
-- restitution — exactement ce qu'on a fait avec `member_has_booking_right()`,
-- et qui a payé.
--
-- `p_within_window` plutôt qu'une relecture de la réservation : la décision est
-- déjà prise par l'appelant, sous le verrou, et la repasser en paramètre évite
-- qu'une seconde lecture puisse en tirer une conclusion différente.
create or replace function public.restore_booking_entitlement(
  p_booking_id uuid,
  p_within_window boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Pilote : les droits sont accordés à la main par la box (P1-003, hors
  -- périmètre), il n'existe ni portefeuille ni carnet. Rien à restituer.
  --
  -- P2-007 y met le crédit rendu au portefeuille quand `p_within_window` est
  -- vrai (RM4.4 : « en portefeuille, jamais en monnaie »). P1-013, s'il sort
  -- avant, y rend une séance de carnet. Dans les deux cas : ce corps-ci, pas un
  -- second appel ailleurs.
  return;
end;
$$;

comment on function public.restore_booking_entitlement(uuid, boolean) is
  'Restitution du droit à l''annulation. Vide au pilote. P2-007 y met le crédit, P1-013 la séance de carnet.';

-- ---------------------------------------------------------------------------
-- cancel_booking — l'identifiant de la réservation est l'idempotence
-- ---------------------------------------------------------------------------
--
-- Pas de clé d'idempotence ici, contrairement à `book_class()`, et ce n'est pas
-- un oubli : réserver **crée** une ligne, donc il faut une clé pour reconnaître
-- deux tentatives de la même création. Annuler **transitionne** une ligne
-- existante vers un état terminal — son identifiant suffit.
--
-- Mais il ne suffit que si la transition est un **compare-and-swap**, et c'est
-- toute la leçon de cette fonction. Sa première version lisait le statut avant
-- de prendre le verrou, puis écrivait sans le revérifier : deux sessions
-- simultanées décrémentaient donc deux fois. Le commentaire affirmait alors
-- « impossible par construction » — il décrivait le cas séquentiel, celui que le
-- test exerçait, et pas la fonction.
--
-- Ce qui rend la double restitution impossible est à l'étape 5 : le `where` de
-- l'`update` porte `and status = 'CONFIRMED'`, et la seconde transaction
-- n'affecte aucune ligne.
create or replace function public.cancel_booking(p_booking_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_booking record;
  v_class record;
  v_window_minutes integer;
  v_within boolean;
begin
  -- 1. La réservation, et **qu'elle soit la sienne**. La fonction est
  --    `security definer` : la RLS ne rattraperait pas une réservation qui
  --    n'appartient pas à l'appelant.
  select b.id, b.class_id, b.tenant_id, b.status
  into v_booking
  from public.bookings b
  join public.memberships m on m.id = b.membership_id
  where b.id = p_booking_id
    and m.user_id = v_user_id;

  -- Réservation inconnue et réservation d'autrui rendent la **même** réponse :
  -- confirmer l'existence d'une ligne qu'on n'a pas le droit de voir serait
  -- déjà une divulgation.
  if v_booking.id is null then
    perform public.app_error(
      'FORBIDDEN_ROLE',
      'Cette réservation n''existe pas, ou n''est pas la vôtre.',
      '42501'
    );
  end if;

  -- 2. Déjà annulée : rendre la ligne, sans rien toucher. C'est l'idempotence,
  --    et c'est la garantie « aucune double restitution ».
  --
  --    **Ce retour reste avant la garde « cours commencé » de l'étape 3bis**, et
  --    l'ordre est la règle : une annulation faite hier reste rejouable
  --    aujourd'hui, quand le cours a eu lieu entre les deux. Refuser le rejeu
  --    reviendrait à rendre une erreur pour une action qui a réussi — le
  --    scénario exact du client qui perd la réponse et retente. La garde
  --    protège une **transition**, pas une lecture.
  if v_booking.status = 'CANCELLED' then
    return v_booking.id;
  end if;

  -- 3. **Le verrou**, sur la même ligne que `book_class()` verrouille. C'est lui
  --    qui rend `booked_count` fiable quand une annulation et une réservation
  --    se croisent sur la dernière place.
  select c.id, c.starts_at
  into v_class
  from public.classes c
  where c.id = v_booking.class_id
  for update;

  -- 3bis. **Un cours qui a commencé ne s'annule plus.**
  --
  --    Ce n'est pas une règle nouvelle : c'est la règle d'au-dessus lue à sa
  --    borne. On **accepte** l'annulation tardive parce que la place est
  --    libérée et que quelqu'un d'autre peut la prendre (raison 2 de l'en-tête
  --    de ce fichier). Cette raison expire exactement à `starts_at` : personne
  --    n'entre dans un cours à sa vingtième minute. Passé le début, annuler ne
  --    rend plus rien à la box — ça retire seulement une trace.
  --
  --    **Et c'est la trace qui compte.** RM3.4 définit le no-show comme « pas
  --    de check-in, cours eu lieu, réservation non annulée ». Sans cette garde,
  --    qui n'est pas venu annule le lendemain et son absence n'a jamais existé.
  --    La règle du no-show n'est pas encore écrite — elle est en S5 — donc rien
  --    ne rattraperait ces lignes ; c'est **maintenant** que l'historique se
  --    salit ou non. Effet plus visible du même trou : `booked_count`
  --    décrémenté sur un cours passé, et un cours qui était plein affiche zéro
  --    inscrit dans les statistiques de remplissage une semaine plus tard.
  --
  --    **La borne est le début, pas la fin.** La fin laisserait un trou large
  --    d'exactement un cours, et pile aux minutes où l'absence devient un fait
  --    — on sait qu'on n'ira pas à 18h35, pas à 19h30. Les deux effets ci-dessus
  --    sont déjà entiers à la première minute.
  --
  --    **Sa sœur `cancel_class_bookings()` n'a délibérément pas cette garde.**
  --    Question posée, pas oubliée (règle des sœurs, `.claude/rules/database.md`).
  --    Une box qui annule après coup un cours qui n'a pas eu lieu régularise —
  --    elle ne se rend pas son propre no-show — et ses annulations sont marquées
  --    `within_window = true`, subies. C'est le chemin prévu pour ce cas, et il
  --    passe par une garde de rôle. Refuser ici et là-bas retirerait à la box le
  --    seul geste de rattrapage qu'elle ait.
  --
  --    `<=` et non `<` : à la seconde du début, le cours a commencé. La
  --    réservation, elle, ferme `close_minutes_before` plus tôt — les deux
  --    fenêtres ne se touchent pas.
  --
  --    Enfin, la garde vient **après** le contrôle de propriété de l'étape 1 :
  --    répondre « ce cours a déjà eu lieu » à qui vise la réservation d'un autre
  --    confirmerait qu'elle existe, et ce serait le même oracle qu'on refuse
  --    partout ailleurs dans ce fichier.
  if v_class.starts_at <= now() then
    perform public.app_error(
      'CLASS_ALREADY_STARTED',
      'Ce cours a déjà eu lieu. Contacte ta box.',
      '23514'
    );
  end if;

  select ts.cancel_window_minutes
  into strict v_window_minutes
  from public.tenant_settings ts
  where ts.tenant_id = v_booking.tenant_id;

  -- 4. Le jugement. Comparé en **instants** : `starts_at` porte déjà l'heure
  --    locale de la box convertie à la matérialisation, et une durée qui sépare
  --    deux instants ne dépend d'aucun fuseau. C'est ce qui fait que le
  --    changement d'heure ne décale rien — le piège classique est de
  --    reconstruire une heure locale ici, pas de comparer des instants.
  v_within := v_class.starts_at - now() >= make_interval(mins => v_window_minutes);

  -- 5. **La transition est un compare-and-swap, pas une écriture.**
  --
  --    Le contrôle « déjà annulée » de l'étape 2 est lu **avant** le verrou : il
  --    attrape le rejeu tranquille — deux taps espacés — et rien d'autre. Deux
  --    sessions simultanées le franchissent toutes les deux, se sérialisent sur
  --    le verrou de `classes`, et la seconde décrémentait une seconde fois.
  --
  --    Mesuré, pas supposé : deux annulations de la **même** réservation au même
  --    instant laissaient `booked_count = 0` sur un cours portant encore une
  --    réservation confirmée. Le compteur disait la salle vide ; `book_class()`
  --    ne lit que lui, donc le cours aurait accepté dix réservations pour neuf
  --    sièges. La dérive ne lève rien — `booked_count between 0 and capacity`
  --    reste satisfaite — et c'est le surbooking que P1-003 avait rendu
  --    impossible qui revenait par la porte de derrière.
  --
  --    Le `and status = 'CONFIRMED'` referme la fenêtre : la seconde
  --    transaction, débloquée après le commit de la première, réévalue son
  --    `where` contre une ligne devenue `CANCELLED` et n'affecte aucune ligne.
  --
  --    Le test séquentiel passait — l'identifiant **est** l'idempotence, hors
  --    concurrence. C'est la concurrence qui manquait, et le harnais ne
  --    l'exerçait pas davantage : chaque détenteur y annulait sa réservation
  --    **une** fois. Le commentaire d'origine affirmait « impossible par
  --    construction » ; il décrivait le cas qu'on avait testé, pas la fonction.
  update public.bookings
  set status = 'CANCELLED',
      cancelled_at = now(),
      cancelled_within_window = v_within
  where id = v_booking.id
    and status = 'CONFIRMED';

  if not found then
    -- Une transaction concurrente a transitionné cette réservation pendant
    -- qu'on attendait le verrou. Elle a décrémenté et restitué ; refaire l'un
    -- ou l'autre serait précisément la double restitution qu'on évite.
    return v_booking.id;
  end if;

  update public.classes
  set booked_count = booked_count - 1
  where id = v_booking.class_id;

  -- 6. La restitution, dans la même transaction. Vide au pilote.
  perform public.restore_booking_entitlement(v_booking.id, v_within);

  return v_booking.id;
end;
$$;

comment on function public.cancel_booking(uuid) is
  'Annule une réservation sous verrou de ligne. Idempotente par l''identifiant. Hors fenêtre : acceptée et marquée tardive. Cours commencé : refusée.';

-- ---------------------------------------------------------------------------
-- cancel_class_bookings — la sœur oubliée
-- ---------------------------------------------------------------------------
--
-- Avant ce ticket, passer un cours à `CANCELLED` ne touchait **rien** d'autre :
-- les réservations restaient `CONFIRMED`, `booked_count` restait plein, et la
-- personne voyait toujours sa réservation active dans « Mes réservations ».
-- Vérifié au catalogue — le seul trigger sur `classes` était `set_updated_at`.
--
-- C'est la « règle des sœurs » de `.claude/rules/database.md` : un chemin bien
-- gardé (l'annulation individuelle) et son jumeau qui ne l'était pas.
--
-- **Une annulation subie n'est jamais tardive.** Personne n'a rien fait de mal ;
-- le jour où P2-007 restituera un crédit, c'est cette ligne qui décidera qu'il
-- est rendu.
--
-- **Et elle n'a pas la garde « cours commencé » de sa sœur.** C'est un choix,
-- pas un trou : une box qui annule après coup un cours qui n'a pas eu lieu
-- régularise, et c'est le seul chemin dont elle dispose pour le faire. Le
-- raisonnement complet est à l'étape 3bis de `cancel_booking()`.
create or replace function public.cancel_class_bookings(p_class_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant_id uuid;
  v_cancelled integer;
  v_annulees uuid[];
  v_booking_id uuid;
begin
  -- **La garde est dans le `where`, pas après le verrou.**
  --
  -- Deux corrections en une, et c'est le motif que `book_class()` documente
  -- déjà : « un cours d'une autre box ne doit pas même être verrouillé ».
  --
  -- 1. le filtre de tenant entre dans le `for update` : sans lui, n'importe quel
  --    `authenticated` faisait poser un verrou en écriture sur une ligne
  --    `classes` de n'importe quelle box avant d'être refusé. Pas une fuite —
  --    la garde interrogeait le vrai tenant propriétaire — mais un levier
  --    gratuit sur les lignes d'autrui ;
  -- 2. `current_admin_tenant_ids()` **remplace** le prédicat de rôle recopié à
  --    la main. Deux écritures de la même règle divergent au premier changement
  --    du modèle de rôles, et la seconde ne se relit jamais.
  --
  -- Cours inconnu, cours d'une autre box, et rôle insuffisant rendent donc la
  -- même réponse — la même indistinction que partout ailleurs.
  select c.tenant_id into v_tenant_id
  from public.classes c
  where c.id = p_class_id
    and c.tenant_id in (select public.current_admin_tenant_ids())
  for update;

  if v_tenant_id is null then
    perform public.app_error(
      'FORBIDDEN_ROLE',
      'Ce cours n''existe pas, ou n''est pas accessible.',
      '42501'
    );
  end if;

  -- `returning` plutôt qu'une fenêtre d'horloge pour retrouver les lignes qu'on
  -- vient d'annuler. La version d'origine les relisait par
  -- `cancelled_at >= now() - interval '1 second'` : une heuristique inoffensive
  -- tant que la restitution est vide, et un piège le jour où P2-007 y écrira un
  -- crédit — elle raterait une ligne sous charge, ou en prendrait une de trop.
  -- L'ensemble exact est connu au moment de l'écrire ; le deviner ensuite est
  -- un choix qu'on ne referait pas.
  with annulees as (
    update public.bookings
    set status = 'CANCELLED',
        cancelled_at = now(),
        -- Subie, donc jamais tardive.
        cancelled_within_window = true
    where class_id = p_class_id
      and status = 'CONFIRMED'
    returning id
  )
  select array_agg(id) into v_annulees from annulees;

  v_cancelled := coalesce(cardinality(v_annulees), 0);

  -- Le compteur est **recalculé**, pas décrémenté de `v_cancelled` : c'est
  -- l'invariant lui-même qu'on réaffirme, sous le verrou. Un décrément
  -- arithmétique propagerait une dérive au lieu de la corriger.
  update public.classes
  set booked_count = (
    select count(*) from public.bookings b
    where b.class_id = p_class_id and b.status = 'CONFIRMED'
  )
  where id = p_class_id;

  -- La restitution, une par réservation, **sur l'ensemble exact** que l'on vient
  -- d'annuler : P2-007 rendra un crédit à chacune.
  foreach v_booking_id in array coalesce(v_annulees, '{}'::uuid[]) loop
    perform public.restore_booking_entitlement(v_booking_id, true);
  end loop;

  return v_cancelled;
end;
$$;

comment on function public.cancel_class_bookings(uuid) is
  'Annule les réservations d''un cours annulé par la box. Recalcule booked_count plutôt que de le décrémenter.';

-- ---------------------------------------------------------------------------
-- Droits
-- ---------------------------------------------------------------------------

-- `cancelled_within_window` n'est jamais écrite à la main : elle est le
-- jugement de la fonction, pas une donnée de formulaire. Sa sœur `status` était
-- déjà hors des grants ; `cancelled_at` aussi, `bookings` n'ayant que `select`.
revoke all on function public.restore_booking_entitlement(uuid, boolean) from public, anon, authenticated;
revoke all on function public.cancel_booking(uuid) from public, anon;
revoke all on function public.cancel_class_bookings(uuid) from public, anon;
grant execute on function public.cancel_booking(uuid) to authenticated;
grant execute on function public.cancel_class_bookings(uuid) to authenticated;
