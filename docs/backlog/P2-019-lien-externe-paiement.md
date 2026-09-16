# `P2-019` — Lien externe de paiement

**Phase** `P2` · **Estimation** `2` j·h · **Dépend de** `P1-001b` (réglages box) · **Spec** §15.5 (hors flux carte), §17.2 · **Origine** décision commanditaire, 14–16 septembre 2026

## Objectif

La box colle son lien de paiement Stripe dans ses réglages, et le membre le
retrouve dans l'app pour régler son abonnement — hors app, sur la page de la box.
L'app ne voit jamais de donnée de carte.

## Ce que ce ticket suppose et qui doit exister

| Prérequis | Où il vit | État |
| --- | --- | --- |
| Écran de réglages box | `apps/web/app/box/[slug]/reglages` (P1-001b) | ✅ existe — le champ « lien de paiement » s'y loge |
| Colonne pour l'URL | `tenant_settings` | ❌ **à créer** : `payment_link_url text`, validée https, nullable |
| Un endroit où le membre le voit | carte membre / écran d'accès (mobile) | ⚠️ la carte membre existe ; y ajouter un bouton « Régler mon abonnement » quand un lien est posé |
| Ouverture d'URL externe | `Linking` (Expo) | ✅ standard |

## Ce que ce ticket rend possible, et qui l'appellera

| Ce que je livre | Appelé par | Ticket |
| --- | --- | --- |
| Le lien de paiement de la box | le bouton « Régler » côté membre | celui-ci |

## Périmètre

- Migration : `tenant_settings.payment_link_url` (validation https, nullable).
- Réglages back-office : champ + aide « Colle ici le lien de paiement de ton
  compte Stripe. Le règlement se fait sur ta page, en dehors de l'app. »
- Mobile : bouton « Régler mon abonnement » sur la carte membre / l'écran
  d'accès, visible **seulement si** un lien est posé, ouvre le navigateur.
- Une mention claire, une fois : « Le paiement se fait sur la page de ta box, en
  dehors de l'application. »

## Hors périmètre

- Savoir qui a payé, réconcilier, activer l'accès : l'accès est attribué à la
  main (`P2-018`). L'app ne reçoit aucun retour du lien.
- Stripe Connect, `application_fee`, webhooks → `P2-001`, différé avec l'entité.

## Critères d'acceptation

- [ ] Une box pose un lien https ; le membre voit le bouton et il ouvre la bonne
      page
- [ ] Sans lien posé, aucun bouton (pas de bouton mort)
- [ ] Une URL non-https est refusée à la saisie
- [~] Ouverture réelle du lien sur iPhone — passe `P2-021`

## Notes

Le lien est **opaque** à l'app, c'est voulu : le montant, la formule, la TVA
vivent dans le Stripe de la box (la box est le vendeur, §15.6). Ne pas parser ni
pré-remplir le lien.
