-- Extensions et fonctions socle.
--
-- Rien de métier ici : uniquement ce dont toutes les migrations suivantes
-- dépendent. Ce fichier est le seul endroit où l'on définit comment un
-- identifiant est produit et comment un tenant est autorisé.

create extension if not exists citext with schema extensions;
create extension if not exists pgcrypto with schema extensions;

-- pgTAP sert aux tests de `supabase test db`, y compris en CI.
--
-- Compromis assumé : l'installer par migration la met **aussi en production**.
-- Une extension installée reste une surface, même inutilisée. On l'accepte pour
-- que la suite de tests soit exécutable à l'identique partout, plutôt que de
-- maintenir un chemin d'installation distinct par environnement. À réévaluer le
-- jour où une base de production existe.
create extension if not exists pgtap with schema extensions;

-- ---------------------------------------------------------------------------
-- Identifiants
-- ---------------------------------------------------------------------------

-- PostgreSQL 17 n'a pas `uuidv7()` : il arrive en PG 18. On l'implémente donc,
-- conformément à la RFC 9562 — 48 bits d'horodatage Unix en millisecondes en
-- tête, aléatoire pour le reste, bits de version (7) et de variante forcés.
--
-- L'intérêt sur un UUID v4 : les identifiants sont triables chronologiquement,
-- donc les insertions restent locales dans l'index au lieu de le fragmenter.
create or replace function public.uuid_generate_v7()
returns uuid
language sql
volatile
parallel safe
set search_path = ''
as $$
  select encode(
    set_bit(
      set_bit(
        overlay(
          uuid_send(extensions.gen_random_uuid())
          placing substring(
            int8send(floor(extract(epoch from clock_timestamp()) * 1000)::bigint)
            from 3
          )
          from 1 for 6
        ),
        52, 1  -- version : 0111 = 7
      ),
      53, 1
    ),
    'hex'
  )::uuid;
$$;

comment on function public.uuid_generate_v7() is
  'UUID v7 (RFC 9562), triable chronologiquement. À retirer au profit de uuidv7() natif lors du passage à PostgreSQL 18.';

-- ---------------------------------------------------------------------------
-- Horodatage
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- `current_tenant_ids()`, le prédicat d'isolation, est défini dans la migration
-- suivante : son corps référence `memberships`, et PostgreSQL valide le corps
-- des fonctions SQL dès leur création.

-- ---------------------------------------------------------------------------
-- Rappel de sécurité, volontairement inscrit dans le schéma
-- ---------------------------------------------------------------------------

-- `service_role` possède `rolbypassrls` : toute requête émise avec la clé de
-- service ignore l'intégralité des policies ci-dessous. L'API applicative doit
-- agir sous le JWT de l'utilisateur (rôle `authenticated`). `service_role` est
-- réservé aux tâches d'administration étroites et auditées.
-- Voir `.claude/rules/database.md`.
