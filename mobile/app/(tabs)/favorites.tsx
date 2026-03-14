import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { C } from '../../lib/colors';
import { F } from '../../lib/fonts';

export default function FavoritesScreen() {
  return (
    <SafeAreaView style={s.safe}>
      <View style={s.content}>
        <View style={s.iconWrap}>
          <Feather name="heart" size={32} color={C.placeholder} />
        </View>
        <Text style={s.title}>Saved Places</Text>
        <Text style={s.sub}>Your favorite spots will appear here</Text>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, paddingBottom: 110 },
  iconWrap: { width: 64, height: 64, borderRadius: 32, backgroundColor: C.cardBg, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 20, fontFamily: F.bold, color: C.fg },
  sub: { fontSize: 14, fontFamily: F.regular, color: C.secondary, marginTop: 4 },
});
