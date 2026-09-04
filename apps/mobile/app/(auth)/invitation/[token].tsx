import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '@rig/ui/theme';
import { useBrand } from '../../../lib/brand';

/**
 * La route que l'URL d'invitation demandait, et qui n'existait pas.
 *
 * `apps/web` fabrique le lien `/invitation/<jeton>` (back-office → Staff, et le
 * QR mural). Ouvert sur l'iPhone le 3 septembre 2026, il tombait sur
 * « Unmatched Route » : `apps/mobile` n'avait pas la route sœur. Le layout
 * renvoyait alors sur `/welcome` **sans les paramètres**, et le jeton était
 * perdu avant d'avoir servi — l'invitation restait `PENDING` en base et la
 * personne atterrissait sur « aucune box », sans erreur affichée.
 *
 * Cet écran ne montre rien : il **capte** le jeton, le range dans le contexte
 * de marque — hors d'atteinte de toute redirection — et laisse l'écran de
 * bienvenue faire son travail, aux couleurs de la box invitante.
 *
 * Il vit dans le groupe `(auth)` à dessein : le chemin public reste
 * `/invitation/<jeton>`, mais `useAuthRedirect` le voit dans le groupe
 * d'authentification et ne le déloge pas pendant qu'il travaille.
 */
export default function InvitationScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { token } = useLocalSearchParams<{ token?: string }>();
  const { resolveToken } = useBrand();

  useEffect(() => {
    // `replace`, pas `push` : revenir en arrière sur un écran d'aiguillage
    // n'aurait aucun sens, et le jeton est déjà en sécurité dans le contexte.
    if (token === undefined || token === '') {
      router.replace('/welcome');
      return;
    }
    void resolveToken(token);
    router.replace('/welcome');
  }, [token, resolveToken, router]);

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
