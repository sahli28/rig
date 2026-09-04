# P0-001 — Monorepo, CI et outillage

**Phase** P0 · **Estimation** 3 j·h · **Dépend de** — · **Spec** §14

## Objectif

Poser la structure du dépôt et la chaîne de vérification automatique, pour que
tout ticket suivant démarre sur des rails.

## Périmètre

- Turborepo + pnpm workspaces : `apps/mobile` (Expo), `apps/web` (Next.js),
  `packages/core` (types, schémas Zod, helpers), `packages/ui`, `supabase/`.
- TypeScript strict partout, ESLint + Prettier, config partagée.
- Scripts racine : `dev`, `typecheck`, `lint`, `test`, `test:db`, `db:migrate`, `db:reset`.
- GitHub Actions : lint → typecheck → test → test:db, bloquant sur la PR.
- Supabase local (`npx supabase init`, `supabase start`).

## Hors périmètre

Aucun écran, aucune table métier, aucun déploiement.

## Critères d'acceptation

- [x] `pnpm install` fonctionne à partir d'un clone vierge
      — vérifié sur un clone réel avec `--frozen-lockfile`
- [x] `pnpm typecheck`, `pnpm lint`, `pnpm test` passent sur le squelette
      — 4 packages typés, 0 erreur ESLint, 3 tests verts, `format:check` vert
- [x] `pnpm dev` lance le web et le mobile
      — passe sur appareil du **3 septembre 2026** — iPhone 12 Pro Max, Expo Go,
      Expo SDK 57, base locale servie sur le réseau. L'app démarre dans Expo Go et
      atteint la base ; le web tournait en parallèle. Le câblage était vérifié
      depuis P0-001 (`turbo run dev --dry`), c'est l'exécution qui manquait.
- [x] `npx supabase start` démarre une base locale
      — 12 conteneurs démarrés, base saine sur le port 55322.
      A nécessité de **décaler tous les ports de 543xx vers 553xx** : Windows
      réserve la plage TCP 53979–54478 (exclusions Hyper-V / WinNAT), qui
      couvre l'intégralité des ports Supabase par défaut. Documenté au README.
      Réserve : le conteneur `supabase_vector` (logs) redémarre en boucle ;
      sans effet sur la base, à regarder si les logs deviennent utiles.
- [x] Le workflow CI est vert sur une PR de test
      — PR #2 vers `main`, fusionnée. La CI a d'ailleurs attrapé un vrai défaut
      au passage : `README.md` n'était pas formaté, parce que `format:check`
      avait été lancé **avant** la dernière modification du fichier et jamais
      relancé après. D'où la règle : `/check` en dernier, toujours.
- [x] Le README explique comment démarrer en moins de 10 minutes

## Notes

Ne pas ajouter de bibliothèque « au cas où ». Chaque dépendance sera justifiée
au commit. Version Node figée dans `.nvmrc` et dans la CI.

### Dette laissée par ce ticket

- `apps/mobile/app.json` contient `"backgroundColor": "#E6F4FE"` (fond de l'icône
  adaptative Android, hérité du template Expo). C'est de la configuration native
  de build, pas un composant : elle échappe légitimement à la règle « zéro couleur
  en dur », mais devra devenir paramétrable au white-label N2.
- Aucune app n'importe encore `@rack/core` ni `@rack/ui`. La résolution des packages
  du workspace par Metro est donc vérifiée pour les dépendances tierces, pas pour
  les packages internes. Premier vrai test au ticket P0-002.
- `node-linker=hoisted` affaiblit l'isolation des dépendances : une app peut
  importer un module qu'elle n'a pas déclaré sans que rien ne proteste.
