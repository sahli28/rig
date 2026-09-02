# P2-003 — Sign in with Apple

**Phase** P2 · **Estimation** 3 j·h · **Dépend de** P0-005b · **Bloquant de publication**

## Ce n'est pas une dette ordinaire

Ce ticket **bloque la publication sur l'App Store**. La guideline 4.8 exige une
option de connexion équivalente respectueuse de la vie privée dès qu'une app
propose une connexion tierce ou sociale — Sign in with Apple est la façon standard
de la satisfaire. Câbler Google en P0-005b déclenche cette obligation.

À revérifier dans la version en vigueur des guidelines au moment de soumettre :
le texte évolue.

## Prérequis administratif, hors développement

**Compte au programme développeur Apple** — 99 $/an, délai d'enrôlement variable
(vérification d'identité, parfois plusieurs jours). C'est le seul élément du chemin
critique dont le délai ne se rattrape pas : l'inscription doit être lancée bien
avant ce ticket, idéalement dès P0-005.

## Ce que ce ticket suppose et qui doit exister

Section ajoutée le 2 septembre 2026 (règle 8 de `CLAUDE.md`), rétroactivement.

| Prérequis | Où il vit | État |
| --------- | --------- | ---- |
| Magic link, session, `me()` | P0-005a | ✅ existe |
| **SSO Google et le linking d'identités** | P0-005b | ❌ **à créer par P0-005b**, lui-même bloqué sur trois `client_id` Google. Le linking s'écrit une fois, là-bas ; ici on branche un second fournisseur dessus |
| `accept_invitation()` et son contrôle d'e-mail | P0-004, P1-001c | ✅ existe — et c'est **exactement ce que l'adresse relayée casse**, voir les notes |
| `public.users.email` unique sur `lower(email)` | P0-004 | ✅ existe |
| **Compte au programme développeur Apple, 99 $/an** | — | ❌ **à ouvrir maintenant.** Délai d'enrôlement variable, vérification d'identité. Seul élément du chemin critique dont le délai ne se rattrape pas en codant |
| **App ID, Service ID, clé privée, domaine de retour** | console Apple | ❌ suppose le compte ci-dessus **et un nom de domaine** — le même que P2-015 et D-008 attendent. Trois éléments bloqués par une seule absence |
| **EAS Build, et un appareil iOS réel** | `apps/mobile` | ❌ **n'existe pas.** Sign in with Apple n'est **pas testable dans Expo Go** : il faut un build de développement. Si EAS n'est pas en place, c'est du travail non chiffré dans les 3 j·h |
| L'app mobile ayant tourné au moins une fois | `apps/mobile` | ⚠️ **jamais exécutée** (`docs/REPRISE.md` §2). Poser un fournisseur d'authentification sur une app qui n'a jamais démarré, c'est débusquer deux classes de bugs en même temps |

## Ce que ce ticket rend possible, et qui l'appellera

| Ce que je livre | Appelé par | Ticket |
| --------------- | ---------- | ------ |
| Le bouton Apple et son échange de jeton | l'écran de connexion (P0-005a) | celui-ci |
| La tolérance à l'adresse relayée | `accept_invitation()` | celui-ci **modifie** la fonction de P1-001c, et son test |

## Périmètre

- Sign in with Apple sur iOS, plus le flux web pour Android et le back-office.
- Configuration : App ID, Service ID, clé privée, et le domaine de retour.
- Linking d'identités avec les comptes Google et magic link existants — même
  exigence qu'en P0-005b.

## Critères d'acceptation

- [ ] Connexion Apple fonctionnelle sur un appareil iOS réel
- [ ] Une adresse relayée (`privaterelay.appleid.com`) ne casse ni le contrôle
      d'e-mail d'`accept_invitation`, ni l'unicité de `public.users.email`
- [ ] Le linking avec un compte Google ou magic link existant se comporte comme
      en P0-005b
- [ ] Le bouton respecte les règles de présentation Apple

## Notes

**Non testable dans Expo Go** : il faut un build de développement sur appareil
réel. Prévoir la mise en place d'EAS Build dans l'estimation si elle n'existe pas
encore.

Le point sur l'adresse relayée n'est pas cosmétique : Apple peut fournir une
adresse jetable propre à l'app. Le contrôle d'identité d'`accept_invitation`
compare l'e-mail du JWT à celui de l'invitation — une invitation nominative
envoyée à l'adresse réelle ne correspondra pas à l'adresse relayée.
