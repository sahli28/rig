'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronsUpDown,
  LayoutDashboard,
  LogOut,
  Palette,
  Settings,
  UserCog,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { useI18n } from '@rack/ui/i18n';
import { LOCALES, type Locale } from '@rack/core';
import type { TranslationKey } from '@rack/core';
import { can, type BackOfficeRight, type MembershipRole } from '@rack/core/supabase';
import { browserClient } from '../../../lib/supabase/client';
import ui from '../../ui.module.css';
import { RackLogo } from '../../rack-logo';
import styles from './shell.module.css';

/**
 * Chaque entrée porte le **droit** qui l'ouvre, et la coquille demande à
 * `can()` — elle ne compare aucun rôle. Ce n'est pas une garde : les policies
 * refusent déjà. C'est de l'ergonomie — ne pas proposer une porte qui se ferme,
 * ni en cacher une que la base ouvre (`D-021` : le coach avait le droit d'écrire
 * sa séance, et aucune porte pour y aller).
 */
/**
 * Icônes : `lucide-react`, la famille dont descend le Feather du mobile — même
 * grille, même trait. **Décoratives** (`aria-hidden`) : le libellé porte le sens.
 */
const NAV: ReadonlyArray<{
  segment: string;
  labelKey: TranslationKey;
  right: BackOfficeRight;
  Icon: LucideIcon;
}> = [
  { segment: '', labelKey: 'shell.nav_dashboard', right: 'dashboard', Icon: LayoutDashboard },
  { segment: '/planning', labelKey: 'shell.nav_planning', right: 'planning', Icon: CalendarDays },
  { segment: '/reglages', labelKey: 'shell.nav_settings', right: 'settings', Icon: Settings },
  { segment: '/apparence', labelKey: 'shell.nav_appearance', right: 'appearance', Icon: Palette },
  { segment: '/staff', labelKey: 'shell.nav_staff', right: 'staff', Icon: UserCog },
  { segment: '/membres', labelKey: 'shell.nav_members', right: 'members', Icon: Users },
];

/** Le rôle, annoncé dans le menu de compte. Un MEMBER n'arrive jamais ici. */
const ROLE_LABELS: Record<MembershipRole, TranslationKey> = {
  OWNER: 'shell.role_owner',
  MANAGER: 'shell.role_manager',
  COACH: 'shell.role_coach',
  MEMBER: 'shell.role_member',
};

const CLE_VOLET = 'rack.volet-replie';

/**
 * Coquille du back-office : navigation, identité de la box, sortie.
 *
 * Radix ne porte aucun style — il porte le **comportement** accessible (focus
 * piégé, échappement, navigation au clavier, `aria-*`). La mise en forme vient
 * des CSS Modules, et toute couleur des variables de `themeToCssRule()`
 * (ADR 0005).
 */
export function Shell({
  slug,
  boxName,
  role,
  children,
}: {
  slug: string;
  boxName: string;
  role: MembershipRole;
  children: ReactNode;
}) {
  const { t, locale, setLocale } = useI18n();
  const pathname = usePathname();
  const router = useRouter();

  const base = `/box/${slug}`;

  /**
   * **Le volet se replie** (P2-022) : icônes seules, pour rendre la largeur au
   * planning hebdomadaire. Le choix est une commodité de poste, pas une donnée :
   * `localStorage`, lu **après** le montage — le serveur ne le connaît pas, et
   * le lire au rendu donnerait deux HTML différents à l'hydratation. Un stockage
   * indisponible (navigation privée) n'empêche rien : le volet reste ouvert.
   */
  const [replie, setReplie] = useState(false);
  useEffect(() => {
    try {
      setReplie(window.localStorage.getItem(CLE_VOLET) === '1');
    } catch {
      // Pas de stockage : volet ouvert, c'est le défaut lisible.
    }
  }, []);

  function basculer() {
    setReplie((avant) => {
      const apres = !avant;
      try {
        window.localStorage.setItem(CLE_VOLET, apres ? '1' : '0');
      } catch {
        // Idem : le repli vaut pour cette page, il ne sera pas retenu.
      }
      return apres;
    });
  }

  async function seDeconnecter() {
    await browserClient().auth.signOut();
    // `refresh()` avant de naviguer : les Server Components ont été rendus avec
    // la session, et sans lui la coquille resterait affichée le temps d'un
    // battement.
    router.refresh();
    router.push('/login');
  }

  return (
    <div className={styles.layout} data-replie={replie ? 'oui' : 'non'}>
      {/* §12.4 : le lien d'évitement est le **premier** arrêt de tabulation. Sans
          lui, chaque page impose de traverser toute la navigation au clavier. */}
      <a href="#contenu" className={styles.skip}>
        {t('shell.skip_to_content')}
      </a>

      <header className={styles.side}>
        <div className={styles.top}>
          {/* La marque de la **plateforme** en haut, la box en bas — deux
              identités, deux endroits. Replié, le logo se réduit à son « R ». */}
          <RackLogo compact={replie} />
          {/* Un vrai bouton, avec son état : `aria-expanded` dit au lecteur
              d'écran ce que la flèche dit à l'œil. */}
          <button
            type="button"
            className={styles.toggle}
            onClick={basculer}
            aria-expanded={!replie}
            aria-controls="navigation-box"
            aria-label={t(replie ? 'shell.expand_nav' : 'shell.collapse_nav')}
          >
            <ChevronLeft size={16} aria-hidden="true" />
          </button>
        </div>

        <nav id="navigation-box" className={styles.nav} aria-label={t('shell.nav_label')}>
          {NAV.filter((entry) => can(role, entry.right)).map(({ segment, labelKey, Icon }) => {
            const href = `${base}${segment}`;
            // Une sous-page garde sa section allumée ; le tableau de bord, lui,
            // n'est actif que sur son adresse exacte — sinon il le serait partout.
            const actif = segment === '' ? pathname === href : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={actif ? `${styles.link} ${styles.linkActive}` : styles.link}
                // L'état actif n'est pas porté par la seule couleur : il est
                // annoncé aux lecteurs d'écran (`.claude/rules/ui.md`).
                aria-current={actif ? 'page' : undefined}
                // Replié, le libellé reste dans l'arbre d'accessibilité (il est
                // masqué à l'œil, pas retiré) ; l'infobulle le rend à la souris.
                title={replie ? t(labelKey) : undefined}
              >
                <Icon size={20} aria-hidden="true" />
                <span className={styles.linkLabel}>{t(labelKey)}</span>
              </Link>
            );
          })}
        </nav>

        <DropdownMenu.Root>
          <DropdownMenu.Trigger
            className={styles.account}
            aria-label={`${boxName} — ${t(ROLE_LABELS[role])}`}
          >
            {/* Placeholder : les initiales sur la primaire de la box, comme sur
                l'accueil mobile, en attendant que `themes` serve un logo. */}
            <span className={styles.avatar} aria-hidden="true">
              {boxName.slice(0, 2).toUpperCase()}
            </span>
            <span className={styles.accountText}>
              <span className={styles.box}>{boxName}</span>
              <span className={styles.role}>{t(ROLE_LABELS[role])}</span>
            </span>
            <ChevronsUpDown size={16} aria-hidden="true" className={styles.accountChevron} />
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content className={ui.menu} sideOffset={8} side="top" align="start">
              {/* D-040 — la langue **en session**, écrite dans le rang le plus
                  fort (`useLocaleStorage`, via `setLocale`) : l'UI bascule
                  aussitôt, le choix survit au rechargement et remonte dans
                  `users.locale`. Le `default_locale` de la box, lui, ne concerne
                  que les e-mails aux membres — autre décision, autre endroit. */}
              <DropdownMenu.Label className={styles.menuLabel}>
                {t('language.label')}
              </DropdownMenu.Label>
              <DropdownMenu.RadioGroup
                value={locale}
                onValueChange={(valeur) => setLocale(valeur as Locale)}
              >
                {LOCALES.map((valeur) => (
                  <DropdownMenu.RadioItem key={valeur} value={valeur} className={ui.menuItem}>
                    <span className={styles.menuCheck}>
                      <DropdownMenu.ItemIndicator>
                        <Check size={16} aria-hidden="true" />
                      </DropdownMenu.ItemIndicator>
                    </span>
                    {t(valeur === 'fr' ? 'language.fr' : 'language.en')}
                  </DropdownMenu.RadioItem>
                ))}
              </DropdownMenu.RadioGroup>
              <DropdownMenu.Separator className={ui.menuSeparator} />
              <DropdownMenu.Item className={ui.menuItem} onSelect={() => void seDeconnecter()}>
                <LogOut size={16} aria-hidden="true" />
                {t('shell.sign_out')}
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </header>

      {/* `tabIndex={-1}` : la cible du lien d'évitement doit pouvoir recevoir le
          focus, sinon le saut est visuel et le clavier reste en haut. */}
      <main id="contenu" tabIndex={-1} className={styles.main}>
        {children}
      </main>
    </div>
  );
}
