-- Les droits de table, couche oubliée sous les policies.
--
-- D-006 signalait qu'`authenticated` garde `insert` et `delete` sur
-- `public.users`, et que seule l'absence de policy l'arrête. L'inventaire montre
-- que c'est tout le schéma, et qu'un des droits accordés **ignore la RLS par
-- construction**.
--
-- `anon` et `authenticated` détenaient `arwdDxtm` — soit tout — sur les treize
-- tables. Relevé en base avant correction :
--
--   Léa, simple MEMBER, ne voit aucune ligne de `ledger_entries` :
--     DELETE   → contenu par la RLS (0 ligne visible, 0 ligne supprimée)
--     TRUNCATE → PASSÉ, les deux lignes effacées, celles des deux boxes
--   `anon`, sans aucune authentification :
--     TRUNCATE public.ledger_entries → PASSÉ
--   Balayage sous un MEMBER : les 13 tables tronquables, aucune refusée.
--
-- **La RLS ne s'applique pas à `TRUNCATE`** : ce n'est pas une opération ligne à
-- ligne, il n'y a pas de ligne à filtrer. Et le trigger `forbid_mutation` qui
-- rend `ledger_entries` et `audit_logs` append-only est un
-- `before update or delete` : il ne se déclenche pas davantage. Les deux
-- protections sur lesquelles reposent toute la comptabilité et tout le journal
-- d'audit sont donc contournées par une commande que les deux rôles applicatifs
-- avaient le droit d'exécuter.
--
-- Ce n'était pas exploitable à distance : PostgREST n'expose aucun verbe qui
-- produise un `TRUNCATE`, et `anon` comme `authenticated` sont `NOLOGIN`, donc
-- hors d'atteinte d'une connexion directe. Ce qui protégeait était **l'absence
-- de chemin**, pas un refus — soit exactement une couche, là où le garde-fou
-- n°6 de l'ADR 0002 en demande deux.

-- ---------------------------------------------------------------------------
-- 1. Repartir de zéro
-- ---------------------------------------------------------------------------

revoke all on all tables in schema public from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Réaccorder le strict miroir des policies
-- ---------------------------------------------------------------------------
--
-- Chaque ligne ci-dessous correspond à une policy existante, et à rien d'autre.
-- Un droit sans policy est un trou qui attend qu'on écrive la policy ; une
-- policy sans droit est du code mort qui échoue en `permission denied`. Le test
-- structurel confronte désormais les deux listes.

-- Lecture seule. Les écritures passent par des fonctions `security definer` :
-- `log_audit()` pour le journal, les webhooks Stripe pour la comptabilité,
-- `accept_invitation()` et consorts pour les appartenances.
grant select on public.audit_logs to authenticated;
grant select on public.ledger_entries to authenticated;
grant select on public.memberships to authenticated;

-- `consents` est append-only par policy : on ajoute, on ne réécrit pas. Se
-- rétracter est une ligne de plus à `granted = false`.
grant select, insert on public.consents to authenticated;

-- `tenants` : lecture pour tout membre, écriture bornée au propriétaire par la
-- policy — et par les colonnes, `status` et `deleted_at` restant hors de portée.
grant select, update on public.tenants to authenticated;

-- `users` : lecture, plus le droit **au niveau colonne** posé en P0-004.
--
-- Ce dernier doit être réémis : contrairement à ce qu'on pourrait croire,
-- `revoke all on all tables` emporte aussi les droits de colonne. Le test
-- « un utilisateur édite bien son propre profil » l'a démontré en échouant sur
-- un `permission denied`. La liste reste la même — `email` en est exclue, et
-- doublée par le trigger `forbid_email_change` : un contrôle d'identité s'appuie
-- dessus.
grant select on public.users to authenticated;
grant update (first_name, last_name, birthdate, gender, locale, avatar_url)
  on public.users to authenticated;

-- Réglages et catalogue de la box.
grant select, insert, update on public.locations to authenticated;
grant select, insert, update on public.rooms to authenticated;
grant select, insert, update on public.themes to authenticated;
grant select, insert, update on public.tenant_settings to authenticated;

-- `invitations` est la seule table que l'applicatif supprime réellement : une
-- invitation révoquée n'a pas d'histoire à conserver.
grant select, insert, update, delete on public.invitations to authenticated;

-- `devices` appartient à la personne, policy `for all`.
grant select, insert, update, delete on public.devices to authenticated;

-- `processed_webhook_events` : rien. RLS forcée sans policy **et** sans droit —
-- deux couches, ce qui est précisément l'objet de cette migration.

-- `all tables` en SQL comprend les **vues**. Le `revoke` ci-dessus a donc aussi
-- emporté l'accès à l'annuaire administratif livré par D-001. Une vue n'a pas de
-- policy : son grant est, avec son `WHERE`, tout ce qui la protège.
grant select on public.member_admin_directory to authenticated;

-- `anon` ne reçoit rien : son unique besoin, le profil public d'une box avant
-- connexion, passe par `tenant_public_profile()`, qui est `security definer`.

-- Aucune table ne reçoit `truncate`, `references` ni `trigger`. Ces trois droits
-- n'ont aucun usage applicatif, et le premier est celui qui ignore la RLS.

-- ---------------------------------------------------------------------------
-- 3. Fermer la source
-- ---------------------------------------------------------------------------

-- Sans ceci, la correction ci-dessus serait vraie aujourd'hui et fausse à la
-- prochaine table : les privilèges par défaut du schéma accordent `arwdDxtm` à
-- `anon` et `authenticated` sur tout ce qui s'y crée.
--
-- Les migrations s'exécutent en tant que `postgres`, et les treize tables lui
-- appartiennent (`relowner`) : c'est donc bien son ACL par défaut qui gouverne
-- les tables futures. Celle de `supabase_admin` gouverne les objets de Supabase
-- lui-même et ne nous regarde pas.
--
-- **Conséquence assumée : toute nouvelle table devra accorder ses droits
-- explicitement**, dans la même migration que ses policies. C'est le but — les
-- deux couches se posent ensemble, ou le test les signale.
alter default privileges in schema public revoke all on tables from anon, authenticated;
