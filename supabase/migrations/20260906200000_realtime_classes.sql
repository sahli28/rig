-- P1-005a — Le canal temps réel des places restantes.
--
-- Une seule chose ici : `public.classes` entre dans la publication
-- `supabase_realtime`. Le reste du ticket est du TypeScript.
--
-- ---------------------------------------------------------------------------
-- Ce que cette migration établit, et ce qu'elle n'établit pas
-- ---------------------------------------------------------------------------
--
-- Elle établit que le WAL des `update` sur `classes` part vers le service
-- Realtime. Elle **n'établit pas** qu'un abonné reçoit ce qu'il a le droit de
-- recevoir, ni qu'il ne reçoit rien d'autre : c'est le service Realtime qui en
-- décide, en évaluant `classes_select` pour chaque abonné avec son propre JWT.
-- Aucun test de ce dépôt ne touche ce processus.
--
-- D'où la règle écrite dans le ticket : un vert pgTAP ne se lit jamais « le
-- canal est isolé ». Le seul contrôle qui répond à cette question est manuel,
-- à deux comptes et deux tenants.
--
-- ---------------------------------------------------------------------------
-- Trois choix, et aucun n'est un défaut de forme
-- ---------------------------------------------------------------------------
--
-- **Le filtre `update` est côté client, et il ne peut pas être ici.**
-- `pubinsert` / `pubupdate` / `pubdelete` sont des propriétés **de la
-- publication**, pas de la table qu'on y ajoute : `supabase_realtime` publie
-- les trois pour tout ce qu'elle porte, et Realtime ne lit que cette
-- publication-là. Ajouter `classes` publie donc aussi ses `insert`.
--
-- Ce n'est pas un problème, mais il faut le dire plutôt que de le croire réglé
-- en base : l'abonnement déclare `event: 'UPDATE'`, et c'est **là** que la
-- restriction vit. Ce qu'on écoute est un compteur qui bouge sur une occurrence
-- **déjà affichée** ; un `insert` de cours arriverait sans son type, sa salle
-- ni son coach, que la lecture joint, et n'aurait donc rien à faire dans une
-- liste déjà chargée. Un `delete` n'existe pas : la règle 10 l'interdit
-- (`deleted_at`), et une occurrence supprimée arrive comme un `update`.
--
-- **`replica identity` reste `default`, et c'est une décision.** En `full`,
-- Postgres met **toutes** les colonnes de l'ancienne ligne dans le WAL, et
-- Realtime les envoie à chaque abonné dans `old_record`. On n'a besoin que du
-- nouvel enregistrement — `booked_count`, `capacity`, `status` — et le principe
-- de minimisation dit non au reste. `default` (la clé primaire) suffit :
-- l'évaluation de la policy pour un `update` porte sur le **nouvel**
-- enregistrement, qui est complet dans le WAL de toute façon.
--
-- **La publication n'est pas créée ici.** Elle est fournie par le socle du CLI
-- Supabase, appartient à `postgres` — le rôle qui joue les migrations — et
-- survit à `supabase db reset` (vérifié le 6 septembre 2026 : `pg_publication`
-- la porte, sans aucune table). La créer nous-mêmes ferait diverger le local du
-- socle hébergé. Mais on **vérifie** qu'elle est là plutôt que de le supposer :
-- sans elle, l'`alter` échouerait par une erreur d'objet manquant, à trois
-- écrans de la cause.

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    raise exception
      'La publication supabase_realtime est absente. Elle vient du socle du CLI Supabase : '
      'vérifier la version du CLI plutôt que de la créer à la main, sinon le local diverge de l''hébergé.';
  end if;

  -- Idempotent : `alter publication … add table` échoue si la table y est déjà,
  -- et une migration doit pouvoir être rejouée sur une base déjà à jour.
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'classes'
  ) then
    -- `execute` et pas la commande nue : plpgsql ne prend pas `alter publication`
    -- directement, et l'échec serait une erreur de syntaxe au déploiement.
    execute 'alter publication supabase_realtime add table public.classes';
  end if;
end $$;

comment on table public.classes is
  'Occurrence matérialisée en UTC. `booked_count` est écrit sous verrou par `book_class()` / `cancel_booking()`, '
  'et publiée en temps réel (P1-005a) : la RLS `classes_select` décide pour chaque abonné ce qu''il reçoit, '
  'et le filtre sur les `update` est côté client — une publication publie ses opérations pour toutes ses tables.';
