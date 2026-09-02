/**
 * Décodage d'un fichier CSV déposé dans le navigateur.
 *
 * **Le vrai piège de l'import est ici, pas dans l'analyse.** Un analyseur CSV
 * reçoit une *chaîne* : il ne décode rien. Lu avec `FileReader.readAsText()` —
 * UTF-8 par défaut — un export Excel français a **déjà perdu ses accents** quand
 * l'analyseur commence : « Léa Martin » devient « Lï¿½a Martin », et on importe
 * deux cents noms cassés sans qu'aucun test ne bronche.
 *
 * Et c'est le cas **nominal**, pas le cas tordu : Excel sur un Windows français
 * exporte en `windows-1252` avec `;` comme séparateur, par défaut. C'est
 * exactement le fichier que produira une propriétaire de box.
 */

/** Taille maximale acceptée. Au-delà, l'onglet gèlerait avant de dire non. */
export const MAX_CSV_BYTES = 2 * 1024 * 1024;

/** Au-delà, l'import doit être découpé — `import_members()` refuse aussi. */
export const MAX_IMPORT_ROWS = 1000;

/**
 * Décode les octets d'un fichier CSV.
 *
 * UTF-8 d'abord, en mode `fatal` pour que l'échec soit franc plutôt que
 * silencieusement remplacé par des `�`. Repli sur **`windows-1252`** et non
 * `latin1` : c'est ce qu'Excel FR émet réellement.
 *
 * Les lettres accentuées (0xC0–0xFF) sont identiques dans les deux tables : un
 * effectif français est donc décodé correctement quoi qu'il arrive. La plage
 * 0x80–0x9F diffère — `€`, `œ`, guillemets courbes — et n'est juste qu'en
 * windows-1252. Le navigateur suit la norme WHATWG et la rend correctement ;
 * le `TextDecoder` de Node peut, selon son ICU, retomber sur Latin-1. Le
 * décodage a lieu ici, dans le navigateur : c'est la bonne table qui s'applique.
 *
 * Le BOM est retiré : sinon la première colonne s'appelle `\uFEFFemail` et
 * aucun mapping automatique ne la reconnaît.
 */
export function decodeCsv(bytes: ArrayBuffer): {
  text: string;
  encoding: 'utf-8' | 'windows-1252';
} {
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return { text: stripBom(text), encoding: 'utf-8' };
  } catch {
    const text = new TextDecoder('windows-1252').decode(bytes);
    return { text: stripBom(text), encoding: 'windows-1252' };
  }
}

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/**
 * Devine le séparateur sur la première ligne non vide.
 *
 * PapaParse sait le faire, mais l'écran doit pouvoir **l'afficher et le
 * corriger** : un fichier à une seule colonne ne donne aucun indice, et une box
 * qui voit « séparateur : point-virgule » comprend tout de suite pourquoi son
 * fichier est mal découpé.
 */
export const CSV_DELIMITERS = [';', ',', '\t', '|'] as const;
export type CsvDelimiter = (typeof CSV_DELIMITERS)[number];

export function guessDelimiter(text: string): CsvDelimiter {
  const premiere = text.split(/\r?\n/).find((ligne) => ligne.trim().length > 0) ?? '';

  let meilleur: CsvDelimiter = ';';
  let compteMax = 0;

  for (const candidat of CSV_DELIMITERS) {
    // Hors guillemets : un nom « Martin, Léa » ne doit pas faire élire la virgule.
    const compte = countOutsideQuotes(premiere, candidat);
    if (compte > compteMax) {
      compteMax = compte;
      meilleur = candidat;
    }
  }

  return meilleur;
}

function countOutsideQuotes(ligne: string, caractere: string): number {
  let dansGuillemets = false;
  let compte = 0;

  for (const c of ligne) {
    if (c === '"') dansGuillemets = !dansGuillemets;
    else if (c === caractere && !dansGuillemets) compte += 1;
  }

  return compte;
}
