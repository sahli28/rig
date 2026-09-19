'use client';

import { useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { useI18n } from '@rack/ui/i18n';
import type { TranslationKey } from '@rack/core';
import ui from '../../ui.module.css';
import styles from './mise-en-route.module.css';

interface Step {
  id: string;
  labelKey: TranslationKey;
  done: boolean;
  content: ReactNode;
}

/**
 * Le stepper : il n'orchestre que la navigation entre les formulaires (chacun
 * poste sa propre action et affiche son propre retour). « Suivant / Précédent »
 * bornés, « Terminer » ramène au dashboard.
 */
export function Wizard({ slug, steps }: { slug: string; steps: Step[] }) {
  const { t } = useI18n();
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const total = steps.length;
  const step = steps[index];
  if (step === undefined) return null;

  return (
    <div className={styles.wrap}>
      <header>
        <h1 className={styles.title}>{t('assistant.title')}</h1>
        <p className={styles.intro}>{t('assistant.intro')}</p>
      </header>

      {/* Le fil des étapes : numéro, ou coche quand l'état de la box la satisfait
          déjà. `aria-current` marque l'étape en cours. */}
      <ol className={styles.steps}>
        {steps.map((s, idx) => {
          const state =
            idx === index ? styles.stepActive : idx < index ? styles.stepPast : styles.step;
          return (
            <li key={s.id} className={state} aria-current={idx === index ? 'step' : undefined}>
              <span className={styles.stepNum}>
                {s.done ? <Check size={14} aria-hidden="true" /> : idx + 1}
              </span>
              <span className={styles.stepLabel}>{t(s.labelKey)}</span>
            </li>
          );
        })}
      </ol>

      <p className={styles.count} aria-live="polite">
        {t('assistant.step', { current: index + 1, total })}
      </p>

      <div className={styles.content}>{step.content}</div>

      <div className={styles.nav}>
        <button
          type="button"
          className={ui.ghost}
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          disabled={index === 0}
        >
          <ArrowLeft size={16} aria-hidden="true" />
          {t('assistant.prev')}
        </button>
        {index < total - 1 ? (
          <button
            type="button"
            className={ui.primary}
            onClick={() => setIndex((i) => Math.min(total - 1, i + 1))}
          >
            {t('assistant.next')}
            <ArrowRight size={16} aria-hidden="true" />
          </button>
        ) : (
          <button type="button" className={ui.primary} onClick={() => router.push(`/box/${slug}`)}>
            {t('assistant.finish')}
            <ArrowRight size={16} aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}
