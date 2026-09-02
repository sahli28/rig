'use client';

import { useActionState, useState } from 'react';
import Papa from 'papaparse';
import { useI18n } from '@rig/ui/i18n';
import {
  IMPORT_FIELDS,
  MAX_CSV_BYTES,
  MAX_IMPORT_ROWS,
  analyzeRows,
  applyMapping,
  decodeCsv,
  guessDelimiter,
  guessMapping,
  type ImportAnalysis,
  type ImportField,
} from '@rig/core';
import type { TranslationKey } from '@rig/core';
import styles from './membres.module.css';
import { IDLE, type ImportState } from './import-state';
import { runImport } from './actions';

const FIELD_KEYS: Record<ImportField, TranslationKey> = {
  email: 'import.field_email',
  first_name: 'import.field_first_name',
  last_name: 'import.field_last_name',
  role: 'import.field_role',
};

const VERDICT_KEYS: Record<string, TranslationKey> = {
  valid: 'import.verdict_valid',
  invalid: 'import.verdict_invalid',
  duplicate_in_file: 'import.verdict_duplicate',
  already_member: 'import.verdict_member',
  already_invited: 'import.verdict_invited',
};

/** Ce que la correspondance mémorisée d'un import à l'autre occupe. */
const STORAGE_KEY = 'rig.import.mapping';

type Fichier = {
  nom: string;
  encoding: string;
  delimiter: string;
  headers: string[];
  lignes: Record<string, string>[];
};

/**
 * L'import, en trois temps : déposer, faire correspondre, confirmer.
 *
 * **Le fichier ne quitte pas le navigateur.** Il est décodé et analysé ici, et
 * seules les lignes retenues partent au serveur — sans les colonnes qu'on
 * n'importe pas. Ce n'est pas un détail d'implémentation : un CSV d'effectif est
 * un fichier de données personnelles, et ne pas le transmettre, c'est ne jamais
 * avoir à le stocker ni à l'oublier quelque part.
 */
export function ImportScreen({
  slug,
  existingEmails,
  pendingEmails,
}: {
  slug: string;
  existingEmails: string[];
  pendingEmails: string[];
}) {
  const { t } = useI18n();
  const [state, action] = useActionState<ImportState, FormData>(runImport.bind(null, slug), IDLE);

  const [fichier, setFichier] = useState<Fichier | null>(null);
  const [mapping, setMapping] = useState<Partial<Record<ImportField, string>>>({});
  const [erreurKey, setErreurKey] = useState<TranslationKey | null>(null);

  async function lire(file: File) {
    setErreurKey(null);

    if (file.size > MAX_CSV_BYTES) {
      setErreurKey('import.error_too_big');
      return;
    }

    // L'encodage **avant** l'analyse : PapaParse reçoit une chaîne, il ne décode
    // rien. Lu en UTF-8 par défaut, un export Excel FR a déjà perdu ses accents
    // quand l'analyse commence.
    const { text, encoding } = decodeCsv(await file.arrayBuffer());
    const delimiter = guessDelimiter(text);

    const resultat = Papa.parse<Record<string, string>>(text, {
      header: true,
      delimiter,
      skipEmptyLines: true,
    });

    const headers = resultat.meta.fields ?? [];
    if (headers.length === 0 || resultat.data.length === 0) {
      setErreurKey('import.error_unreadable');
      return;
    }

    setFichier({ nom: file.name, encoding, delimiter, headers, lignes: resultat.data });
    setMapping(memorise(headers));
  }

  const analyse: ImportAnalysis | null =
    fichier === null || mapping.email === undefined
      ? null
      : analyzeRows(applyMapping(fichier.lignes, mapping), { existingEmails, pendingEmails });

  if (state.status === 'done') {
    return (
      <section className={styles.card}>
        <h1 className={styles.title}>{t('import.done_title')}</h1>
        <p className={styles.help}>
          {t('import.done_body', {
            created: String(state.result.created),
            member: String(state.result.already_member),
            invited: String(state.result.already_invited),
          })}
        </p>
        {/* Aucun lien à distribuer : les personnes importées rejoignent en se
            connectant avec leur adresse. C'est ce qui évite de faire circuler
            deux cents jetons dans un tableur. */}
        <p className={styles.help}>{t('import.done_next')}</p>
        <code className={styles.code}>
          {typeof window === 'undefined' ? '' : `${window.location.origin}/invitations`}
        </code>
      </section>
    );
  }

  return (
    <div className={styles.page}>
      <section className={styles.card}>
        <h1 className={styles.title}>{t('import.title')}</h1>
        <p className={styles.help}>{t('import.help')}</p>

        <label className={styles.label} htmlFor="csv">
          {t('import.file')}
        </label>
        <input
          id="csv"
          className={styles.input}
          type="file"
          accept=".csv,text/csv"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file !== undefined) void lire(file);
          }}
        />
        <span className={styles.rowMeta}>{t('import.file_help')}</span>

        {erreurKey === null ? null : (
          <p className={styles.error} role="alert">
            {t(erreurKey)}
          </p>
        )}

        {state.status === 'error' ? (
          <p className={styles.error} role="alert">
            {t(state.key)}
          </p>
        ) : null}
      </section>

      {fichier === null ? null : (
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>{t('import.mapping_title')}</h2>
          {/* Dire ce qui a été deviné : une box qui voit « point-virgule,
              windows-1252 » comprend immédiatement pourquoi son fichier est mal
              découpé, au lieu de constater un résultat absurde. */}
          <p className={styles.help}>
            {t('import.mapping_help', {
              file: fichier.nom,
              rows: String(fichier.lignes.length),
              encoding: fichier.encoding,
              delimiter: fichier.delimiter === '\t' ? '\\t' : fichier.delimiter,
            })}
          </p>

          <div className={styles.grid}>
            {IMPORT_FIELDS.map((field) => (
              <div key={field} className={styles.field}>
                <label className={styles.label} htmlFor={`map-${field}`}>
                  {t(FIELD_KEYS[field])}
                  {field === 'email' ? ' *' : ''}
                </label>
                <select
                  id={`map-${field}`}
                  className={styles.select}
                  value={mapping[field] ?? ''}
                  onChange={(event) => {
                    const suivant = { ...mapping };
                    if (event.target.value === '') delete suivant[field];
                    else suivant[field] = event.target.value;
                    setMapping(suivant);
                    memorise(fichier.headers, suivant);
                  }}
                >
                  <option value="">{t('import.column_ignored')}</option>
                  {fichier.headers.map((header) => (
                    <option key={header} value={header}>
                      {header}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </section>
      )}

      {analyse === null ? null : (
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>{t('import.preview_title')}</h2>
          <p className={styles.help}>
            {t('import.preview_counts', {
              valid: String(analyse.counts.valid),
              invalid: String(analyse.counts.invalid),
              duplicate: String(analyse.counts.duplicateInFile),
              member: String(analyse.counts.alreadyMember),
              invited: String(analyse.counts.alreadyInvited),
            })}
          </p>

          <ul className={styles.list}>
            {analyse.rows.slice(0, 50).map((row) => (
              <li key={row.line} className={styles.row}>
                <span className={styles.rowMeta}>{row.line}</span>
                <span className={styles.rowMain}>{row.raw.email ?? '—'}</span>
                <span className={styles.badge}>
                  {t(VERDICT_KEYS[row.verdict.kind] ?? 'import.verdict_valid')}
                </span>
              </li>
            ))}
          </ul>
          {analyse.rows.length > 50 ? (
            <p className={styles.rowMeta}>
              {t('import.preview_truncated', { count: analyse.rows.length - 50 })}
            </p>
          ) : null}

          {/* Une ligne illisible **bloque tout** : c'est le critère du ticket, et
              la base le refusera de toute façon. Autant le dire ici. */}
          {analyse.counts.invalid > 0 ? (
            <p className={styles.error} role="alert">
              {t('import.blocked')}
            </p>
          ) : (
            <form action={action} className={styles.actions}>
              <input type="hidden" name="rows" value={JSON.stringify(analyse.valid)} />
              <button
                type="submit"
                className={styles.primary}
                disabled={analyse.counts.valid === 0 || analyse.counts.valid > MAX_IMPORT_ROWS}
              >
                {t('import.confirm', { count: analyse.counts.valid })}
              </button>
            </form>
          )}
        </section>
      )}
    </div>
  );
}

/**
 * Mémorise la correspondance d'un import à l'autre, par jeu d'en-têtes : une box
 * réimporte le même export tous les mois, et refaire le mapping à chaque fois
 * est le genre de friction qui décide qu'on ne réimportera plus.
 *
 * En `localStorage`, donc par navigateur — assez pour ce que ça vaut, et sans
 * stocker en base la structure du fichier d'un client.
 */
function memorise(
  headers: string[],
  mapping?: Partial<Record<ImportField, string>>,
): Partial<Record<ImportField, string>> {
  const cle = `${STORAGE_KEY}.${headers.join('|')}`;

  try {
    if (mapping !== undefined) {
      window.localStorage.setItem(cle, JSON.stringify(mapping));
      return mapping;
    }
    const memorisee = window.localStorage.getItem(cle);
    if (memorisee !== null) return JSON.parse(memorisee) as Partial<Record<ImportField, string>>;
  } catch {
    // Navigation privée ou stockage bloqué : on retombe sur la proposition
    // automatique, qui est de toute façon le cas du premier import.
  }

  return guessMapping(headers);
}
