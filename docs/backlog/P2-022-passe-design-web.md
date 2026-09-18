# `P2-022` — Passe design web (back-office)

**Phase** `P2` · **Estimation** `3` j·h · **Dépend de** `P2-021` (direction visuelle partagée) · **Spec** §12, §6.2 · **Origine** demande commanditaire, 16 septembre 2026 (réf. visuelle : Hustle Up)

## Objectif

Le back-office (planning, membres, programmation) devient lisible et rapide à
piloter au clavier, sur la même direction visuelle que le mobile.

## Ce que ce ticket suppose et qui doit exister

| Prérequis | Où il vit | État |
| --- | --- | --- |
| Base de composants web accessible (shadcn/Radix, §12.2) | `apps/web` | ✅ **confirmé le 18 sept. 2026** : Radix `alert-dialog`, `dropdown-menu`, `tabs` + CSS Modules (ADR 0005). Pas de shadcn — voulu. Aucun paquet Radix ajouté par cette passe |
| La direction visuelle | `P2-021` étape 0 | ✅ décidée là, réutilisée ici |
| Les écrans back-office | planning, membres, réglages, program builder | ✅ existent (P1 + `P2-010`) — **sauf le tableau de bord**, que la demande citait comme écran clé : `box/[slug]/page.tsx` n'est qu'un « Écran à venir ». Habillé par la coquille, **non construit** ici (hors périmètre) ; aucun ticket ne le porte encore |

## Périmètre

- Reprise visuelle des écrans back-office clés, **clavier d'abord** (§12.4 :
  navigation clavier complète, `aria-live` sur les compteurs de places).
- Cohérence avec la direction mobile (mêmes tokens, même langage).
- **Cas nommé — l'écran Équipe** (relevé en test le 18 sept. 2026, captures) : la
  ligne membre empile **deux concepts** (le rôle ET l'accès) et **deux boutons
  rouges** aux libellés proches — « Retirer » = *exclure de la box*, « Retirer
  l'accès » = *retirer l'abonnement*. À reprendre : séparer le rôle (rare →
  discret, auto-appliqué sans bouton « Appliquer ») de l'accès (fréquent → durée
  + un seul bouton « Donner l'accès » qui devient « Prolonger » si un accès est
  actif) ; mettre les actions destructives derrière un menu « … » avec
  confirmation ; libellés distincts (« Exclure de la box » ≠ « Retirer l'accès »),
  jamais deux « Retirer ».

## Hors périmètre

- Le program builder dans le détail → il a son ticket (`P2-010`) ; la passe
  l'habille, ne le construit pas.
- Le mobile → `P2-021`.

## Critères d'acceptation

- [x] Les écrans back-office clés suivent la direction visuelle et §12.4 (clavier,
      contraste, focus) — planning, membres, réglages, apparence et Équipe
      regardés en session OWNER sur CrossFit Rueil le 18 sept. 2026, clair et
      sombre. Le tableau de bord n'existe pas (voir plus haut).
- [x] Rendu web vérifié dans un navigateur (Playwright ou manuel) — fait, **en
      français seulement** : le back-office suit la langue par défaut de la box et
      n'a pas de sélecteur en session ; passer en EN aurait demandé d'écrire dans
      les réglages de la box. Parité des clés vérifiée, rendu EN **vérifié via le sélecteur de langue (D-040)**. Et les
      menus Radix n'ont été ouverts qu'au clavier et par événement (le harnais
      n'envoie pas de `pointerdown`) : la souris réelle reste à confirmer.

### Ce que la session réelle a trouvé, et que la page de démo ne montrait pas

Quatre défauts, tous invisibles sur `/design-system/coquille` — un écran de
démonstration ne prouve que ce qu'il montre :

- les créneaux du planning étaient **en Times** : deux règles portaient
  `font-family: var(--rack-font-family)` sans repli, et `Inter` n'est chargée
  nulle part → `inherit` ;
- « Semaine précédente / suivante » sont des **liens** habillés en boutons :
  carrés et soulignés, parce que `globals.css` ne donne rayon et hauteur qu'aux
  `<button>` → `.button` les redit ;
- « Vendredi18/09 » : `.today` n'avait pas de `display: block` (antérieur), et
  « aujourd'hui » n'était porté que par la couleur → pastille + `aria-current` ;
- « Prolonger » **débordait de son fond** sur l'Équipe réelle, comprimé par le
  flex de la ligne → `flex-shrink: 0`.

Plus deux titres de carte passés par erreur en taille de page (membres,
apparence), et le bouton natif du champ fichier, resté gris système.

## Ce qui a été livré (18 septembre 2026)

- **`app/ui.module.css`** : le langage commun (cartes, boutons, champs, pastilles,
  menus, dialogues, squelette). Les cinq modules d'écran le **composent** au lieu
  de porter chacun leur copie du même bouton. Appelants : tous les écrans
  `box/[slug]/*` et `/login`.
- **Coquille** : volet latéral **repliable** (icônes seules, état retenu en
  `localStorage`, `aria-expanded`, libellés gardés dans l'arbre d'accessibilité),
  barre haute sous 900 px, lien d'évitement, marque Rack en haut, box + rôle en
  bas avec le menu de compte. Icônes `lucide-react` — même famille que le Feather
  du mobile.
- **`RackLogo`** : placeholder en texte et en tokens (« R » dans un pavé + « ACK »),
  `compact` pour le volet replié. **À remplacer par le SVG de la commanditaire** :
  le PNG fourni est sur fond clair, inutilisable sur un volet sombre.
- **Zéro tap mort** : `box/[slug]/loading.tsx` — squelette immédiat à chaque
  navigation ; états pressés sur liens et boutons ; `aria-busy` pendant une action.
- **Écran Équipe** (le cas nommé) : accès visible avec un seul bouton (« Donner
  l'accès » → « Prolonger »), rôle dans le menu « … » appliqué à la sélection,
  gestes destructeurs dans le même menu avec confirmation, « Exclure de la box »
  ≠ « Retirer l'accès ». La clé `staff.apply` disparaît.
- **§12.4** : `aria-live` sur les compteurs de places du planning.
- **Connexion** : deux colonnes, photo voilée (token `scrim`) à côté du
  formulaire, jamais derrière. `public/backdrops/login.jpg`, 76 Ko.
- **Dépendance** : `lucide-react` — le jeu d'icônes demandé, pendant web du
  Feather mobile.

## Trouvailles notées ici (règle 11)

- **Tableau de bord inexistant** (ci-dessus).
- **Pourquoi le rôle n'est pas un `<select>` auto-soumis** : au clavier, un
  `<select>` fermé change de valeur à chaque flèche — traverser la liste aurait
  nommé quelqu'un gestionnaire en passant.
- **Un `eslint-disable` justifié** dans `staff/directory.tsx` : `valeur ===
  row.role` n'est pas une porte, c'est « rien n'a changé ». La règle, elle, a
  mordu comme prévu.
- **Le back-office tutoie** (« Connecte-toi », « ta box ») alors que la spec §12.3
  demande le vouvoiement côté professionnel. Antérieur à ce ticket, non touché.
- **Le volet de la page de démo** (`/design-system/coquille`) est une sonde :
  `notFound()` hors développement, dès sa première ligne (règle 9).
- Le harnais du volet navigateur n'envoie pas de `pointerdown` : les menus Radix
  ne s'ouvrent pas à son clic. Ouverts par événement et au clavier pour la
  vérification ; à la souris réelle, à confirmer pendant la passe en session.

## Notes

Après `P2-021` : la direction se décide une fois, pour les deux surfaces.

**Retour de test du 18 septembre 2026.** L'écran Équipe (staff) est le premier
jugé « brouillon, trop de boutons » par la commanditaire — c'est le cas d'usage
concret qui guide cette passe (détaillé dans Périmètre). Vérifié à cette
occasion : **aucun** de ces boutons n'envoie d'e-mail ni de notification ;
prévenir le membre à l'attribution ou au retrait de son accès reste hors
périmètre (motif laissé ouvert par `P2-018`), à rouvrir si l'usage le demande.
