# P2-010 — Program Builder : l'écran où le coach travaille

**Phase** P2 · **Estimation** 7 j·h · **Dépend de** P2-009, P1-002 · **Spec** §4-P5, §6.2

## Objectif

Un coach compose un cycle de 8 semaines dans le back-office web, rattache ses
séances aux créneaux du planning, et programme leur publication. Dupliquer une
semaine prend moins de 5 secondes (RM5.8).

C'est **le différenciateur n°1** de la spec (M12), et c'est aussi l'écran où la
comparaison avec Wodify se fait ou se perd. Un tableur mal déguisé ne suffira
pas ; un éditeur trop malin non plus.

## Ce que ce ticket suppose et qui doit exister

| Prérequis | Où il vit | État |
| --------- | --------- | ---- |
| Tout le modèle d'entraînement + `movements` semé | P2-009 | ❌ **à créer par P2-009** |
| `publish_session()`, `version_program()` | P2-009 | ❌ **à créer par P2-009** — ce ticket est leur appelant, c'est ce qui les rend « faites » |
| `classes` (occurrences datées, pour rattacher une séance) | P1-002 | ❌ **à créer par P1-002** |
| Coquille du back-office, garde de rôle, i18n web | P1-001a | ✅ existe |
| Radix Primitives + CSS Modules (ADR 0005) | `apps/web` | ✅ existe |
| **Un composant de liste réordonnable au clavier** | `packages/ui` / `apps/web` | ❌ **à créer ici.** L'ordre des blocs et des mouvements est le cœur de l'écran. Radix n'en fournit pas ; `dnd-kit` est la dépendance à peser, avec son alternative « flèches haut/bas », qui est accessible par construction et coûte une heure |
| **Un champ de recherche à autocomplétion** (bibliothèque de mouvements) | `packages/ui` | ❌ **à créer ici.** Radix `Combobox` n'existe pas ; c'est `Popover` + `Command` à assembler soi-même, ou une liste filtrée simple. Prévoir la journée, pas l'heure |
| Test de rendu des composants web | D-002 (dette ouverte) | ⚠️ **absent.** C'est l'écran le plus riche du produit et rien ne teste un rendu. D-002 devient bloquante ici, ou on l'assume par écrit |

## Ce que ce ticket rend possible, et qui l'appellera

| Ce que je livre | Appelé par | Ticket |
| --------------- | ---------- | ------ |
| L'écran `/box/[slug]/programmes` et ses Server Actions | le coach | celui-ci |
| Le rattachement `sessions.class_id` | le planning, le WOD du jour | P2-012 |
| La publication planifiée (`published_at` future) | un job `pg_cron`, et la notification | P2-012 |

## Périmètre

- `/box/[slug]/programmes` — liste, création, duplication, archivage.
- Éditeur de programme : grille semaines × jours, création d'une séance sur une
  case, glisser ou déplacer une séance d'un jour à l'autre.
- Éditeur de séance : blocs ordonnés, chacun avec son `kind` (WARMUP, STRENGTH,
  METCON, ACCESSORY, COOLDOWN), son `format` (`FOR_TIME`, `AMRAP`, `EMOM`,
  `TABATA`, `STRENGTH`, `INTERVAL`, `CHIPPER`), son `time_cap_s`, ses `rounds`,
  sa description bilingue.
- Éditeur de bloc : mouvements issus de la bibliothèque, reps, distance,
  calories, charge — la charge en pourcentage de 1RM appartient à P2-011.
- **Duplication** : une semaine, ou un cycle entier, avec décalage automatique
  des dates (RM5.8). En **une fonction PLpgSQL**, pas en N appels : c'est la
  seule façon de tenir les 5 secondes, et c'est la règle 3 de `CLAUDE.md`.
  **Ce critère a été transféré depuis P1-002** (2026-09-03) : il y avait été
  recopié par erreur, alors que RM5.8 porte sur un cycle d'entraînement et non
  sur un planning récurrent, où une semaine se répète déjà par définition. C'est
  ici qu'il a un objet, et c'est le seul endroit où il en a un.
- Rattachement d'une séance à un ou plusieurs `classes` du planning.
- Publication : immédiate, ou planifiée (« la veille à 18 h »), en heure locale
  de la box — règle 9 de `CLAUDE.md`.
- **Versionnement** (RM5.1) : modifier un programme déjà publié crée une
  version. L'écran le dit avant, pas après.

## Ce qui décidera de la qualité de cet écran

**La vitesse de saisie d'un metcon.** Un coach saisit « 21-15-9 Thrusters /
Pull-ups » en trois secondes sur un papier. S'il lui faut deux minutes et onze
clics ici, il retournera au papier et le produit aura perdu son argument.

À vérifier au plan : une **saisie textuelle** du bloc, analysée côté client, avec
l'éditeur structuré comme filet de rattrapage. Ce n'est pas un raffinement, c'est
peut-être le cœur du ticket — et si c'est le cas, il vaut plus que 7 j·h et il
faut le dire à ce moment-là, pas à la fin.

## Hors périmètre

- Rx / Scaled / Beginner et charges en % de 1RM (P2-011).
- Affichage membre du WOD (P2-012), scores (P2-013), leaderboard (P2-014).
- Notes de coach (S4, P3).
- Générateur assisté par IA (C4, v2). Ne pas y penser avant d'avoir vu un coach
  utiliser celui-ci.
- Écran TV de salle (C8, v2).

## Critères d'acceptation

- [ ] Un coach compose un cycle de 8 semaines et le publie
- [ ] Dupliquer une semaine prend **moins de 5 secondes**, dates décalées —
      mesuré, pas estimé
- [ ] Modifier un programme publié crée une version, sans casser les séances
      déjà rattachées
- [ ] Une séance planifiée à 18 h **heure de la box** apparaît à 18 h heure de la
      box, y compris pour une box dans un autre fuseau — test explicite
- [ ] Toute l'interface se réordonne **au clavier seul** (ADR 0005, §12.4)
- [ ] Zéro chaîne en dur, zéro couleur en dur : `pnpm i18n:check` et la revue
      tokens passent
- [ ] Un MEMBER ne voit ni l'écran ni les séances non publiées

## Notes

C'est le ticket le plus susceptible d'exploser, et il en porte déjà les deux
signes : deux composants d'interface à construire de zéro, et une dette de test
(D-002) qui n'a jamais été payée. Si le plan montre plus de 7 j·h, **le
découper** — le modèle est déjà séparé (P2-009), l'écran peut l'être aussi.
