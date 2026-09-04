import { describe, expect, it } from 'vitest';
import { brandFromPublicProfile, brandFromTheme, brandOrDefault } from './tenant-brand';
import { buildTheme } from './build-theme';
import { DEFAULT_BRAND } from './tokens';

describe('brandFromTheme', () => {
  it('traduit le thème rendu par me()', () => {
    expect(
      brandFromTheme({
        app_name: 'CrossFit Bastille',
        logo_url: 'https://cdn.example/logo.png',
        primary: '#1B4965',
        radius: 12,
        font: 'Inter',
      }),
    ).toEqual({
      appName: 'CrossFit Bastille',
      logoUrl: 'https://cdn.example/logo.png',
      primary: '#1B4965',
      radius: 12,
      font: 'Inter',
    });
  });
});

describe('brandFromPublicProfile', () => {
  // Les colonnes de thème sortent nulles quand la box n'a pas de ligne dans
  // `themes` : les fonctions SQL joignent en **externe** depuis qu'on a
  // vu ce qu'une jointure interne coûtait — une box sans branding disparaissait
  // de son profil public, et ses invitations devenaient « invalides ».
  it('comble un branding absent avec la marque par défaut', () => {
    expect(
      brandFromPublicProfile({
        app_name: 'CrossFit Bastille',
        logo_url: null,
        primary_color: null,
        radius: null,
        font: null,
      }),
    ).toEqual({
      appName: 'CrossFit Bastille',
      logoUrl: null,
      primary: DEFAULT_BRAND.primary,
      radius: DEFAULT_BRAND.radius,
      font: DEFAULT_BRAND.font,
    });
  });

  it('traduit le profil public, dont la colonne s’appelle primary_color', () => {
    expect(
      brandFromPublicProfile({
        app_name: 'CrossFit Bastille',
        logo_url: null,
        primary_color: '#1B4965',
        radius: 12,
        font: 'Inter',
      }),
    ).toEqual({
      appName: 'CrossFit Bastille',
      logoUrl: null,
      primary: '#1B4965',
      radius: 12,
      font: 'Inter',
    });
  });

  it('donne la même marque que me() pour une même box', () => {
    const commun = { app_name: 'Hyrox Lyon', logo_url: null, radius: 8, font: 'Inter' };

    expect(brandFromPublicProfile({ ...commun, primary_color: '#0F766E' })).toEqual(
      brandFromTheme({ ...commun, primary: '#0F766E' }),
    );
  });
});

describe('brandOrDefault', () => {
  it('retombe sur la marque Rack quand aucune box n’est résolue', () => {
    expect(brandOrDefault(null)).toBe(DEFAULT_BRAND);
    expect(brandOrDefault(undefined)).toBe(DEFAULT_BRAND);
  });

  it('laisse passer une marque de box', () => {
    const brand = brandFromPublicProfile({
      app_name: 'Hyrox Lyon',
      logo_url: null,
      primary_color: '#0F766E',
      radius: 8,
      font: 'Inter',
    });

    expect(brandOrDefault(brand)).toBe(brand);
  });
});

describe('marque de box appliquée au thème', () => {
  it('produit une couleur lisible même si la box choisit un jaune fluo', () => {
    const brand = brandFromPublicProfile({
      app_name: 'Box Fluo',
      logo_url: null,
      primary_color: '#ffff00',
      radius: 8,
      font: 'Inter',
    });

    // `buildTheme` corrige le contraste : une box ne peut pas livrer une app
    // illisible, et le profil public ne contourne pas cette garantie.
    expect(buildTheme(brand, 'light').contrast.adjusted).toBe(true);
  });
});
