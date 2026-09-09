# Passe manuelle — back-office web

Deux scénarios courts, à faire dans un navigateur, sans téléphone ni émulateur.
Ils couvrent ce qui est réellement livré à ce jour : la porte du back-office
(P1-001a), les rôles (P1-001c) et l'apparence de la box (P1-001e).

À rejouer avant chaque merge de branche P1, et après chaque `supabase db reset`.

---

## 0. Préparer (5 minutes, une seule fois)

```bash
cd C:\Users\sahli\imys

# 1. Supabase local
pnpm exec supabase status        # s'il ne répond pas :
pnpm exec supabase start

# 2. Base propre + fixtures (migrations + seed.sql)
pnpm exec supabase db reset      # local. JAMAIS --linked.

# 3. Le serveur web seul (pas `pnpm dev` : inutile de démarrer Metro)
pnpm --filter @rack/web dev
```

`apps/web/.env.local` doit exister et contenir :

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:55321
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...   # ligne "publishable key" de supabase status
```

Si l'écran affiche « Configuration absente », c'est ce fichier qui manque ou le
serveur qui n'a pas été relancé après sa création.

Deux onglets ouverts :

| Onglet | URL |
|---|---|
| L'app | http://localhost:3000 |
| La boîte aux lettres (Mailpit) | http://127.0.0.1:55324 |

> **Une seule orthographe d'hôte pour l'app.** Reste sur `localhost:3000` du
> début à la fin. Un cookie de session posé sur `localhost` n'est pas envoyé à
> `127.0.0.1` : passer de l'un à l'autre en cours de route te déconnecte sans
> message d'erreur, et tu croirais à un bug d'authentification.

### Les comptes du seed

| Adresse | Box | Rôle |
|---|---|---|
| `marc@rueil.example` | CrossFit Rueil (`crossfit-rueil`) | OWNER |
| `hugo@rueil.example` | Rueil **et** Nanterre | MANAGER à Rueil, MEMBER à Nanterre |
| `lea@example.com` | Rueil | MEMBER |
| `claire@nanterre.example` | CrossFit Nanterre (`crossfit-nanterre`) | OWNER |

Aucun mot de passe : la connexion web se fait par lien magique.

---

## Scénario A — la porte du back-office (~7 min)

Ce qu'il prouve : on n'entre pas sans être connecté, on n'entre pas chez une
box qui n'est pas la sienne, et un rôle insuffisant est refusé proprement.

| # | Action | Résultat attendu |
|---|---|---|
| A1 | Déconnectée, ouvrir `http://localhost:3000/box/crossfit-rueil` | Redirection vers `/login`. Pas un écran vide, pas une erreur. |
| A2 | Saisir `marc@rueil.example`, valider | « Lien envoyé » + l'adresse rappelée |
| A3 | Onglet Mailpit → ouvrir le dernier message → cliquer le lien | Retour sur `/box/crossfit-rueil`, en orange `#E4572E`, badge « Propriétaire », menu : Tableau de bord · Réglages · **Apparence** · Équipe · Membres |
| A4 | Dans la barre d'adresse : `/box/crossfit-nanterre` | « Box inconnue ou accès refusé ». **Jamais** de données de Nanterre, jamais une erreur 500. C'est le test d'isolation vu du navigateur. |
| A5 | Revenir sur Rueil → « Se déconnecter » | Retour à l'accueil ou à `/login` ; `/box/crossfit-rueil` redemande la connexion |

### Extension A′ — la différence entre « autorisée quelque part » et « autorisée ici »

| # | Action | Résultat attendu |
|---|---|---|
| A6 | Se connecter en `hugo@rueil.example`, aller sur `/box/crossfit-rueil` | Badge « Gestionnaire », et **pas de lien Apparence** dans le menu |
| A7 | Taper quand même `/box/crossfit-rueil/apparence` | Refus « réservé au propriétaire ». Le menu caché ne suffit pas : c'est le serveur qui doit dire non. |
| A8 | Aller sur `/box/crossfit-nanterre` (Hugo y est simple membre) | « Espace réservé au staff » — et **pas** « box inconnue ». La nuance compte : il appartient à cette box, il n'y administre rien. |
| A9 | Se déconnecter, se connecter en `lea@example.com`, aller sur `/box/crossfit-rueil` | « Espace réservé au staff » — et le texte nomme **les trois rôles** qui entrent : propriétaire, gestionnaire, coach |

### Extension A″ — la porte du coach (`D-021`)

Ce qu'elle prouve : le coach entre, ne voit que ce qui le concerne, et le
serveur refuse le reste même quand on tape l'adresse. **C'est la passe qui
ferme le critère resté ouvert de `P1-015`** — le 9 septembre 2026, Sarah était
refusée à la porte et la séance avait été jouée en administration.

| # | Action | Résultat attendu |
|---|---|---|
| A10 | Se déconnecter, se connecter en `sarah@example.com` (COACH), aller sur `/box/crossfit-rueil` | **Elle entre.** Badge « Coach », menu : Tableau de bord · **Planning** — et rien d'autre. Ni Réglages, ni Équipe, ni Membres, ni Apparence |
| A11 | Taper `/box/crossfit-rueil/reglages`, puis `/staff`, puis `/membres` | « Section réservée », et le texte dit **où aller** : le planning. Le menu caché ne suffit pas, c'est le serveur qui dit non |
| A12 | Taper `/box/crossfit-rueil/apparence` | « Section réservée » aussi — **pas** « réservé au propriétaire », dont le texte promet les horaires et l'équipe à qui ne les a pas |
| A13 | Planning → ouvrir une occurrence | **La séance vient en premier.** Titre, pré-remplissage, champ, « Publier », puis « Enregistrer » — **aucun** panneau d'annulation, aucun « Motif » : un coach n'annule pas. Un seul bouton primaire. « Fermer » en bas |
| A14 | Écrire trois blocs séparés par des lignes vides, cocher « Publier », enregistrer | « Enregistré » — **c'est le geste du § 5 septies de la passe iPhone, joué dans le rôle que le ticket visait**. Cocher le critère de `P1-015` seulement maintenant |
| A15 | Se reconnecter en `marc@rueil.example`, ouvrir la même occurrence | La séance de Sarah est là, en premier. **Sous un trait**, un bouton « Annuler ce cours » en variante danger — pas de champ « Motif » tant qu'on ne l'a pas pressé. Le presser ouvre le motif et « Confirmer l'annulation », **qui n'est pas primaire**. Fermer, rouvrir : le motif est replié |

---

## Scénario B — le white-label, de bout en bout (~5 min)

Ce qu'il prouve : la couleur choisie par la propriétaire traverse jusqu'à un
écran vu par quelqu'un qui n'est ni connecté ni membre. C'est la promesse
white-label rendue observable, pas déclarée.

Connectée en `marc@rueil.example`.

| # | Action | Résultat attendu |
|---|---|---|
| B1 | Menu → **Apparence** | Le formulaire + un aperçu en thème clair **et** sombre |
| B2 | Dans le champ hexadécimal, saisir `#F2E8A0` (jaune pâle) | Message de contraste : la couleur est acceptée mais l'app affichera une variante lisible, avec les deux ratios. **Ne pas enregistrer.** |
| B3 | Saisir `#16457A`, changer « Nom affiché » en `Rueil Box` | « Contraste x:1 — lisible sans correction » |
| B4 | Enregistrer | « Enregistré » |
| B5 | Cliquer « Tableau de bord » | Toute la coquille est repeinte en bleu |
| B6 | **Fenêtre de navigation privée** (donc déconnectée) → `http://localhost:3000/invitation/inv-rueil-0001` | La page d'invitation porte le nouveau nom et la nouvelle couleur. C'est l'étape qui compte : le branding franchit la frontière de l'authentification. |
| B7 | Revenir dans Apparence, remettre `#E4572E` et `CF Rueil` | Le seed est de nouveau conforme (sinon : `pnpm exec supabase db reset`) |

---

## ⚠️ Cette page a pris du retard — lu le 6 septembre 2026

**Les deux scénarios ci-dessus couvrent P1-001a et P1-001e. Rien d'autre.**
Depuis, cinq lots touchant `apps/web` ont été fusionnés sans qu'aucun scénario
ne soit écrit ici :

| Livré | Ce qui n'a jamais été exercé au navigateur |
| ----- | ------------------------------------------ |
| P1-001b | Réglages de la box, horaires d'ouverture, types de cours |
| P1-001c | Invitation d'un membre du staff de bout en bout, **journal d'audit** |
| P1-001d | **Import CSV d'un effectif** — mapping des colonnes, prévisualisation, doublons |
| P1-002 | La **grille de semaine** et la création récurrente (RRULE) |
| P1-004 | **Annuler un cours depuis le back-office**, et le sort de ses réservations |

Le dernier est le plus coûteux à laisser sans scénario : c'est une action
**destructrice** qui touche les réservations de vraies personnes, et le ticket
P1-004 a justement trouvé là une sœur oubliée — annuler un cours laissait ses
réservations confirmées. La passe mobile couvre l'annulation *par le membre*,
pas l'annulation *par la box*. Personne ne regarde ce chemin aujourd'hui.

**Ce paragraphe remplace un texte devenu faux**, qui disait : « Aucune table de
planning, de réservation, de programmation ni de paiement n'existe à ce jour.
Ne cherche donc pas : planning, réservation… ». C'était vrai le 2 septembre.
`class_schedules`, `classes`, `bookings`, `class_roster` et `cancel_booking()`
sont en base depuis. Une page de passe qui dit « ne cherche pas » certifie par
omission — c'est le faux vert que ce dépôt traque, déplacé dans la
documentation.

## Ce qui n'est vraiment pas testable au navigateur

Programmation, WOD, scores, leaderboard, abonnements, crédits, check-in QR :
ces tables n'existent pas (P2-005 à P2-014). Le mobile a sa propre passe —
`docs/passe-mobile-iphone.md` — qui demande `apps/mobile/.env.local` pointant
sur l'**IP LAN** de la machine, pas sur `127.0.0.1`. Faite les 3, 4 et
5 septembre 2026.

## En cas d'échec

Noter trois choses, et rien d'autre : l'URL exacte, le message affiché mot pour
mot, et la ligne rouge de la console (F12 → Console). C'est le contenu du
ticket. Ne jamais coller une clé `sb_secret_…` ni le contenu d'un `.env.local`
dans un rapport ou une capture.
