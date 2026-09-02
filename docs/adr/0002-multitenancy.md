# ADR 0002 — Modèle de multi-tenancy

**Date** 2026-08-30 · **Statut** accepté

## Contexte

Chaque box est un tenant. Les données ne doivent jamais se croiser. Une seule
personne maintient les migrations.

## Décision

Base unique, colonne `tenant_id` sur toute table métier, isolation par Row Level
Security Postgres avec `force row level security`.

## Alternatives écartées

- **Un schéma par tenant** : isolation supérieure, mais N migrations à chaque
  changement. Ingérable seule dès 50 boxes.
- **Une base par tenant** : réservé à une exigence contractuelle grand compte.

## Garde-fous non négociables

1. RLS activée et forcée sur toutes les tables métier.
2. Les tenants autorisés se **dérivent de l'identité du JWT**, jamais d'un
   paramètre client — voir l'amendement ci-dessous.
3. Test automatisé anti-fuite bloquant en CI, itérant sur toutes les tables.
4. Le rôle applicatif n'est ni `superuser` ni `bypassrls`.
5. Les jobs de fond fixent explicitement leur tenant de contexte.
6. Défense en profondeur : RBAC applicatif **et** RLS. Une faille applicative seule
   ne doit pas suffire à faire fuiter un tenant.

## Amendement — 2026-08-30, ticket P0-004

Le garde-fou n°2 disait « le `tenant_id` vient du JWT via `auth_tenant_id()` ».
Formulation abandonnée : elle supposait un claim `tenant_id` dans le jeton, donc
**un jeton par box et une réémission à chaque changement de box**. Le Box Switcher
de P0-005 rend cela inacceptable, et un membre appartenant à deux boxes est un cas
nominal du produit, pas un cas limite.

Le prédicat retenu dérive les droits de l'identité, via `public.current_tenant_ids()` :

```sql
tenant_id in (select public.current_tenant_ids())
```

L'intention est préservée — aucun `tenant_id` transmis par un client n'accorde
d'accès — mais l'unité d'autorisation est l'**ensemble** des boxes de la personne,
pas une box active. Le tenant actif reste une affaire d'API (`X-Tenant-Id`, vérifié
contre les memberships).

Deux conséquences à ne pas découvrir plus tard :

- **`current_tenant_ids()` est `security definer`.** En `security invoker`, elle
  serait soumise à la RLS de `memberships`, dont la policy l'appelle : récursion
  infinie. Ce qui la rend sûre malgré ce privilège, c'est qu'elle **ne prend aucun
  paramètre** et filtre sur `auth.uid()`. Lui ajouter un paramètre en ferait une
  faille — c'est une invariante, pas un détail d'implémentation.
- **La RLS isole les tenants, pas les rôles.** Une personne `COACH` dans la box A
  et `MEMBER` dans la box B obtient de la RLS l'accès aux lignes des deux boxes ;
  seule l'API distingue ses droits. La défense en profondeur du garde-fou n°6 est
  donc réelle pour l'isolation **inter-tenant** et inexistante pour l'isolation
  **par rôle**. Pour les tables sensibles à venir — `ledger_entries`, `payments`,
  notes de coach — le rôle devra entrer dans le prédicat lui-même.

Corollaire : `memberships` n'a **aucune policy `insert`**. Un `with check`
d'appartenance rendrait la première appartenance ininsérable. Les seules portes
d'entrée sont `create_tenant()` et `accept_invitation()`, `security definer`, qui
valident leurs préconditions elles-mêmes.

## Conséquences

Toute nouvelle table est un moment à risque. D'où le sous-agent `rls-auditor`
et le hook qui protège les migrations déjà appliquées.

## Amendement — 2026-09-02, réconciliation spec ↔ backlog

**La box active se résout par le chemin `/box/[slug]/…`, pas par un
sous-domaine.** L'écart avec la spec (§2.2 M2 « création de box, **sous-domaine**,
RLS » et §7.4 « en-tête `X-Tenant-Id`, ou sous-domaine côté web ») a été fait en
P1-001a et jamais consigné. Il l'est ici.

Le sous-domaine n'a pas été écarté pour son coût — DNS générique et certificat
générique sont peu de travail — mais parce qu'il **fuit l'existence des boxes**.
Un sous-domaine est observable au DNS par n'importe qui : `crossfit-lyon-7.rig.app`
résout ou ne résout pas, avant toute authentification, et l'énumération est
triviale.

Le chemin, lui, se résout **parmi les appartenances de l'appelant**
(`findMembershipBySlug`) et jamais par `tenant_public_profile()`. Conséquence
directe : « cette box n'existe pas » et « vous n'avez pas accès à cette box »
rendent la **même** réponse, et restent indiscernables par construction — pas par
discipline de code. C'est exactement ce qu'un sous-domaine rend impossible.

Ce que l'amendement ne dit pas :

- il ne ferme pas la porte à un sous-domaine **vanity** pour les pages publiques
  (page de vitrine, invitation), qui ne portent aucune donnée de membre et dont
  l'existence est de toute façon publique ;
- le white-label N2 (C1, v2) ré-ouvrira la question, mais sur un domaine par box,
  ce qui est un autre problème.

L'en-tête `X-Tenant-Id` de §7.4 n'existe pas davantage, et pour la même raison
que le garde-fou n°2 : les droits se dérivent de l'identité, jamais d'un
paramètre client. Un en-tête de tenant serait au mieux redondant, au pire
interprété un jour comme une autorisation.
