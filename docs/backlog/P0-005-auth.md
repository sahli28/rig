# P0-005 — Authentification et session · **découpé**

Ce ticket annonçait 5 j·h. L'inventaire mené avant de l'attaquer en a montré ~17 :
il fallait poser les clients Supabase, la couche d'accès aux données, trois
fournisseurs d'authentification, cinq écrans, l'export et la suppression RGPD.

Il est découpé selon une ligne nette — **ce qui dépend d'un tiers, et ce qui n'en
dépend pas** :

| Ticket | Contenu | j·h |
| --- | --- | ---: |
| [P0-005a](P0-005a-connexion.md) | Clients, magic link, session, `me()`, profil public de la box, invitation, écrans | 6 |
| [P0-005b](P0-005b-sso-google.md) | SSO Google sur trois plateformes + linking d'identités | 4 |
| [P2-002](P2-002-rgpd-self-service.md) | Export, suppression de compte, anonymisation J+30 | 5 |
| [P2-003](P2-003-sign-in-apple.md) | Sign in with Apple — **bloquant de publication** | 3 |

## Ce qui sort du périmètre au passage

- **Box Switcher** — une box pilote est une box. L'interface multi-box part avec
  le réseau inter-box, où elle a un sens.
- **Gestion des invitations côté OWNER** — part en P1-001 avec les réglages de la
  box. Seul le chemin d'**acceptation** reste en P0-005a.

## Ce que le découpage préserve

Google est câblé **dès P0-005b**, et non repoussé. La raison n'est pas le confort
d'inscription : c'est que `handle_new_user`, durci en P0-004, refuse désormais une
adresse déjà prise. Sans un second fournisseur, ce comportement n'est jamais
exercé — et se découvrirait au mois 6, sur une vraie adhérente, avec une erreur
GoTrue opaque.

Le report de P2-002 est conditionné à
[`docs/procedures/effacement-manuel.md`](../procedures/effacement-manuel.md) :
reporter l'outillage ne reporte pas l'obligation légale.
