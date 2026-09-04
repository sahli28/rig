import { Link } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';
import { useTheme } from '@rig/ui/theme';
import { useI18n } from '@rig/ui/i18n';
import { Banner, Button, Card, EmptyState, ListRow, SegmentedControl } from '@rig/ui/native';
import { useSession } from '../../lib/session';

/**
 * Atterrissage, aux couleurs de la box.
 *
 * Le planning et la réservation arrivent en P1 : ce que cet écran prouve, c'est
 * que la marque, le fuseau et les règles de la box sont arrivés en un seul
 * aller-retour, et que la session tient.
 */
export default function HomeScreen() {
  const theme = useTheme();
  const { t, locale, setLocale } = useI18n();
  const { me, activeTenantId, setActiveTenant, errorKey, signOut } = useSession();

  const memberships = me?.memberships ?? [];

  return (
    <ScrollView
      contentContainerStyle={{
        flexGrow: 1,
        backgroundColor: theme.colors.surface,
        padding: theme.space(4),
        gap: theme.space(4),
        justifyContent: 'center',
      }}
    >
      <Text
        style={{
          color: theme.colors.text,
          fontSize: theme.typography.display,
          fontFamily: theme.fontFamily,
          fontWeight: '700',
        }}
      >
        {theme.appName}
      </Text>

      {errorKey === null ? null : <Banner title={t(errorKey)} tone="danger" />}

      {memberships.length === 0 ? (
        <EmptyState title={t('home.no_box_title')} description={t('home.no_box_description')} />
      ) : activeTenantId === null ? (
        // Plusieurs boxes et aucune préférence : `me()` refuse de trancher, et
        // ce n'est pas au client de deviner non plus. On demande.
        <View style={{ gap: theme.space(3) }}>
          <Text
            style={{
              color: theme.colors.text,
              fontSize: theme.typography.body,
              fontFamily: theme.fontFamily,
              fontWeight: '500',
            }}
          >
            {t('home.choose_box')}
          </Text>
          {memberships.map((membership) => (
            <ListRow
              key={membership.id}
              title={membership.tenant_name}
              subtitle={membership.tenant_slug}
              onPress={() => void setActiveTenant(membership.tenant_id)}
            />
          ))}
        </View>
      ) : (
        <Card>
          <Text
            style={{
              color: theme.colors.textMuted,
              fontSize: theme.typography.body,
              fontFamily: theme.fontFamily,
            }}
          >
            {t('home.placeholder')}
          </Text>
        </Card>
      )}

      {me === null ? null : (
        <Text
          style={{
            color: theme.colors.textMuted,
            fontSize: theme.typography.small,
            fontFamily: theme.fontFamily,
          }}
        >
          {t('home.signed_in_as', { email: me.user.email })}
        </Text>
      )}

      {/* Le sélecteur de langue est ici pour prouver le critère de P0-003 :
          l'interface bascule sans redémarrage. Il rejoindra les réglages. */}
      <SegmentedControl
        accessibilityLabel={t('language.label')}
        value={locale}
        onChange={(value) => setLocale(value === 'fr' ? 'fr' : 'en')}
        options={[
          { value: 'fr', label: t('language.fr') },
          { value: 'en', label: t('language.en') },
        ]}
      />

      {/* L'action principale de l'accueil. Elle n'apparaît qu'une fois une box
          résolue : sans box, il n'y a pas de planning à montrer, et une porte
          qui se ferme est pire que pas de porte. */}
      {activeTenantId === null ? null : (
        <Link href="/planning" asChild>
          <Button label={t('home.planning_cta')} onPress={() => {}} fullWidth />
        </Link>
      )}

      <Link href="/design-system" asChild>
        <Button label={t('home.design_system_cta')} onPress={() => {}} fullWidth />
      </Link>

      <Button label={t('home.sign_out')} variant="ghost" onPress={() => void signOut()} fullWidth />
    </ScrollView>
  );
}
