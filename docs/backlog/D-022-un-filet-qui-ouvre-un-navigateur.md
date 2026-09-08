# `D-022` — Un filet qui ouvre un navigateur

**Phase** dette · **Estimation** `1,5` j·h · **Dépend de** rien · **Spec** §12.1, §16 · **Origine** `D-021` et la porte du coach, 9 septembre 2026

## Objectif

Un test se connecte au back-office **dans un rôle**, ouvre une URL, et vérifie
ce que cette personne voit — ou ne voit pas.

## Pourquoi ce ticket existe, et pourquoi sa justification n'est plus théorique

**`CLAUDE.md` annonçait `pnpm e2e:web` depuis `P0-001`.** Il n'y a ni Playwright,
ni script, ni fichier de test dans `apps/web` — vérifié le 9 septembre 2026. La
ligne a été retirée le jour même : **un document qui promet une commande
inexistante est pire que le silence, parce qu'il fait croire au filet.** C'est la
règle 10 appliquée au document lui-même — il affirmait une capacité que rien
n'exerçait.

Retirer la ligne ne referme pas le trou, ça le rend visible. Et cette fois **le
trou a un incident, pas une hypothèse** :

> **La porte fermée aux COACH, 9 septembre 2026.** `P1-015` a ouvert le droit du
> coach à trois niveaux sur quatre ; le quatrième — `layout.tsx:56` — est resté
> celui de `P1-001a`. Tous les tests étaient verts, parce que les niveaux touchés
> étaient cohérents entre eux. **Il a fallu un humain qui ouvre un navigateur en
> coach pour le voir**, et c'est exactement la forme qu'un test de bout en bout
> attrape : une session, un rôle, une URL, un écran attendu.

`D-021` livre le contrôle le moins cher qui aurait vu celui-là — une décision
d'accès unique, sa table de rôles en Vitest, et une sonde qui interdit une
seconde comparaison de rôle ailleurs. **C'est structurel** : la forme est bonne,
rien n'ouvre un navigateur. Ce ticket-ci est le pendant comportemental, et il
coûte ce qu'il coûte.

## Ce que ce ticket suppose et qui doit exister

*Chaque état est vérifié dans le dépôt, le 9 septembre 2026.*

| Prérequis | Où il vit | État |
| --- | --- | --- |
| Playwright | *rien* — aucune dépendance, aucun `playwright.config`, aucun `*.spec.ts` dans `apps/web` | ❌ **à installer ici**, et c'est une dépendance à justifier en message de commit |
| Un script `e2e:web` | `package.json` | ❌ **à créer ici** — la ligne de `CLAUDE.md` reviendra **avec** lui, pas avant |
| Un moyen d'ouvrir une session **sans humain** | La connexion web est un lien envoyé par e-mail (`docs/passe-manuelle-web.md`, gestes A2–A3) | ⚠️ **c'est l'inconnue du ticket, et la seule.** Deux issues, voir ci-dessous |
| Une base de décor reproductible | `supabase/seed.sql`, `pnpm db:reset` | ✅ quatre rôles réels chez `crossfit-rueil` : `marc` OWNER, `hugo` MANAGER, `sarah` COACH, `lea` MEMBER |
| Mailpit | `supabase/config.toml:107`, port 55324 | ✅ tourne en local, **et expose une API HTTP** |
| Un back-office à exercer | `apps/web/app/box/[slug]/` | ✅ six sections, dont trois avec des gardes de rôle distinctes |

### L'inconnue : comment un test se connecte

**C'est là que passe le coût du ticket**, et c'est la seule décision à prendre
avant d'écrire une ligne :

1. **Par le vrai parcours** — demander le lien, le lire dans l'API de Mailpit,
   le suivre. Lent, dépendant de deux services, mais **il exerce la connexion
   elle-même** : un jour où le magic link casse, ce test le dit ;
2. **Par un cookie de session posé à la main** depuis la clé de service. Rapide
   et stable, mais **il ne prouve plus rien de l'authentification** — il ne
   prouve que ce qui vient après.

**Recommandation à trancher au lancement, pas ici** : (1) une fois dans un test
dédié, (2) pour les quinze autres. Un harnais qui met quarante secondes à se
connecter avant chaque scénario ne sera pas lancé, et un filet qu'on ne lance pas
est un filet qui n'existe pas.

## Ce que ce ticket rend possible, et qui l'appellera

| Ce que je livre | Appelé par | Ticket |
| --- | --- | --- |
| Le harnais et l'aide de connexion par rôle | tous les scénarios web qui suivent | celui-ci |
| Les quatre scénarios de porte | la CI, à chaque PR touchant `apps/web` | celui-ci |
| Un parcours d'argent exerçable de bout en bout | `P2-001` — Stripe Connect traverse plusieurs écrans web, et son retour client ne fait pas foi | `P2-001` |

## Périmètre

- **Playwright installé et configuré**, un seul navigateur, lancé contre le dev
  server local.
- **Une aide de connexion par rôle**, avec la décision ci-dessus tranchée et
  écrite.
- **Les quatre scénarios de porte** — OWNER, MANAGER, COACH, MEMBER — sur ce que
  chacun atteint et ce que chacun lit quand il est refusé. **Ce sont ceux que
  `D-021` ne peut pas prouver.**
- **Le script `e2e:web`, et la ligne de `CLAUDE.md` rendue** — dans le même
  commit, jamais avant.

## Hors périmètre

- **La CI.** Un harnais qui tourne en local d'abord ; l'ajouter à la CI est une
  décision de coût de minutes, à prendre quand il aura prouvé qu'il attrape
  quelque chose. **Le dire ici évite de l'y mettre par réflexe.**
- **Le mobile.** `D-010` a arbitré Maestro et la réponse est « rien maintenant ».
  Ce ticket ne la rouvre pas.
- **Les captures de référence** (tests de rendu visuel) — c'est `D-002`, et une
  autre discipline.

## Critères d'acceptation

- [ ] `pnpm e2e:web` existe, et lance quelque chose qui échoue quand le produit
      est cassé
- [ ] Les quatre rôles sont exercés sur la porte, et le test **rougit** quand on
      rétablit la garde d'avant `D-021` — prouvé dans les deux sens
- [ ] Un scénario au moins passe par **le vrai parcours de connexion**, sinon le
      harnais ne dit rien de l'authentification
- [ ] Le décor est reproductible : `pnpm db:reset` puis la suite, deux fois de
      suite, même résultat
- [ ] La ligne `pnpm e2e:web` est de retour dans `CLAUDE.md`, **dans le commit
      qui livre le script**

## Estimation

| Lot | j·h |
| --- | ---: |
| Playwright, configuration, script, un premier test qui passe | 0,5 |
| L'aide de connexion par rôle, et la décision tranchée | 0,5 |
| Les quatre scénarios de porte, prouvés dans les deux sens | 0,5 |

**1,5 j·h**, **hors totaux** — ce n'est pas dans le chemin du jalon pilote.

## Déclencheur

**Deux, et le premier qui arrive suffit :**

1. **un deuxième défaut de la famille « une porte, un rôle » échappe à la sonde
   de `D-021`.** Le premier a coûté une passe manuelle et un ticket ; le second
   dirait que le contrôle structurel ne suffit pas, et ce serait une mesure et
   non une intuition ;
2. **l'ouverture de `P2-001`.** Stripe Connect est le premier parcours web qui
   traverse plusieurs écrans **et** de l'argent, et la règle 6 dit que le retour
   client ne fait jamais foi. Vérifier ça à la main à chaque fois n'est pas
   tenable.

**Sans l'un des deux, ce ticket reste écrit et non fait** — et `CLAUDE.md` ne
promet plus rien qu'il n'a.

## Notes

**Ce qui rend honnête la phrase de `D-021`** — « ce test ne prouve pas qu'un
navigateur a joué le rôle » — c'est l'existence de ce ticket-ci. Une limite
annoncée sans le ticket qui la lèverait un jour n'est pas une limite, c'est une
excuse.
