'use client';

import { useI18n } from '@rack/ui/i18n';
import ui from '../../ui.module.css';

/** Ce que le lecteur d'écran entend pendant le squelette. Client : `t()` vit dans un contexte. */
export function LoadingLabel() {
  const { t } = useI18n();
  return <span className={ui.srOnly}>{t('common.loading')}</span>;
}
