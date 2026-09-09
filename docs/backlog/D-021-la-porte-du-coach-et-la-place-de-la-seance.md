# `D-021` — La porte du coach, et la place de la séance

**Phase** `P1` (dette) · **Estimation** `1,75` j·h · **Dépend de** `P1-015` ✅ · **Spec** §10, §12.1 (principe 2) · **Origine** passe du § 5 septies, 9 septembre 2026

## Objectif

Sarah entre dans le back-office, va au planning et écrit sa séance — dans un
champ qui n'est plus logé sous le bouton qui annule le cours.

## Deux constats d'une même passe, et ils tiennent au même écran

`P1-015` est fusionné et sa passe a été jouée le 9 septembre 2026. L'essentiel
passe. Deux choses ne passent pas, et **aucune des deux n'était visible en
lisant le lot** :

1. **la porte du back-office refuse le COACH**, donc la personne à qui le ticket
   est destiné n'atteint jamais l'écran qu'il lui a construit ;
2. **le formulaire de la séance est logé sous le panneau d'annulation**, donc le
   geste du dimanche soir traverse un champ « Motif » et un bouton « Annuler ce
   cours » avant d'arriver à « La séance ».

Les deux touchent le même dialogue et le même utilisateur. Les faire ensemble
évite d'y repasser, et c'est la seule raison pour laquelle ils partagent un
ticket.

### 1. La porte — trois niveaux sur quatre, et c'est le quatrième qui décide

`P1-015` a ouvert le droit du coach partout **sauf** là où il se vérifie en
premier :

| Niveau | Où il vit | Après `P1-015` |
| --- | --- | --- |
| La policy | `current_staff_tenant_ids()` | ✅ ouverte au COACH |
| La Server Action | `apps/web/app/box/[slug]/planning/actions.ts:72` — `contexteStaff()` | ✅ |
| Le drapeau d'écran | `apps/web/app/box/[slug]/planning/page.tsx:187` — `staff` | ✅ |
| La carte d'occurrence | `apps/web/app/box/[slug]/planning/week-grid.tsx:162` | ✅ |
| **La porte** | `apps/web/app/box/[slug]/layout.tsx:56` | ❌ **inchangée depuis `P1-001a`** |

**Rien n'est cassé _dans_ le lot** : les quatre niveaux qu'il a touchés sont
cohérents entre eux, donc tous les tests passent. Ce qui manque est le niveau
qu'il n'a **pas** touché — la règle des sœurs, un cas de plus, et exactement la
même forme que les précédents : un chemin bien gardé, et son jumeau oublié.

**Et le contrôle qui l'aurait vu n'existe pas** : aucun test n'ouvre le
back-office dans un rôle. C'est le lot 2, et il vaut plus que les deux
correctifs réunis.

### 2. Le panneau — trouvé en jouant, pas en lisant

Dans `week-grid.tsx:168`, le dialogue d'une occurrence empile `CancelForm` puis
`WorkoutForm`. Conséquences, dans l'ordre où on les rencontre :

- **l'action primaire du panneau est destructrice** alors que le geste
  quotidien est l'enregistrement ;
- **deux zones de texte se suivent sans séparation** — « Motif » puis
  « La séance ». Se tromper de champ, c'est écrire son WOD dans celui qui annule
  le cours ;
- **deux boutons primaires sur le même écran**, contre le principe 2 du §12.1 et
  contre `.claude/rules/ui.md:199` — exactement ce que `D-019` vient de corriger
  sur l'accueil mobile.

C'est le geste du dimanche soir, répété quinze à vingt fois par semaine. Le
repère de `P1-015` — « plus rapide que dans Hustle Up » — se joue là.

## Ce que ce ticket suppose et qui doit exister

_Chaque état est vérifié dans le dépôt, le 9 septembre 2026._

| Prérequis | Où il vit | État |
| --- | --- | --- |
| La garde de rôle du back-office | `apps/web/app/box/[slug]/layout.tsx:56` | ✅ existe — **c'est elle qu'on change** |
| Le droit du coach côté planning | `planning/page.tsx:187`, `planning/actions.ts:72` | ✅ **déjà ouverts au COACH** — rien à refaire de ce côté |
| La coquille et sa navigation | `shell.tsx:16` (`NAV`), `shell.tsx:87` (libellé de rôle) | ⚠️ existe, **ne connaît que OWNER et MANAGER** : un COACH s'y verrait annoncé « Gestionnaire », et se verrait proposer Réglages, Équipe et Membres |
| Le texte du refus | `shell.staff_only_body` — « réservé aux propriétaires et gestionnaires » | ⚠️ **il énonce la règle même qu'on change**. À réécrire dans le même commit, sinon l'écran ment à un MEMBER. Son commentaire voisin (`notice.tsx:62`) explique la sortie de secours par « un COACH ou un MEMBER » : il ne vaudra plus que pour le second |
| Les scénarios de rôle de la passe web | `docs/passe-manuelle-web.md`, gestes A6 à A9 | ⚠️ ils couvrent OWNER, MANAGER et MEMBER — **aucun en COACH**. C'est là que le critère rouvert de `P1-015` se ferme, et le geste s'écrit ici |
| `shell.role_coach` | _rien_ | ❌ **à créer ici** (FR + EN) |
| Le lien vers le back-office après une invitation | `apps/web/app/invitations/pending-list.tsx:96` | ⚠️ **la sœur** : un COACH qui accepte son invitation reçoit « bienvenue » et **aucun lien**, parce que la coquille lui répondait « espace réservé au staff ». Elle ne le fera plus |
| Le dialogue d'occurrence | `week-grid.tsx:168` | ✅ existe — l'ordre des deux formulaires y est fixé en dur |
| Le pgTAP de rôle | `supabase/tests/role_isolation_test.sql` | ✅ existe — **la couche base est déjà couverte**, ce ticket ne la retouche pas |
| **Un harnais qui ouvre un navigateur** | `pnpm e2e:web`, documenté dans `CLAUDE.md` | ❌ **n'existe pas** : aucun Playwright dans le dépôt, aucun script dans `package.json`. Voir le lot 2, qui tranche ce que le test couvre et ce qu'il ne couvre pas |

## Ce que ce ticket rend possible, et qui l'appellera

| Ce que je livre | Appelé par | Ticket |
| --- | --- | --- |
| La porte ouverte au COACH | l'écran de séance de `P1-015` | celui-ci — **c'est ce qui rend `P1-015` utilisable par la personne à qui il est destiné** |
| La décision d'accès partagée, et sa table de rôles | `layout.tsx`, `shell.tsx` | celui-ci |

> **Cette porte sert `P1-015`, et elle ne servira pas `P1-008a`.** La question a
> été posée le 9 septembre 2026 et **tranchée le jour même** : la feuille de
> cours du coach est **mobile** — le geste se fait en salle, téléphone en main,
> pendant que les membres arrivent. La spec le dit déjà (§4-P3 : « le coach
> scanne avec son téléphone », écran `Coach Roster`), et `P1-008a` porte
> désormais la décision en toutes lettres.
>
> Écrit ici pour une raison précise : **ce ticket ne se dimensionne pas « au cas
> où `P1-008a` en aurait besoin ».** Ce qu'il ouvre, c'est l'écran du dimanche
> soir sur un ordinateur, et rien d'autre.

## Périmètre

- **La porte** : `layout.tsx` accepte le COACH, et **une seule décision** dit qui
  atteint quoi — pas une comparaison de rôle recopiée dans deux fichiers.
- **La navigation restreinte à ce qui le concerne** : un coach voit le planning,
  pas les Réglages, pas l'Équipe, pas les Membres, pas l'Apparence. Ce n'est pas
  de la sécurité — les policies refusent déjà — c'est ne pas proposer une porte
  qui se ferme, la règle déjà écrite dans `shell.tsx:13`.
- **Le libellé de rôle** et le texte de refus, qui cessent tous deux d'affirmer
  une règle périmée. FR + EN dans le même commit.
- **La sœur des invitations** : un COACH qui accepte reçoit le lien.
- **Le panneau** : la séance d'abord, l'annulation derrière une affordance
  secondaire. **Une seule action primaire.**
- **Le test de la porte par rôle**, et la sonde qui interdit la prochaine sœur.
- **Un geste COACH dans `docs/passe-manuelle-web.md`**, à la suite de A6–A9 : il
  n'y en a aucun, et c'est lui qui ferme le critère rouvert de `P1-015`.

## Hors périmètre

- **Un tableau de bord pour le coach.** `/box/<slug>` rend « écran à venir » ; un
  coach y atterrira comme un gérant. Ce n'est pas ce ticket qui décide de son
  contenu.
- **Toute retouche de la couche base.** Le droit y est déjà bon, et son pgTAP
  aussi.
- **Un harnais Playwright.** Voir ci-dessous : ce ticket dit ce qu'il ne prouve
  pas plutôt que d'installer une pile pour le prouver.

> ### Le test de la porte : ce qu'il attrape, et ce qu'il n'attrape pas
>
> **Ce qu'on écrit** : la décision d'accès devient une fonction pure — « ce rôle,
> cette section » — appelée par `layout.tsx` **et** par la coquille, avec une
> table Vitest des **quatre rôles × toutes les sections**. Plus une sonde, de la
> famille de `pnpm lint:sondes` : **aucune comparaison de rôle ailleurs** sous
> `apps/web/app/box/`. C'est elle qui attrape la sœur suivante, pas la table.
>
> **Ce que ça ne prouve pas** : rien n'ouvre un navigateur. C'est un contrôle
> **structurel** — la forme est bonne — et non **comportemental**. Le contrôle
> comportemental demanderait le harnais Playwright que `CLAUDE.md` annonce et que
> le dépôt n'a pas ; le chiffrer est un autre ticket, à ouvrir le jour où un
> deuxième défaut de cette famille échappe à la sonde. **Écrit ici pour que
> personne ne relise « test de la porte » comme « un navigateur a joué le
> rôle ».**

## Critères d'acceptation

- [ ] Sarah (`sarah@example.com`, COACH de `crossfit-rueil`) atteint
      `/box/crossfit-rueil/planning`, ouvre une occurrence et enregistre une
      séance — **le geste que la passe du 9 septembre n'a pas pu jouer**
- [ ] Elle ne voit **ni** Réglages, **ni** Équipe, **ni** Membres, **ni**
      Apparence dans la navigation, et taper l'adresse d'une de ces sections la
      refuse — le menu caché ne suffit pas, c'est le serveur qui dit non
- [ ] La coquille l'annonce « Coach », pas « Gestionnaire »
- [ ] Un MEMBER reste refusé, et le texte qu'il lit dit **la règle qui
      s'applique** — pas « réservé aux propriétaires et gestionnaires »
- [ ] Un COACH qui accepte son invitation reçoit le lien vers le back-office
      (`pending-list.tsx`), là où il lisait « bienvenue » sans issue
- [ ] Le test par rôle existe : **quatre rôles × toutes les sections**, et il
      **rougit** quand on rétablit la garde d'origine — prouvé dans les deux
      sens, sinon il n'a rien vu
- [ ] La sonde refuse une seconde comparaison de rôle sous `apps/web/app/box/`,
      et **elle mord** : prouvée sur une comparaison ajoutée exprès, puis retirée
- [ ] Dans le dialogue d'une occurrence, **la séance vient en premier** et
      l'annulation est derrière une affordance secondaire. Un seul bouton
      primaire à l'écran, quel que soit le rôle
- [ ] Parité i18n FR + EN, aucune clé orpheline
- [ ] **appareil** — rien à jouer sur l'iPhone : le back-office est un écran de
      PC. **La passe est web** (`docs/passe-manuelle-web.md`), et elle ferme du
      même coup le critère resté ouvert de `P1-015`

## Estimation

| Lot | j·h |
| --- | ---: |
| La porte : `layout.tsx`, la navigation par rôle, le libellé, le texte de refus, la sœur des invitations | 0,75 |
| Le test par rôle : une décision partagée, sa table, et la sonde qui interdit la jumelle | 0,5 |
| Le panneau : la séance d'abord, l'annulation derrière, une seule action primaire | 0,5 |

**1,75 j·h.**

## Notes

**Un cas de plus de la règle des sœurs, et cette fois la sœur oubliée n'est pas
une policy mais une _garde d'écran_.** Elle vit dans un `layout.tsx` que personne
ne rouvre en écrivant une fonctionnalité de planning — là où les sœurs de base se
relisent au moins quand on touche une migration. C'est la raison pour laquelle le
lot 2 compte plus que le lot 1 : le correctif ferme un trou, la sonde ferme la
famille.

**Et le second constat n'a pas d'équivalent automatisable.** Aucune sonde ne dira
qu'un champ est au mauvais endroit dans un panneau. Il a fallu jouer le geste —
c'est ce que les passes manuelles achètent, et c'est pour ça qu'elles se datent.
