import { describe, expect, it } from 'vitest';
import { BACK_OFFICE_RIGHTS, can, canEnterBackOffice, type BackOfficeRight } from './back-office';
import { MEMBERSHIP_ROLES } from './me';
import { canModifyMembership } from './staff';

/**
 * La table complète — quatre rôles × tous les droits — écrite en clair.
 *
 * Elle est **la** vérité que le back-office lit ; ce test la fige pour qu'un
 * changement soit un changement de ce fichier, visible dans un diff, et jamais
 * un effet de bord. Un rôle qui n'y figure pas n'existe pas côté produit.
 */
const ATTENDU: Record<(typeof MEMBERSHIP_ROLES)[number], readonly BackOfficeRight[]> = {
  OWNER: [
    'dashboard',
    'planning',
    'planning_admin',
    'workout',
    'settings',
    'identity',
    'appearance',
    'staff',
    'members',
  ],
  MANAGER: ['dashboard', 'planning', 'planning_admin', 'workout', 'settings', 'staff', 'members'],
  COACH: ['dashboard', 'planning', 'workout'],
  MEMBER: [],
};

describe('la porte du back-office, par rôle', () => {
  it('la table couvre chaque rôle connu et chaque droit connu', () => {
    // Deux sens : un rôle ajouté en base sans ligne ici casse, et un droit
    // ajouté sans être attribué à personne aussi — un droit que personne n'a
    // n'est pas un droit, c'est une clé morte.
    expect(Object.keys(ATTENDU).sort()).toEqual([...MEMBERSHIP_ROLES].sort());
    const attribues = new Set(Object.values(ATTENDU).flat());
    expect([...attribues].sort()).toEqual([...BACK_OFFICE_RIGHTS].sort());
  });

  it.each(MEMBERSHIP_ROLES)('%s a exactement les droits attendus', (role) => {
    const obtenus = BACK_OFFICE_RIGHTS.filter((right) => can(role, right));
    expect(obtenus).toEqual(ATTENDU[role]);
  });

  it('le coach entre — c’est la ligne que P1-015 n’avait pas ouverte', () => {
    expect(canEnterBackOffice('COACH')).toBe(true);
    expect(can('COACH', 'workout')).toBe(true);
    // … et n'administre rien : ni série, ni annulation, ni réglages.
    expect(can('COACH', 'planning_admin')).toBe(false);
    expect(can('COACH', 'settings')).toBe(false);
  });

  it('un membre reste dehors, et un rôle inconnu aussi', () => {
    expect(canEnterBackOffice('MEMBER')).toBe(false);
    expect(canEnterBackOffice('ADMIN')).toBe(false);
    expect(can('ADMIN', 'dashboard')).toBe(false);
    // `Object.hasOwn`, pas `in` : un nom hérité du prototype n'est pas un rôle.
    expect(canEnterBackOffice('constructor')).toBe(false);
  });

  it('les gardes de propriétaire restent au propriétaire', () => {
    for (const right of ['identity', 'appearance'] as const) {
      expect(can('OWNER', right)).toBe(true);
      expect(can('MANAGER', right)).toBe(false);
      expect(can('COACH', right)).toBe(false);
    }
  });
});

describe('qui peut modifier quelle appartenance', () => {
  // Miroir de `MANAGER_CANNOT_MODIFY_ADMIN` : l'écran masque ce que la
  // fonction refuse. Un propriétaire touche tout le monde ; un gestionnaire ne
  // touche ni un propriétaire ni un autre gestionnaire ; les autres ne touchent
  // personne.
  it.each([
    ['OWNER', 'OWNER', true],
    ['OWNER', 'MANAGER', true],
    ['OWNER', 'COACH', true],
    ['OWNER', 'MEMBER', true],
    ['MANAGER', 'OWNER', false],
    ['MANAGER', 'MANAGER', false],
    ['MANAGER', 'COACH', true],
    ['MANAGER', 'MEMBER', true],
    ['COACH', 'MEMBER', false],
    ['MEMBER', 'MEMBER', false],
  ] as const)('%s → %s : %s', (actor, target, attendu) => {
    expect(canModifyMembership(actor, target)).toBe(attendu);
  });
});
