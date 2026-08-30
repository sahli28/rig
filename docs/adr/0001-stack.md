# ADR 0001 — Stack technique

**Date** 2026-08-30 · **Statut** accepté

## Contexte

Projet mené en solo, ~15–20 h/semaine. Mobile iOS + Android, web responsive,
multi-tenant, paiements. La contrainte dominante n'est pas la performance, c'est
le temps disponible d'une seule personne.

## Décision

Expo (React Native) + Next.js + Supabase (Postgres, région UE) + Stripe Connect,
en monorepo Turborepo avec TypeScript partagé.

## Alternatives écartées

- **Flutter** : techniquement excellent, mais impose Dart. Deux langages, zéro partage
  de code entre mobile, web et backend. Disqualifiant à une personne.
- **Natif Swift + Kotlin** : double le travail mobile.
- **Backend NestJS auto-hébergé** : plus propre à 5 personnes ; à une, c'est trois mois
  de plomberie (auth, migrations, RLS, realtime, storage, backups) déjà fournis par Supabase.
- **AWS dès le départ** : moins cher à grande échelle, mais coûte des semaines d'ops.
  À reconsidérer quand la facture dépasse 500 €/mois.

## Conséquences

- Dépendance forte à Supabase et Vercel : atténuée en gardant la logique métier en
  SQL standard et TypeScript portables, et en maintenant un dump quotidien externe.
- OTA updates via Expo : correction d'un bug sans repasser par la revue Apple.
- Le risque de verrouillage est accepté, documenté, et compensé par la réversibilité
  du schéma Postgres.
