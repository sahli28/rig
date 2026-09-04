import { useCallback, useEffect, useMemo } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { ActivityIndicator, useColorScheme, View } from 'react-native';
import { ThemeProvider, brandFromTheme, useTheme } from '@rig/ui/theme';
import { I18nProvider } from '@rig/ui/i18n';
import { resolveLocale } from '@rig/core';
import { BrandProvider, useBrand } from '../lib/brand';
import { deviceLocale, deviceTimeZone, useLocaleStorage } from '../lib/locale';
import { SessionProvider, useSession } from '../lib/session';

/**
 * Aiguillage. Une seule fonction décide où l'on doit être, pour que la règle
 * soit lisible d'un coup d'œil plutôt que dispersée en gardes dans les écrans.
 */
function useAuthRedirect() {
  const { status, me } = useSession();
  const segments = useSegments();
  const router = useRouter();

  const inAuthGroup = segments[0] === '(auth)';

  /**
   * L'écran d'invitation s'aiguille lui-même : il détient un jeton qu'il doit
   * ranger avant de partir, et **une redirection n'emporte pas les paramètres**.
   * C'est cette règle-là, appliquée sans exception, qui a fait disparaître le
   * jeton du lien d'invitation le 3 septembre 2026.
   */
  const onInvitation = segments.includes('invitation');

  /**
   * Un aiguillage ne laisse rien derrière lui (D-009).
   *
   * `replace()` seul remplace l'écran courant et **garde ceux d'en dessous**.
   * Après `welcome → auth → profile-setup → consents → /`, la pile finissait
   * donc à `[welcome, /]` : on touchait le chevron, on revenait sur l'écran de
   * bienvenue, cette fonction refoulait aussitôt, et le chevron disparaissait.
   * Rien ne plantait — l'app se contredisait sous le doigt.
   *
   * La règle, et elle vaut sans exception : **cette fonction ne se déclenche
   * que lorsque l'écran courant est le mauvais.** Ce qu'il y a derrière un
   * mauvais écran est, par construction, tout aussi mauvais. Le seul retour
   * légitime est une navigation que la personne a demandée elle-même — le
   * bouton « Continuer » de l'écran de bienvenue, qui reste un `push`.
   */
  const redirect = useCallback(
    (href: '/welcome' | '/profile-setup' | '/consents' | '/') => {
      if (router.canDismiss()) router.dismissAll();
      router.replace(href);
    },
    [router],
  );

  useEffect(() => {
    if (status === 'loading' || onInvitation) return;

    if (status === 'signed_out') {
      if (!inAuthGroup) redirect('/welcome');
      return;
    }

    // Les actions restantes sont calculées par `me()`, pas devinées ici : le
    // client n'a pas à connaître la version courante des CGU.
    if (me?.required_actions.includes('COMPLETE_PROFILE')) {
      redirect('/profile-setup');
      return;
    }
    if (me?.required_actions.includes('ACCEPT_CONSENTS')) {
      redirect('/consents');
      return;
    }
    if (inAuthGroup) redirect('/');
  }, [status, me, inAuthGroup, onInvitation, redirect]);
}

/** Les options de navigation ont besoin du thème : elles vivent sous le fournisseur. */
function ThemedStack() {
  const theme = useTheme();
  const { status } = useSession();
  useAuthRedirect();

  if (status === 'loading') {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors.surface,
        }}
      >
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        /**
         * **Pas d'en-tête par défaut** (D-009).
         *
         * Sans cette ligne, un écran qui ne dit rien hérite du nom de sa route
         * en guise de titre : l'accueil s'annonçait `(app)/index`. Cinq écrans
         * sur six déclaraient bien le leur — ce qui montre le vrai défaut. Une
         * convention qui repose sur la mémoire de chacun tombe au premier oubli.
         *
         * Ce défaut-ci se corrige tout seul : oublier de déclarer donne « pas
         * d'en-tête », qui est visible et inoffensif, plutôt qu'un titre faux,
         * qui est invisible et faux. Un écran qui a besoin d'un retour déclare
         * `headerShown: true` **et** un titre traduit — voir `design-system.tsx`.
         */
        headerShown: false,
        /**
         * **`headerShown: false` ne suffit pas.** Masquer l'en-tête n'empêche
         * pas le routeur d'employer le nom de la route comme *titre* de
         * l'écran — et ce titre ressort ailleurs : le bouton retour de l'écran
         * suivant s'annonce « (app)/index, back » aux lecteurs d'écran. Le
         * défaut cessait d'être visible sans cesser d'exister.
         *
         * Trouvé en lisant l'arbre d'accessibilité, pas en regardant l'écran.
         * D'où un titre par défaut qui a du sens : le nom de la box, ou « RIG »
         * tant qu'aucune n'est résolue.
         */
        title: theme.appName,
        headerStyle: { backgroundColor: theme.colors.surface },
        headerTintColor: theme.colors.text,
        headerTitleStyle: { fontFamily: theme.fontFamily },
        contentStyle: { backgroundColor: theme.colors.surface },
      }}
    />
  );
}

/**
 * Arbitre la marque et le fuseau. Trois sources, dans cet ordre : la box
 * active de la session, la box du lien d'invitation, puis rien — c'est-à-dire
 * le thème RIG neutre. Jamais la dernière box vue : afficher les couleurs d'une
 * box qu'on ne rejoindra peut-être pas serait un mensonge visuel.
 */
function Branded() {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const { me } = useSession();
  const { brand: invitationBrand } = useBrand();

  const current = me?.current_tenant ?? null;
  const brand = current ? brandFromTheme(current.theme) : invitationBrand;
  const timeZone = current?.timezone ?? deviceTimeZone();

  /**
   * D-004, rangs 3 et 4 : tout ce qu'on peut savoir **avant** la connexion.
   * L'écran de bienvenue s'affiche là, et il doit déjà être dans la bonne
   * langue. Les rangs 1 et 2 — préférence enregistrée, puis `users.locale` —
   * arrivent ensuite et sont appliqués par le provider, sans le remonter.
   *
   * Calculé une fois : la langue de l'appareil ne change pas sans que l'OS
   * redémarre l'application.
   */
  const initialLocale = useMemo(() => resolveLocale({ device: deviceLocale() }), []);
  const localeStorage = useLocaleStorage(me?.user.id ?? null, me?.user.locale ?? null);

  return (
    <ThemeProvider scheme={scheme} {...(brand === null ? {} : { brand })}>
      <I18nProvider
        initialLocale={initialLocale}
        timeZone={timeZone}
        storage={localeStorage}
        profileLocale={me?.user.locale ?? null}
      >
        <ThemedStack />
      </I18nProvider>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <BrandProvider>
      <SessionProvider>
        <Branded />
      </SessionProvider>
    </BrandProvider>
  );
}
