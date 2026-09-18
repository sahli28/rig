# `P2-021` — Passe design mobile (et direction visuelle)

**Phase** `P2` · **Estimation** `4` j·h · **Dépend de** `P1-001e` (thème), la galerie de composants · **Spec** §12 · **Origine** demande commanditaire, 14–16 septembre 2026 (réf. visuelle : Hustle Up)

## Objectif

Les écrans membres passent d'« ça marche » à « on a envie de l'ouvrir » —
accueil, planning, WOD, carte membre — sur une direction visuelle assumée,
inspirée de ce qui rend Hustle Up agréable, sans le copier.

## Ce que ce ticket suppose et qui doit exister

| Prérequis | Où il vit | État |
| --- | --- | --- |
| Kit de 22 composants + galerie | `apps/mobile/components` | ✅ existe — la passe retouche l'assemblage et les tokens, pas les primitives |
| Tokens de thème (couleurs, espaces, rayons, typo) | P1-001e | ✅ existe, correction de contraste comprise |
| Les écrans à reprendre | accueil, planning, WOD, carte membre | ⚠️ **vérifié le 18 sept. 2026 : faux pour deux sur quatre.** Accueil et planning existent. **La carte membre n'existe pas** (aucun écran, aucun QR côté membre dans `apps/mobile`) → sortie du ticket, à écrire au prochain lot de documentation. Le **WOD du jour** est sorti à la demande de la commanditaire : son contenu arrive avec `P2-012`/`P2-013`, il héritera de la direction posée ici |
| Une direction visuelle décidée | `docs/design/maquette-direction-P2-021.html` | ✅ **validée le 18 sept. 2026** (« Craie & acier », barre d'onglets comprise). Était : ❌ **première étape de ce ticket** : trancher la direction (typo, densité, thème sombre par défaut §12.1, accents) **avant** de toucher un écran. C'est aussi le « autre thème » demandé le 16 sept. — décidé ici, partagé avec `P2-022` |

## Périmètre

- Étape 0 : direction visuelle (1–2 planches), validée avant tout code, partagée
  avec la passe web (`P2-022`).
- Reprise des quatre écrans membres : hiérarchie, respiration, lisibilité à bout
  de bras (§12.1), états vides parlants (§12.1, principe 7).
- Aucune couleur en dur ; tout par tokens (la passe est aussi un filet pour la
  règle des tokens).

## Hors périmètre

- De nouveaux composants → si un écran en réclame un, c'est un ticket à part
  (« ce qui déborde devient un ticket »).
- Le back-office → `P2-022`.
- Le nom / l'icône du binaire → hors MVP (N2).

## Critères d'acceptation

- [x] La direction visuelle est validée **avant** la première retouche d'écran — maquette HTML, feu vert le 18 sept. 2026
- [x] Les écrans repris (accueil, planning, réservations, bienvenue, connexion)
      respectent §12 — **vérifié sur le harnais web seulement** (FR/EN, clair/sombre,
      Rueil/plateforme, arbre d'accessibilité lu). Contraste des nouveaux tokens
      couvert par `direction.test.ts`. Ce n'est pas une preuve d'appareil.
- [~] Rendu sur iPhone (la seule preuve qui compte pour du design) — passe appareil

## Ce qui a été livré (18 septembre 2026)

- **Tokens** (`packages/ui/src/theme`) : socle chaud, `surface3`, `scrim`,
  `onImage`, `onImageMuted`, `motion` ; `softTone()` et `scrimBands()`, purs et
  testés ; variables CSS correspondantes — **le back-office change donc de socle
  dès ce ticket**, avant `P2-022`.
- **Kit** : `Icon` (Feather, liste fermée partagée avec `lucide-react`),
  `Scrim`/`ImageBackdrop`, `Badge` en aplat doux + icône, `Button` avec icône,
  `ListRow.footer`, états pressés visibles. Appelants : les écrans ci-dessous.
- **Navigation** : `(app)/(tabs)` — Accueil / Planning / Réservations / Profil.
  Les URL ne changent pas. Barre masquée tant qu'aucune box n'est résolue.
- **Images** : trois fonds (48–98 Ko) dans `apps/mobile/assets/backdrops`, servis
  par `lib/theme-images.ts`, seul point d'entrée. Bienvenue, bandeau de connexion,
  carte héro, états vides — jamais le planning.
- **Glyphes texte** ‹ › × ✓ remplacés par des icônes (planning, calendrier du
  mois, galerie, `Select`).
- **Dépendance** : `@expo/vector-icons` (JS + police via `expo-font`, déjà dans le
  binaire). **Pas de `expo-linear-gradient`** : module natif = nouveau build ; le
  voile est fait de bandes d'alpha, donc la passe peut partir en OTA — **à
  confirmer sur l'appareil**, c'est une supposition.

## Trouvailles notées ici (règle 11 — pas de ticket avant le prochain lot docs)

- **Carte membre absente** alors que la fiche la disait existante (ci-dessus).
- **Fonds fournis** : une image porte la marque ROGUE, deux « RACK CROSSFIT »
  (marque déposée) — écartées. Seules les trois sans marque tierce sont embarquées.
- **`Inter` n'est chargée nulle part** : `fontFamily: 'Inter'` retombe sur la
  police système (San Francisco sur iOS, **Times dans le harnais web**). Antérieur
  à ce ticket ; à trancher : charger Inter, ou assumer la police système.
- **Image de thème par box** : `themes` n'a pas de colonne d'image et aucun
  ticket ne la porte. `lib/theme-images.ts` est l'endroit où elle se branchera.
- **Le calendrier du mois pousse la liste sous la ligne de flottaison** sur le
  planning. La maquette montrait une bande de semaine ; la grille (`P1-014`) a été
  gardée pour ne pas refaire une navigation testée. Candidat pour une suite.
- **Deux 401 au chargement** dans la console du harnais, avant tout choix de box.
  Antérieurs (aucun code réseau touché ici) ; non expliqués — donc à revoir.
- `class/[id].tsx:852` fait `router.push('/preferences')` : la cible est
  désormais un onglet. À regarder pendant la passe (retour vers la fiche de cours).

## Notes

« Amélioration design » n'est pas mesurable en soi ; ce ticket la rend mesurable
en nommant quatre écrans et une direction. D'autres écrans s'ajoutent en puces ou
en second ticket, pas en cours de route.
