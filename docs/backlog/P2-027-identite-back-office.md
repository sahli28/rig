# `P2-027` — Identité de la box dans le back-office (le logo dans le shell)

**Phase** `P2` · **Estimation** `1` j·h · **Dépend de** `P1-001e` (thème de la box), `P1-001f` (logo & Storage) · **Spec** §11.2 (white-label N0), §6.2 · **Origine** demande commanditaire, 19 septembre 2026 · **Avant** `P2-004`

## Objectif

L'owner, le manager et le coach voient le **logo et le nom de leur box** dans le
back-office — pas seulement le logo de Rack. L'outil de gestion porte la marque de
la box, sur chaque écran.

## Pourquoi ce ticket existe, et où passe la ligne

`P2-017` (fait, PR #115) a white-labellisé le **côté membre** : « un membre
n'aperçoit jamais le mot Rack ». Sa ligne s'arrêtait là, volontairement — le
back-office n'était pas dans son périmètre. Résultat : le shell du back-office
affiche encore `RackLogo`, avec un commentaire qui l'assume comme provisoire
(`apps/web/app/box/[slug]/shell.tsx` : *« en attendant que themes serve un
logo »*). La **couleur** de la box est déjà partout ; il manque le **logo** et le
**nom**.

Ce ticket **étend la ligne de P2-017 au côté opérateur**. Ce n'est pas « ajouter
une image » : c'est un choix de marque.

## La décision, actée : co-brandé

Le back-office est **co-brandé**, pas 100 % box :

- Le **logo (ou le nom) de la box** est l'identité principale, en tête du shell,
  sur tous les écrans.
- Un **« propulsé par Rack »** discret en pied de la coquille. L'owner paie
  l'abonnement SaaS à Rack ; effacer Rack de l'outil qu'il paie n'a pas de sens,
  et le co-brand est le standard SaaS.

*(Alternative écartée : 100 % box, zéro Rack dans le back-office — déféré au N1
avec le domaine personnalisé, si un jour un client le paie.)*

## Ce que ce ticket suppose et qui doit exister

| Prérequis | Où il vit | État |
| --- | --- | --- |
| Thème par box, `logo_url` résolu | `useTheme()` / `TenantBrand` (P1-001e) | ✅ existe côté mobile ; le résoudre **pour le shell web** est le cœur de ce ticket (le fameux « en attendant que themes serve un logo ») |
| Logo public, affichable sans URL signée | P1-001f (public par destination) | ✅ — le logo s'affiche déjà avant login sur `/invitation/[token]` |
| Composant `RackLogo` + variante repliée (initiale) | `apps/web/app/rack-logo.tsx` | ✅ — le patron « logo → initiale replié » existe déjà, à décliner pour la box |

## Périmètre

- Le **layout du back-office sert `logo_url` + `app_name`** de la box au shell
  (aujourd'hui il ne les sert pas — c'est le blocage nommé par le commentaire).
- Le **shell affiche le logo de la box** en tête, à la place du `RackLogo`
  principal. **Repli sur le nom en toutes lettres** si la box n'a pas de logo —
  jamais un trou, jamais un logo cassé.
- **Replié** (coquille étroite) : le logo se réduit à son initiale, comme
  `RackLogo compact` le fait déjà pour le « R ».
- Un **« propulsé par Rack »** discret en pied de shell (texte + petit `RackLogo`).
- **Zéro couleur en dur** ; tout par tokens (règle §12.1 / ADR 0003).
- Le commentaire *« en attendant que themes serve un logo »* **disparaît** — le
  thème sert le logo.

## Ce que ce ticket rend possible

- `P2-004` (dashboard) **en hérite gratuitement** : le bonjour « Camille »
  s'affiche à côté du logo/nom de la box, l'identité est posée dès l'accueil.

## Hors périmètre

- E-mails 100 % marque box, domaine personnalisé (white-label N1, différé avec
  l'entité).
- Nom / icône du binaire par box (N2, app dédiée — §2.4).
- Les **avatars de membres** : donnée personnelle sous consentement
  (`.claude/rules/privacy.md`), pas de l'identité de marque. Fonctionnel et
  optionnel, à traiter là où ça sert une tâche, dans un autre ticket.
- Toute **photographie décorative** : un back-office est un outil de données ;
  l'identité passe par le logo et la couleur, pas par de l'image de stock.

## Critères d'acceptation

- [ ] Le back-office affiche le logo de la box en tête, sur **chaque** écran
- [ ] Une box sans logo affiche son **nom** en toutes lettres, jamais un trou ni
      un logo cassé
- [ ] Repli de la coquille : le logo se réduit proprement (initiale)
- [ ] Un « propulsé par Rack » discret est présent en pied de shell
- [ ] Aucune couleur en dur dans les composants touchés ; `pnpm i18n:check` vert
- [ ] Le commentaire « en attendant que themes serve un logo » n'existe plus

## Notes

Ticket de chrome, court. Le gros du travail est de **servir `logo_url` au shell**
(la donnée existe, elle n'est juste pas passée au layout web) ; le reste est du
rendu déjà balisé par `RackLogo`.
