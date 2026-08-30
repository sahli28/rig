import { describe, expect, it } from 'vitest';
import { API_ERROR_CODES, apiError } from './errors.js';

describe('apiError', () => {
  it('produit la forme exacte attendue par le client', () => {
    const result = apiError('CLASS_FULL', {
      fr: 'Ce cours est complet.',
      en: 'This class is full.',
    });

    expect(result).toEqual({
      error: {
        code: 'CLASS_FULL',
        message_i18n: { fr: 'Ce cours est complet.', en: 'This class is full.' },
        details: {},
      },
    });
  });

  it('transporte les détails quand ils sont fournis', () => {
    const result = apiError(
      'CLASS_FULL',
      { fr: 'Complet.', en: 'Full.' },
      { waitlist_available: true, waitlist_length: 3 },
    );

    expect(result.error.details).toEqual({ waitlist_available: true, waitlist_length: 3 });
  });

  it('ne contient aucun doublon dans la liste des codes', () => {
    expect(new Set(API_ERROR_CODES).size).toBe(API_ERROR_CODES.length);
  });
});
