import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  API_ERROR_CODES,
  APP_ERROR_CODES,
  ERROR_MESSAGE_KEYS,
  UNKNOWN_ERROR_MESSAGE_KEY,
  apiError,
  appErrorCodeOf,
  errorMessageKey,
  errorMessageKeyOf,
  isAppErrorCode,
  type ErrorCode,
} from './errors';
import { translate } from './i18n/translate';
import { LOCALES } from './i18n/types';

/** Ce que PostgREST rend pour une exception levée par `public.app_error()`. */
function postgrestError(code: string) {
  return {
    code: 'P0001',
    message: 'Invitation expirée.',
    details: JSON.stringify({ code }),
    hint: null,
  };
}

describe('table des codes', () => {
  it('ne contient aucun doublon', () => {
    expect(new Set(APP_ERROR_CODES).size).toBe(APP_ERROR_CODES.length);
    expect(new Set(API_ERROR_CODES).size).toBe(API_ERROR_CODES.length);
  });

  it('donne une clé i18n à chaque code des deux sources', () => {
    for (const code of [...APP_ERROR_CODES, ...API_ERROR_CODES]) {
      expect(ERROR_MESSAGE_KEYS[code], `code sans clé : ${code}`).toBeDefined();
    }
  });

  it('traduit chaque clé dans les deux langues', () => {
    const keys = [...Object.values(ERROR_MESSAGE_KEYS), UNKNOWN_ERROR_MESSAGE_KEY];
    for (const key of keys) {
      for (const locale of LOCALES) {
        // `translate` rend la clé telle quelle quand le message manque.
        expect(translate(locale, key), `${key} non traduit en ${locale}`).not.toBe(key);
      }
    }
  });

  it('ne mappe aucun code que les migrations ne lèvent plus', () => {
    const raised = codesRaisedInMigrations();
    for (const code of APP_ERROR_CODES) {
      expect(raised.has(code), `code absent des migrations : ${code}`).toBe(true);
    }
  });

  it('couvre tous les codes levés par les migrations', () => {
    const known = new Set<string>(APP_ERROR_CODES);
    for (const code of codesRaisedInMigrations()) {
      expect(known.has(code), `code levé en SQL mais absent de la table : ${code}`).toBe(true);
    }
  });
});

/**
 * Relit les migrations pour attraper la seule dérive que rien d'autre ne voit :
 * un `app_error('X')` ajouté en SQL sans message côté client afficherait un
 * repli générique, sans que typecheck ni pgTAP ne bronchent.
 */
function codesRaisedInMigrations(): Set<string> {
  const dir = fileURLToPath(new URL('../../../supabase/migrations/', import.meta.url));
  const codes = new Set<string>();

  for (const file of readdirSync(dir)) {
    if (!file.endsWith('.sql')) continue;
    const sql = readFileSync(`${dir}${file}`, 'utf8');
    for (const match of sql.matchAll(/app_error\(\s*'([A-Z_]+)'/g)) {
      const code = match[1];
      if (code !== undefined) codes.add(code);
    }
  }

  return codes;
}

describe('appErrorCodeOf', () => {
  it('lit le code applicatif porté par `details`', () => {
    expect(appErrorCodeOf(postgrestError('INVITATION_EXPIRED'))).toBe('INVITATION_EXPIRED');
  });

  it('lit le format exact que Postgres produit', () => {
    // `json_build_object(...)::text` insère une espace autour du deux-points.
    // Relevé sur la base locale, pas supposé : un test qui n'utiliserait que
    // `JSON.stringify` ne verrait jamais cette différence.
    expect(
      appErrorCodeOf({
        code: '23514',
        message: 'Invitation expirée.',
        details: '{"code" : "INVITATION_EXPIRED"}',
        hint: null,
      }),
    ).toBe('INVITATION_EXPIRED');
  });

  it('ignore un code inconnu plutôt que de le laisser passer', () => {
    expect(appErrorCodeOf(postgrestError('SOMETHING_ELSE'))).toBeNull();
  });

  it('encaisse un `details` qui n’est pas du JSON', () => {
    // Le cas nominal des erreurs Postgres qui ne viennent pas d'`app_error()` :
    // `details` y porte du texte libre, parfois une ligne entière de tuple.
    expect(
      appErrorCodeOf({ code: '23505', details: 'Key (slug)=(rig) already exists.' }),
    ).toBeNull();
    expect(appErrorCodeOf({ details: '[]' })).toBeNull();
    expect(appErrorCodeOf({ details: 'null' })).toBeNull();
    expect(appErrorCodeOf({ details: '{"code":42}' })).toBeNull();
  });

  it('encaisse tout ce qui n’est pas une erreur PostgREST', () => {
    expect(appErrorCodeOf(null)).toBeNull();
    expect(appErrorCodeOf(undefined)).toBeNull();
    expect(appErrorCodeOf('boom')).toBeNull();
    expect(appErrorCodeOf(new Error('réseau indisponible'))).toBeNull();
    expect(appErrorCodeOf({ message: 'Failed to fetch' })).toBeNull();
  });
});

describe('errorMessageKey', () => {
  it('rend la clé du code', () => {
    expect(errorMessageKey('INVITATION_EXPIRED')).toBe('errors.invitation_expired');
  });

  it('retombe sur le repli pour un code inconnu, nul ou absent', () => {
    expect(errorMessageKey('PAS_UN_CODE')).toBe(UNKNOWN_ERROR_MESSAGE_KEY);
    expect(errorMessageKey(null)).toBe(UNKNOWN_ERROR_MESSAGE_KEY);
    expect(errorMessageKey(undefined)).toBe(UNKNOWN_ERROR_MESSAGE_KEY);
  });

  it('ne se laisse pas piéger par une clé héritée d’Object', () => {
    expect(errorMessageKey('constructor')).toBe(UNKNOWN_ERROR_MESSAGE_KEY);
    expect(errorMessageKey('toString')).toBe(UNKNOWN_ERROR_MESSAGE_KEY);
  });
});

describe('errorMessageKeyOf', () => {
  it('traduit une erreur métier remontée en RPC', () => {
    const key = errorMessageKeyOf(postgrestError('MEMBERSHIP_SUSPENDED'));
    expect(translate('fr', key)).toBe('Ton accès à cette box est suspendu. Contacte ta box.');
  });

  it('donne un message affichable même pour une panne réseau', () => {
    const key = errorMessageKeyOf(new TypeError('Failed to fetch'));
    expect(key).toBe(UNKNOWN_ERROR_MESSAGE_KEY);
    expect(translate('fr', key)).not.toBe(key);
  });
});

describe('isAppErrorCode', () => {
  it('ne reconnaît que les codes de la base', () => {
    expect(isAppErrorCode('LAST_OWNER')).toBe(true);

    // Ce cas portait `CLASS_FULL`, avec le commentaire « code d'API, pas de la
    // base ». C'était vrai jusqu'à P1-003 : `book_class()` le lève désormais
    // par `app_error()`, donc il **vient** de la base et doit être reconnu. Le
    // test disait juste, sur un monde qui a changé.
    expect(isAppErrorCode('CLASS_FULL')).toBe(true);

    // `CANCEL_WINDOW_PASSED` reprend le rôle : il est au catalogue de l'API et
    // aucune fonction SQL ne le lève encore — P1-004 le fera, et ce jour-là ce
    // cas devra bouger à son tour. C'est le signal, pas la panne.
    expect(isAppErrorCode('CANCEL_WINDOW_PASSED')).toBe(false);
    expect(isAppErrorCode(42)).toBe(false);
    expect(isAppErrorCode(null)).toBe(false);
  });
});

describe('apiError', () => {
  it('produit la forme exacte attendue par le client', () => {
    expect(apiError('CLASS_FULL')).toEqual({
      error: {
        code: 'CLASS_FULL',
        message_i18n: { fr: 'Ce cours est complet.', en: 'This class is full.' },
        details: {},
      },
    });
  });

  it('transporte les détails quand ils sont fournis', () => {
    const result = apiError('CLASS_FULL', { waitlist_available: true, waitlist_length: 3 });
    expect(result.error.details).toEqual({ waitlist_available: true, waitlist_length: 3 });
  });

  it('tire son message de la table, jamais de l’appelant', () => {
    for (const code of Object.keys(ERROR_MESSAGE_KEYS) as ErrorCode[]) {
      const { message_i18n } = apiError(code).error;
      expect(message_i18n.fr).toBe(translate('fr', ERROR_MESSAGE_KEYS[code]));
      expect(message_i18n.en).toBe(translate('en', ERROR_MESSAGE_KEYS[code]));
      expect(message_i18n.fr).not.toBe(message_i18n.en);
    }
  });
});
