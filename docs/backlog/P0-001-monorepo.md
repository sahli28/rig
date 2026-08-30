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

- [ ] `pnpm install` fonctionne à partir d'un clone vierge
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test` passent sur le squelette
- [ ] `pnpm dev` lance le web et le mobile
- [ ] `npx supabase start` démarre une base locale
- [ ] Le workflow CI est vert sur une PR de test
- [ ] Le README explique comment démarrer en moins de 10 minutes

## Notes

Ne pas ajouter de bibliothèque « au cas où ». Chaque dépendance sera justifiée
au commit. Version Node figée dans `.nvmrc` et dans la CI.
