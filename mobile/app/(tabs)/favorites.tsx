import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { C } from '../../lib/colors';

export default function FavoritesScreen() {
  return (
    <SafeAreaView style={s.safe}>
      <View style={s.content}>
        <Feather name="heart" size={48} color={C.border} />
        <Text style={s.title}>Saved Places</Text>
        <Text style={s.sub}>Your favorite spots will appear here</Text>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  title: { fontSize: 20, fontWeight: '700', color: C.fg, marginTop: 16 },
  sub: { fontSize: 14, color: C.secondary, marginTop: 4 },
});
