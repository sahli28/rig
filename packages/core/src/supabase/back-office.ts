import type { MembershipRole } from './me';

/**
 * **Qui atteint quoi dans le back-office — décidé une fois, ici.**
 *
 * Jusqu'à `D-021`, chaque fichier du back-office web portait sa propre
 * comparaison de rôle : la porte (`layout.tsx`), la coquille, une page par
 * section, une Server Action par section. `P1-015` a ouvert le droit du coach
 * à trois niveaux sur quatre, et le quatrième — la porte, inchangée depuis
 * `P1-001a` — est resté fermé. Tous les tests étaient verts : les niveaux
 * touchés étaient cohérents entre eux, et rien ne comparait la porte au reste.
 *
 * D'où cette table. **Ce n'est pas de la sécurité** — les policies et les
 * fonctions SQL refusent déjà, avec `current_admin_tenant_ids()` et
 * `current_staff_tenant_ids()` — c'est de l'ergonomie : ne pas proposer une
 * porte qui se ferme, et ne pas en fermer une que la base ouvre. Un interdit
 * ESLint (`eslint.config.mjs`, `PAS_DE_COMPARAISON_DE_ROLE`) empêche qu'une
 * comparaison de rôle réapparaisse ailleurs dans une app ; `pnpm lint:sondes`
 * prouve qu'il mord.
 */
export const BACK_OFFICE_RIGHTS = [
  /** Le tableau de bord — la racine de `/box/[slug]`. */
  'dashboard',
  /** Voir la grille de la semaine et les séries. */
  'planning',
  /** Créer ou modifier une série, annuler ou rétablir un cours. */
  'planning_admin',
  /** Écrire la séance d'une occurrence (P1-015). */
  'workout',
  /** Les réglages opérationnels : horaires, salles, règles, types de cours. */
  'settings',
  /** L'identité de la box — `tenants` — réservée au propriétaire (P1-001b). */
  'identity',
  /** Le white-label — `themes` — réservé au propriétaire (spec §5.2). */
  'appearance',
  /** Staff & Roles : annuaire, rôles, invitations. */
  'staff',
  /** L'import de membres. */
  'members',
] as const;

export type BackOfficeRight = (typeof BACK_OFFICE_RIGHTS)[number];

const RIGHTS_BY_ROLE: Record<MembershipRole, ReadonlySet<BackOfficeRight>> = {
  OWNER: new Set(BACK_OFFICE_RIGHTS),
  // La frontière se coupe par table : l'opérationnel s'ouvre au gestionnaire,
  // l'identité et l'apparence restent au propriétaire.
  MANAGER: new Set<BackOfficeRight>([
    'dashboard',
    'planning',
    'planning_admin',
    'workout',
    'settings',
    'staff',
    'members',
  ]),
  // Le coach n'administre rien : il lit le planning et écrit sa séance. Sœur
  // exacte de `current_staff_tenant_ids()` en base.
  COACH: new Set<BackOfficeRight>(['dashboard', 'planning', 'workout']),
  MEMBER: new Set<BackOfficeRight>(),
};

function rightsOf(role: string): ReadonlySet<BackOfficeRight> {
  // Un rôle inconnu n'a aucun droit : le défaut sûr, et celui qui se voit.
  return Object.hasOwn(RIGHTS_BY_ROLE, role)
    ? RIGHTS_BY_ROLE[role as MembershipRole]
    : RIGHTS_BY_ROLE.MEMBER;
}

/** Ce rôle a-t-il ce droit dans le back-office ? */
export function can(role: string, right: BackOfficeRight): boolean {
  return rightsOf(role).has(right);
}

/**
 * La porte elle-même : entre qui a au moins un droit. C'est la ligne que
 * `layout.tsx:56` portait seul, et qui n'a pas suivi `P1-015`.
 */
export function canEnterBackOffice(role: string): boolean {
  return rightsOf(role).size > 0;
}

// La portée « staff de la box » : OWNER, MANAGER, COACH. Sœur exacte de
// `current_staff_tenant_ids()` en base et de la vue `class_attendance_sheet`.
const STAFF_ROLES = new Set<MembershipRole>(['OWNER', 'MANAGER', 'COACH']);

/**
 * Pointer une présence (P1-008a) — une capacité **mobile**, pas une section du
 * back-office, d'où un prédicat à part plutôt qu'un droit dans la table
 * ci-dessus. Elle vit ici parce que c'est le seul endroit où ESLint autorise
 * une décision de rôle (`PAS_DE_COMPARAISON_DE_ROLE`), et pour que le mobile la
 * **demande** au lieu de comparer `role === 'COACH'` en ligne. La base refuse
 * déjà de toute façon : `set_attendance()` est bornée à
 * `current_staff_tenant_ids()`.
 */
export function canTakeAttendance(role: string): boolean {
  return (STAFF_ROLES as ReadonlySet<string>).has(role);
}
