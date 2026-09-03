import { describe, expect, it } from 'vitest';
import { invitationPath, invitationTokenFromUrl } from './invitation-link';

describe('invitationPath', () => {
  it('produit le chemin que le back-office affiche et que le QR encode', () => {
    expect(invitationPath('inv-rueil-0001')).toBe('/invitation/inv-rueil-0001');
  });

  it('échappe ce qui doit l’être', () => {
    expect(invitationPath('a b')).toBe('/invitation/a%20b');
  });
});

describe('invitationTokenFromUrl', () => {
  it('lit le lien du back-office', () => {
    // Le cas qui a échoué le 3 septembre 2026 : cette URL ouvrait l'app sur
    // « Unmatched Route », `useAuthRedirect` renvoyait sur `/welcome` sans les
    // paramètres, et personne n'était rattaché à sa box.
    expect(invitationTokenFromUrl('https://rig.app/invitation/inv-rueil-0001')).toBe(
      'inv-rueil-0001',
    );
  });

  it('lit le schéma de l’app', () => {
    // `new URL()` prendrait ici « invitation » pour un nom d'hôte et rendrait
    // le mauvais segment. C'est pourquoi l'analyse est textuelle.
    expect(invitationTokenFromUrl('rig://invitation/inv-rueil-0001')).toBe('inv-rueil-0001');
  });

  it('lit une URL Expo Go, avec son séparateur `/--/`', () => {
    expect(invitationTokenFromUrl('exp://192.168.1.133:8081/--/invitation/inv-rueil-0001')).toBe(
      'inv-rueil-0001',
    );
  });

  it('lit la forme historique en paramètre de requête', () => {
    expect(invitationTokenFromUrl('rig://welcome?token=inv-rueil-0001')).toBe('inv-rueil-0001');
    expect(invitationTokenFromUrl('/welcome?slug=crossfit-rueil&token=abc123')).toBe('abc123');
  });

  it('décode ce que le chemin a échappé', () => {
    expect(invitationTokenFromUrl(invitationPath('a-b~c.d_e'))).toBe('a-b~c.d_e');
  });

  it('rend `null` pour une URL qui n’est pas une invitation', () => {
    // Ouverture à froid : cas nominal, pas erreur. D'où `null` plutôt qu'une
    // exception, qui ferait planter le démarrage de l'app.
    expect(invitationTokenFromUrl('rig://welcome')).toBeNull();
    expect(invitationTokenFromUrl('https://rig.app/')).toBeNull();
    expect(invitationTokenFromUrl(null)).toBeNull();
    expect(invitationTokenFromUrl('')).toBeNull();
  });

  it('rend `null` quand le segment `invitation` ne porte pas de jeton', () => {
    expect(invitationTokenFromUrl('https://rig.app/invitation')).toBeNull();
    expect(invitationTokenFromUrl('https://rig.app/invitation/')).toBeNull();
  });

  it('refuse un segment qui n’a pas la forme d’un jeton', () => {
    expect(invitationTokenFromUrl('https://rig.app/invitation/pas un jeton')).toBeNull();
    expect(invitationTokenFromUrl('https://rig.app/invitation/' + 'a'.repeat(129))).toBeNull();
  });

  it('tolère un échappement invalide sans lever', () => {
    expect(invitationTokenFromUrl('https://rig.app/invitation/%E0%A4%A')).toBeNull();
  });

  it('fait l’aller-retour avec `invitationPath`', () => {
    // L'invariant qui compte : celui qui fabrique et celui qui lit ne peuvent
    // plus diverger, parce qu'ils partagent ce module.
    for (const token of ['inv-rueil-0001', 'inv-nanterre-0001', 'A1b2C3d4']) {
      expect(invitationTokenFromUrl(`https://rig.app${invitationPath(token)}`)).toBe(token);
    }
  });
});
