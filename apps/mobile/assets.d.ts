/**
 * Metro rend un identifiant d'asset pour une image importée. `expo-env.d.ts`
 * le déclarerait, mais il est généré et ignoré par git : la CI ne l'a pas.
 */
declare module '*.jpg' {
  import type { ImageSourcePropType } from 'react-native';
  const source: ImageSourcePropType;
  export default source;
}
