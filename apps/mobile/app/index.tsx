import { Text, View } from 'react-native';

export default function HomeScreen() {
  // Écran volontairement nu : P0-001 ne livre que le squelette.
  // Styles inline provisoires — aucun token de thème n'existe avant P0-002.
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>RIG</Text>
    </View>
  );
}
