import { describe, expect, it } from 'vitest';
import { initialsOf } from './initials';

describe('initialsOf', () => {
  it('prend la première lettre du prénom et du nom', () => {
    expect(initialsOf('Léa Martin')).toBe('LM');
  });

  it('gère les prénoms composés sans produire trois lettres', () => {
    expect(initialsOf('Jean-Baptiste Durand')).toBe('JB');
  });

  it('tolère les espaces multiples et les bords', () => {
    expect(initialsOf('  Sarah   Dupont  ')).toBe('SD');
  });

  it('accepte un nom seul', () => {
    expect(initialsOf('Marc')).toBe('M');
  });

  it('renvoie une chaîne vide plutôt que de planter sur une entrée vide', () => {
    expect(initialsOf('   ')).toBe('');
  });

  it('met en majuscule en respectant la locale', () => {
    expect(initialsOf('élodie ébert')).toBe('ÉÉ');
  });
});
