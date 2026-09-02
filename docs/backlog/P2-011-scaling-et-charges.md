# P2-011 — Rx / Scaled / Beginner, et les charges en % de 1RM

**Phase** P2 · **Estimation** 4 j·h · **Dépend de** P2-010, P2-013 · **Spec** §2.2 (M13), §4-P5 (étapes 5 et 6, RM5.4)

## Objectif

Un coach déclare trois niveaux pour un bloc, et chaque membre voit **sa** version :
la charge « 75 % du 1RM Back Squat » affichée en kilos, calculée depuis **son**
record.

Sans ça, la spec est nette : « le WOD n'est pas exploitable par 60 % des
membres ». C'est aussi ce qui distingue un affichage de WOD d'un vrai outil de
programmation.

## Ce que ce ticket suppose et qui doit exister

| Prérequis | Où il vit | État |
| --------- | --------- | ---- |
| `variants` (`unique(block_id, level)`), `block_movements.load_pct_1rm`, `load_ref_movement_id` | P2-009 | ❌ **à créer par P2-009** |
| L'éditeur de bloc où loger l'éditeur de scaling | P2-010 | ❌ **à créer par P2-010** |
| **`personal_records`, sans quoi un pourcentage ne se résout pas** | P2-013 | ❌ **à créer par P2-013.** C'est la dépendance qui décide de l'ordre : ce ticket vient **après** les scores, pas avant, contrairement à l'ordre des numéros de la spec (M13 avant M14) |
| `movements.scaling_hint_i18n` (règles de scaling par défaut) | P2-009 | ❌ **à créer par P2-009** — semé avec le référentiel |
| `users.gender` (charges Rx H/F) | `..._identity_and_tenancy.sql` | ✅ existe, **facultatif** (RM1.5). Le cas « non renseigné » n'est pas un cas d'erreur : c'est le cas par défaut |
| Écran membre affichant un WOD | P2-012 | ❌ **à créer par P2-012** |

## Ce que ce ticket rend possible, et qui l'appellera

| Ce que je livre | Appelé par | Ticket |
| --------------- | ---------- | ------ |
| `resolve_block_for_member(block, membership, level)` | l'écran WOD du jour, l'écran TV plus tard | P2-012 |
| L'éditeur de scaling | le coach, dans le Program Builder | P2-010 (écran existant, section ajoutée) |

## Périmètre

- Éditeur de scaling dans le bloc : trois onglets RX / SCALED / BEGINNER,
  chacun surchargeant mouvement, reps, charge ou distance. Ce qui n'est pas
  surchargé **hérite** — un scaling qui recopie tout est un scaling qu'on oublie
  de mettre à jour.
- `variants.overrides jsonb`, validé par un schéma Zod partagé dans
  `packages/core`. Un `jsonb` non validé est une colonne `text`.
- Pré-remplissage depuis `movements.scaling_hint_i18n` : proposer, jamais
  imposer. Le coach corrige en un geste.
- **Résolution des charges en pourcentage, par membre** :
  `resolve_block_for_member()` lit le PR de la personne sur le mouvement de
  référence, applique le pourcentage, arrondit au pas de plaque (2,5 kg par
  défaut, configurable par box — une box en livres n'est pas notre marché
  aujourd'hui).
- **Le cas sans PR est le cas normal, pas une erreur.** Un membre qui n'a jamais
  loggué son Back Squat voit « 75 % de ton 1RM Back Squat », avec un bouton pour
  le renseigner. Pas de kilos inventés, pas de valeur par défaut : une charge
  fausse en force est une blessure.
- Choix du niveau côté membre, mémorisé par type de cours et modifiable à chaque
  séance.

## La règle qui aura des conséquences ailleurs

**RM5.4 — un score Rx et un score Scaled ne sont jamais comparés.** Elle se
décide ici, dans la forme des données (`scores.level` non nul, hérité du
`variant` choisi), et elle se paie dans P2-014. Si le niveau n'est pas enregistré
avec le score, le leaderboard est faux et rien ne le rattrape après coup.

## Hors périmètre

- La saisie et la détection des PR (P2-013), dont ce ticket dépend.
- Les benchmarks nommés (Fran, Grace, Murph — S3, P3), qui sont une autre façon
  de produire des PR.
- Les charges par division Hyrox (RM6.2, v2).
- Les suggestions de scaling automatiques par membre (S4, P3) : ici, le coach
  décide, la bibliothèque propose.

## Critères d'acceptation

- [ ] Un coach déclare Rx / Scaled / Beginner en surchargeant **seulement** ce
      qui change
- [ ] « 75 % 1RM Back Squat » s'affiche en kilos pour un membre qui a le PR, et
      en pourcentage nommé pour celui qui ne l'a pas
- [ ] L'arrondi tombe sur un pas de plaque réel — test unitaire, y compris sur
      les cas laids (52,5 ; 53,75)
- [ ] Un membre sans `gender` renseigné voit une charge Rx, sans qu'on lui
      demande son sexe pour afficher un WOD (RM1.5)
- [ ] Le niveau choisi est enregistré avec le score (prépare RM5.4)
- [ ] Aucune chaîne en dur dans les trois libellés de niveau

## Notes

L'ordre de la spec (M13 puis M14) est **inversé** ici, et c'est délibéré : sans
`personal_records`, la moitié de ce ticket ne peut pas être testée. Le signaler
relève de la règle 6 de `CLAUDE.md`.
