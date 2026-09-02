import { describe, expect, it } from 'vitest';

import {
  displayName,
  filterDirectory,
  grantableRoles,
  invitationState,
  type DirectoryRow,
} from './staff';

function ligne(patch: Partial<DirectoryRow> = {}): DirectoryRow {
  return {
    membership_id: '11111111-0000-4000-8000-000000000001',
    user_id: '22222222-0000-4000-8000-000000000001',
    role: 'MEMBER',
    status: 'ACTIVE',
    email: 'lea@example.com',
    first_name: 'Léa',
    last_name: 'Martin',
    joined_at: '2026-01-01T10:00:00Z',
    ...patch,
  };
}

describe('filterDirectory', () => {
  const annuaire = [
    ligne(),
    ligne({ first_name: 'Marc', last_name: 'Lefevre', email: 'marc@rueil.example', role: 'OWNER' }),
    ligne({ first_name: 'Hugo', last_name: 'Petit', email: 'hugo@rueil.example', role: 'MANAGER' }),
    ligne({
      first_name: 'Julie',
      last_name: 'Kaczmarek',
      email: 'julie@example.com',
      status: 'REMOVED',
    }),
  ];

  it('rend tout sans filtre', () => {
    expect(filterDirectory(annuaire)).toHaveLength(4);
  });

  it('cherche dans le prénom comme dans le nom', () => {
    expect(filterDirectory(annuaire, { q: 'kaczmarek' })).toHaveLength(1);
    expect(filterDirectory(annuaire, { q: 'marc' })).toHaveLength(1);
  });

  // Un annuaire administratif sert justement à retrouver quelqu'un par son
  // adresse : deux homonymes ne se distinguent que par là.
  it('cherche aussi dans l’e-mail', () => {
    expect(filterDirectory(annuaire, { q: 'rueil.example' })).toHaveLength(2);
  });

  it('ignore la casse et les espaces autour', () => {
    expect(filterDirectory(annuaire, { q: '  LÉA  ' })).toHaveLength(1);
  });

  it('filtre par rôle et par statut', () => {
    expect(filterDirectory(annuaire, { role: 'OWNER' })).toHaveLength(1);
    expect(filterDirectory(annuaire, { status: 'REMOVED' })).toHaveLength(1);
  });

  it('combine les trois', () => {
    expect(filterDirectory(annuaire, { q: 'rueil', role: 'MANAGER' })).toHaveLength(1);
    expect(filterDirectory(annuaire, { q: 'rueil', role: 'MEMBER' })).toHaveLength(0);
  });

  // Le filtre vide est ce que rend un `<select>` sur son option « tous ».
  it('traite la chaîne vide comme « pas de filtre »', () => {
    expect(filterDirectory(annuaire, { q: '', role: '', status: '' })).toHaveLength(4);
  });
});

describe('displayName', () => {
  it('assemble le prénom et le nom', () => {
    expect(displayName(ligne())).toBe('Léa Martin');
  });

  it('se contente du prénom quand le nom manque', () => {
    expect(displayName(ligne({ last_name: null }))).toBe('Léa');
  });

  // Une fiche vide arrive : l'invitation est acceptée avant le profil.
  it('retombe sur l’e-mail quand la fiche est vide', () => {
    expect(displayName(ligne({ first_name: null, last_name: null }))).toBe('lea@example.com');
  });
});

// `PENDING` ne veut pas dire « en cours » : la base ne bascule le statut qu'à la
// tentative d'usage. Sans cette fonction, l'écran afficherait « en attente » sur
// une invitation périmée depuis six mois.
describe('invitationState', () => {
  const maintenant = new Date('2026-09-02T12:00:00Z');

  it('rend PENDING tant que la date n’est pas passée', () => {
    expect(
      invitationState({ status: 'PENDING', expires_at: '2026-10-01T00:00:00Z' }, maintenant),
    ).toBe('PENDING');
  });

  it('rend EXPIRED pour une invitation PENDING dont la date est passée', () => {
    expect(
      invitationState({ status: 'PENDING', expires_at: '2026-08-01T00:00:00Z' }, maintenant),
    ).toBe('EXPIRED');
  });

  it('respecte les statuts déjà tranchés par la base', () => {
    expect(
      invitationState({ status: 'ACCEPTED', expires_at: '2026-08-01T00:00:00Z' }, maintenant),
    ).toBe('ACCEPTED');
    expect(
      invitationState({ status: 'REVOKED', expires_at: '2026-10-01T00:00:00Z' }, maintenant),
    ).toBe('REVOKED');
  });
});

// Miroir de la matrice que `create_invitation()` et `set_member_role()` portent
// en base. L'écran masque, la base refuse — et c'est la base qui fait foi.
describe('grantableRoles', () => {
  it('un propriétaire accorde les quatre rôles', () => {
    expect(grantableRoles('OWNER')).toHaveLength(4);
  });

  it('un gestionnaire n’accorde ni OWNER ni MANAGER', () => {
    expect(grantableRoles('MANAGER')).toEqual(['MEMBER', 'COACH']);
  });
});
