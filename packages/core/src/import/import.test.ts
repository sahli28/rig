import { describe, expect, it } from 'vitest';

import { MAX_CSV_BYTES, MAX_IMPORT_ROWS, decodeCsv, guessDelimiter } from './csv';
import { analyzeRows, applyMapping, guessMapping } from './mapping';

/**
 * Un fichier tel qu'Excel FR l'écrit : `windows-1252`, `;`, accents.
 * Construit octet par octet, parce qu'un fichier ASCII ne prouverait rien —
 * c'est exactement le test qui reste vert pendant que l'import casse les noms.
 */
function excelFrancais(): ArrayBuffer {
  const octets = [
    ...'Pr'.split('').map((c) => c.charCodeAt(0)),
    0xe9, // é
    ...'nom;Nom;Email\n'.split('').map((c) => c.charCodeAt(0)),
    'L'.charCodeAt(0),
    0xe9, // é
    ...'a;Martin;lea@example.com\n'.split('').map((c) => c.charCodeAt(0)),
  ];
  return new Uint8Array(octets).buffer;
}

describe('decodeCsv', () => {
  it('décode un fichier UTF-8 sans y toucher', () => {
    const bytes = new TextEncoder().encode('prénom;email\nLéa;lea@example.com').buffer;
    const { text, encoding } = decodeCsv(bytes);

    expect(encoding).toBe('utf-8');
    expect(text).toContain('Léa');
  });

  // Le cas nominal d'une box française, et le seul que ce ticket ne peut pas
  // se permettre de rater.
  it('décode un export Excel FR en windows-1252 sans casser les accents', () => {
    const { text, encoding } = decodeCsv(excelFrancais());

    expect(encoding).toBe('windows-1252');
    expect(text).toContain('Prénom');
    expect(text).toContain('Léa');
    expect(text).not.toContain('�');
  });

  // Sans ça, la première colonne s'appelle « \uFEFFemail » et aucun mapping
  // automatique ne la reconnaît.
  it('retire le BOM', () => {
    const bytes = new TextEncoder().encode('\uFEFFemail\nlea@example.com').buffer;
    expect(decodeCsv(bytes).text.startsWith('email')).toBe(true);
  });

  // Toute la plage 0xC0–0xFF — les lettres accentuées, c'est-à-dire tout ce
  // qui compte pour un effectif français — est identique en windows-1252 et en
  // Latin-1. C'est ce qui rend le décodage sûr quel que soit le runtime.
  //
  // La plage 0x80–0x9F, elle, diffère : `€`, `œ` et les guillemets courbes n'y
  // sont qu'en windows-1252. Le navigateur suit la norme WHATWG et les rend
  // correctement ; le `TextDecoder` de Node, selon son ICU, peut retomber sur
  // Latin-1 — vérifié. Le décodage a lieu dans le navigateur, donc la limite est
  // notée, pas testée ici : un test qui affirmerait le contraire dans ce runtime
  // serait faux.
  it('décode toutes les lettres accentuées, la seule plage qui compte ici', () => {
    const bytes = new Uint8Array([0xe0, 0xe7, 0xe9, 0xea, 0xee, 0xf4, 0xfb]).buffer;
    expect(decodeCsv(bytes).text).toBe('àçéêîôû');
  });
});

describe('guessDelimiter', () => {
  it('reconnaît le point-virgule d’Excel FR', () => {
    expect(guessDelimiter('prénom;nom;email\nLéa;Martin;lea@example.com')).toBe(';');
  });

  it('reconnaît la virgule', () => {
    expect(guessDelimiter('first,last,email')).toBe(',');
  });

  // « Martin, Léa » dans une cellule ne doit pas faire élire la virgule.
  it('ignore les séparateurs entre guillemets', () => {
    expect(guessDelimiter('"Martin, Léa";lea@example.com')).toBe(';');
  });

  it('reconnaît la tabulation d’un copier-coller de tableur', () => {
    expect(guessDelimiter('prénom\tnom\temail')).toBe('\t');
  });
});

describe('guessMapping', () => {
  it('reconnaît des en-têtes français accentués', () => {
    expect(guessMapping(['Prénom', 'Nom', 'Adresse e-mail'])).toEqual({
      first_name: 'Prénom',
      last_name: 'Nom',
      email: 'Adresse e-mail',
    });
  });

  it('reconnaît des en-têtes anglais', () => {
    expect(guessMapping(['First Name', 'Last Name', 'Email', 'Role'])).toEqual({
      first_name: 'First Name',
      last_name: 'Last Name',
      email: 'Email',
      role: 'Role',
    });
  });

  it('ne propose rien pour une colonne inconnue', () => {
    expect(guessMapping(['Numéro de licence'])).toEqual({});
  });
});

describe('applyMapping', () => {
  // Un export porte souvent un numéro de licence, une date de naissance, un
  // montant. Rien de tout cela n'a de destination : ne pas l'envoyer au serveur.
  it('écarte les colonnes non mappées', () => {
    const sortie = applyMapping(
      [{ Email: 'lea@example.com', 'Numéro de licence': '4412', Montant: '89' }],
      { email: 'Email' },
    );

    expect(sortie).toEqual([{ email: 'lea@example.com' }]);
  });
});

describe('analyzeRows', () => {
  it('accepte une ligne complète et normalise l’adresse', () => {
    const analyse = analyzeRows([{ email: '  LEA@Example.com ', first_name: 'Léa' }]);

    expect(analyse.counts.valid).toBe(1);
    expect(analyse.valid[0]?.email).toBe('lea@example.com');
  });

  it('signale une adresse illisible, et la ligne où elle se trouve', () => {
    const analyse = analyzeRows([{ email: 'lea@example.com' }, { email: 'pas une adresse' }]);

    expect(analyse.counts.invalid).toBe(1);
    // +1 pour l'en-tête, +1 pour compter à partir de 1 : la box lit « ligne 3 »
    // dans son tableur, pas « index 1 ».
    expect(analyse.rows[1]?.line).toBe(3);
  });

  it('écarte un doublon interne au fichier', () => {
    const analyse = analyzeRows([{ email: 'lea@example.com' }, { email: 'LEA@example.com' }]);

    expect(analyse.counts.valid).toBe(1);
    expect(analyse.counts.duplicateInFile).toBe(1);
  });

  // Ce que le ticket appelle « signalés avant écriture » : l'écran le dit,
  // et `import_members()` fera exactement le même tri.
  it('distingue « déjà membre » de « déjà invitée »', () => {
    const analyse = analyzeRows(
      [{ email: 'lea@example.com' }, { email: 'bruno@example.com' }, { email: 'neuf@example.com' }],
      { existingEmails: ['Lea@example.com'], pendingEmails: ['bruno@example.com'] },
    );

    expect(analyse.counts.alreadyMember).toBe(1);
    expect(analyse.counts.alreadyInvited).toBe(1);
    expect(analyse.counts.valid).toBe(1);
  });

  it('refuse un rôle inconnu', () => {
    const analyse = analyzeRows([{ email: 'lea@example.com', role: 'PATRON' }]);

    expect(analyse.counts.invalid).toBe(1);
    expect(analyse.rows[0]?.verdict).toEqual({ kind: 'invalid', reason: 'role' });
  });
});

describe('les plafonds', () => {
  it('sont explicites plutôt que découverts', () => {
    expect(MAX_CSV_BYTES).toBeGreaterThan(0);
    expect(MAX_IMPORT_ROWS).toBe(1000);
  });
});
