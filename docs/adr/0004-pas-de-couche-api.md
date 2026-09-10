# ADR 0004 — Appels directs à Postgres plutôt qu'une couche API

**Date** 2026-08-31 · **Statut** accepté · **Ticket** P0-005a

## Contexte

`.claude/rules/api.md` décrit une couche de route handlers Next : validation Zod,
résolution du tenant, `Idempotency-Key`, journalisation. Écrite avant que le
schéma n'existe, elle supposait que toute opération passerait par un serveur.

P0-004 a livré neuf fonctions `security definer` qui portent elles-mêmes leurs
contrôles — `accept_invitation` vérifie l'expiration, le statut, l'e-mail vérifié
du JWT et l'état de la box ; `create_tenant` valide le slug et le quota. Ces
contrôles sont dans la base, pas devant.

## Décision

Les clients (mobile et web) appellent **directement Supabase** : RPC pour les
fonctions, lectures protégées par RLS pour le reste. Aucune route handler tant
qu'une opération n'en exige pas une.

## Où passe la bascule

Une couche serveur devient nécessaire quand l'opération a besoin de quelque chose
que le client ne peut pas fournir honnêtement :

| Besoin | Ticket |
| --- | --- |
| `Idempotency-Key` persistée, réponse d'origine rejouée | **P1-003** — réservation |
| Signature de webhook vérifiée, secret jamais exposé | **P2** — Stripe |
| Limitation de débit | P2 |

C'est P1-003 qui construira `apps/web/app/api/v1/`, et `api.md` s'appliquera alors
tel qu'il est écrit.

> **Amendement du 10 septembre 2026 — cette phrase est caduque, et la première
> couche serveur n'est pas celle qu'elle annonçait.** `P1-003` est fusionné
> depuis le 3 septembre 2026 et **n'a construit aucun `apps/web/app/api/v1/`**
> (le répertoire n'existe pas) : la réservation a résolu son `Idempotency-Key`
> **dans la base** — contrainte unique sur `bookings` + `book_class()` PLpgSQL —
> donc le déclencheur que cet ADR posait n'a rien produit. Ce n'est pas un oubli,
> c'est le bon choix : l'idempotence vivait mieux sous le verrou de ligne que
> devant lui.
>
> **La première vraie brique serveur du produit est l'émetteur de notifications
> push (`P1-007`), et c'est une edge function Supabase, pas un route handler
> Next.** Trois raisons : (1) un envoi push ne peut vivre **ni en SQL** — une
> fonction Postgres n'émet pas vers Expo/APNs, `pg_net` ne sert qu'à réveiller
> l'émetteur — **ni côté client** — le secret Expo/APNs ne s'expose jamais ;
> (2) il se déclenche en fond (`pg_cron`, promotion de liste d'attente) et non sur
> une requête entrante, ce qui n'est pas la forme d'un route handler ; (3) c'est
> le choix que `P1-007` nomme déjà. La couche `api.md` (route handlers, Zod,
> `Idempotency-Key`) **reste en attente de son objet** — les webhooks Stripe de
> P2, où une requête entrante doit être validée et sa signature vérifiée. Elle
> n'est toujours pas abrogée ; elle attend simplement un autre objet que celui
> que cet ADR avait prévu.

## Alternative écartée

Construire la couche dès P0-005a « pour poser le motif ». Trois jours-homme de
transport sans logique, sur des fonctions qui portent déjà leurs contrôles — et
un motif posé sans le besoin qui lui donne sa forme. `Idempotency-Key` mal
conçue faute de cas d'usage réel coûterait plus cher que de l'écrire en P1-003.

## Conséquences

- **La règle du tenant actif s'applique aussi aux appels directs.** La RLS garantit
  qu'on ne sort pas des boxes de l'utilisateur ; elle ne garantit pas qu'on reste
  dans la box active. Cette règle vit dans un helper de `packages/core` que tout
  accès aux données traverse, plutôt que dans la discipline de chaque appelant.
- **Les erreurs métier doivent porter un code applicatif.** En RPC direct, le
  client ne reçoit que le SQLSTATE — et `check_violation` sert déjà à cinq erreurs
  distinctes. Sans code, le client n'aurait que le message français à inspecter,
  ce qu'`api.md` interdit. Les fonctions portent donc leur code dans le champ
  `detail`, que PostgREST expose, et `packages/core` centralise la correspondance
  vers les messages traduits.
- `api.md` reste valable **pour les route handlers**, et redevient pleinement
  applicable en P1-003. Il n'est pas abrogé, il est en attente de son objet.
