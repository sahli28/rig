# Point de reprise — 31 août 2026

Document de passage de session. À lire en premier, puis à supprimer quand
P0-005a sera livré.

## Où on en est

| | |
| --- | --- |
| Branche courante | `feat/P0-005a-connexion`, empilée sur `feat/P0-004-schema-rls` |
| PR ouverte | **#4** — P0-004, `VERDICT: SAFE` obtenu, **prête à fusionner** |
| Tests | 139 pgTAP · 83 Vitest · lint, typecheck, i18n, format verts |
| Base locale | Supabase tourne sur des ports **décalés** (55321-55324), voir README |

## Ce qui bloque, et qui n'est pas de mon ressort

1. **Pousser — deux branches, dans cet ordre.** `git push` est en `deny` dans
   `.claude/settings.json`, volontairement.

   **La PR #4 a un commit de retard** (`cce2500`, les dettes D-006/D-007 et la
   fermeture du ticket) :
   ```
   git -C C:/Users/sahli/imys push origin feat/P0-004-schema-rls
   ```
   Puis la branche courante, 7 commits en avance sur `main` :
   ```
   git -C C:/Users/sahli/imys push -u origin feat/P0-005a-connexion
   ```
2. **Fusionner la PR #4** une fois à jour. Elle est verte et auditée six fois.
   P0-005a en dépend. Garder le **merge commit** — la PR #3 avait été squashée,
   ce qui casse l'empilement des branches suivantes.
3. **`.env.local`** — à créer à la main pour la suite de P0-005a (clé anon locale,
   donnée par `pnpm exec supabase status`). Couvert par `.gitignore` et par la
   règle `deny`.
4. **Inscription au programme développeur Apple** — 99 $/an, délai d'enrôlement
   variable. Seul élément du chemin critique dont le délai ne se rattrape pas.
   Voir `docs/backlog/P2-003-sign-in-apple.md`.

## P0-005a — fait / reste à faire

Plan validé : `C:\Users\sahli\.claude\plans\humming-sleeping-dragonfly.md`.
Ticket : `docs/backlog/P0-005a-connexion.md`.

### Fait

- Backlog réorganisé : P0-005 découpé en **P0-005a / P0-005b / P2-002 / P2-003**.
- `docs/procedures/effacement-manuel.md` — condition du report de P2-002.
- **ADR 0004** — pas de couche API tant qu'aucune opération ne l'exige (bascule
  en P1-003, quand `Idempotency-Key` devra être persistée).
- Migration `me()` — profil, appartenances, box active, `required_actions`.
- Migration `app_error_codes` — les 9 fonctions portent un **code applicatif**
  dans `detail`, exposé par PostgREST. Sans lui, cinq erreurs métier partageaient
  `check_violation` et le client aurait dû inspecter des messages français.
- 25 tests pgTAP ajoutés (`me_test.sql`, `app_error_codes_test.sql`).

### Reste à faire, dans cet ordre

1. **`packages/core/src/errors.ts`** — étendre la table `code → message_i18n`
   avec les 24 codes applicatifs de la migration, et un helper qui lit le
   `details` d'une erreur PostgREST. C'est la moitié client du travail déjà fait
   côté base ; à faire en premier, tout le reste s'en sert.
2. **Clients Supabase** — `@supabase/supabase-js` partout,
   `expo-secure-store` sur mobile (un jeton de session est un identifiant, il ne
   va pas dans `AsyncStorage`), `@supabase/ssr` sur le web. Types générés par
   `pnpm exec supabase gen types typescript --local`.
3. **Helper de tenant actif** dans `packages/core`, traversé par tout accès aux
   données. La RLS garantit qu'on ne sort pas des boxes de l'utilisateur, pas
   qu'on reste dans la box active — et aucun test pgTAP ne peut attraper cette
   confusion.
4. **Écrans** : Welcome brandé, Auth (code à 6 chiffres), Profile Setup, Consents.

### Décisions prises pendant la session, à ne pas re-litiger

- **Code OTP à 6 chiffres sur mobile**, pas le magic link. Le lien impose du deep
  linking, dont la configuration diffère entre Expo Go et un build de
  développement — deux à trois jours cachés. Le lien reste sur le web. Et six
  chiffres se tapent plus vite à l'accueil d'une box qu'un aller-retour entre
  l'app mail et l'app.
- **`me()` ne devine pas la box active.** Sans `p_tenant_id`, `current_tenant`
  est nul. Choisir « la plus ancienne » inscrirait l'hypothèse mono-box dans la
  fonction la plus appelée du produit.
- **Maestro sort du ticket** (ni émulateur ni appareil sur cette machine).
  Passage manuel via Expo Go ; Maestro part avec D-002.
- **Ouverture à froid sans slug** : thème RIG neutre, la marque de la box
  s'applique après `me()`. Pas d'écran de saisie de code de box en 005a.

## Le contexte qui compte pour la suite

`.claude/rules/database.md` contient **onze pièges déjà payés** pendant P0-004,
plus une section sur ce que les tests d'isolation ne voient pas. Six passes
d'audit ont trouvé 20 problèmes, dont 8 failles exploitables — et **4 avaient été
introduites par mes propres correctifs**.

La leçon la plus utile : la faille la plus importante (`tenants` sans garde de
rôle, tout membre pouvait changer le fuseau donc la fenêtre d'annulation) n'a été
trouvée **ni par les tests ni par le sous-agent**, mais en relisant. Elle ne
concernait pas l'isolation inter-tenant mais la matrice de permissions de la
spec §5.2, qu'aucun des deux ne confrontait au schéma.

Dettes ouvertes : **D-001 à D-007**, dans `docs/backlog/README.md`.
