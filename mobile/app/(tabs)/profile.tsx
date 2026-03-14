import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTripStore } from '../../store/trip-store';
import { C } from '../../lib/colors';

const menuItems: { icon: React.ComponentProps<typeof Feather>['name']; label: string; hint: string }[] = [
  { icon: 'bell', label: 'Notifications', hint: 'Manage alerts' },
  { icon: 'shield', label: 'Privacy & Security', hint: 'Data & permissions' },
  { icon: 'star', label: 'Rate TripPulse', hint: 'Share your feedback' },
  { icon: 'help-circle', label: 'Help & Support', hint: 'FAQs & contact' },
];

export default function ProfileScreen() {
  const router = useRouter();
  const { user } = useTripStore();
  const initials = user.display_name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <View style={s.avatarSection}>
          <View style={s.avatar}><Text style={s.avatarText}>{initials}</Text></View>
          <Text style={s.name}>{user.display_name}</Text><Text style={s.email}>{user.email}</Text>
        </View>
        <View style={s.statsRow}>
          {[{ label: 'Trips', value: '2' }, { label: 'Activities', value: '9' }, { label: 'Check-ins', value: '2' }].map(({ label, value }) => (
            <View key={label} style={s.stat}><Text style={s.statNum}>{value}</Text><Text style={s.statLabel}>{label}</Text></View>
          ))}
        </View>
        <View style={s.menu}>
          {menuItems.map(({ icon, label, hint }, idx) => (
            <Pressable key={label} style={[s.menuItem, idx < menuItems.length - 1 && s.menuBorder]}>
              <View style={s.menuIcon}><Feather name={icon} size={17} color={C.secondary} /></View>
              <View style={s.menuContent}><Text style={s.menuLabel}>{label}</Text><Text style={s.menuHint}>{hint}</Text></View>
              <Feather name="chevron-right" size={16} color={C.placeholder} />
            </Pressable>
          ))}
        </View>
        <Pressable onPress={() => router.replace('/login')} style={s.signout}><Text style={s.signoutText}>Sign Out</Text></Pressable>
        <Text style={s.version}>TripPulse v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg }, content: { paddingHorizontal: 20, paddingTop: 32, paddingBottom: 40 },
  avatarSection: { alignItems: 'center', marginBottom: 24 },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: C.sage, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  avatarText: { color: C.white, fontSize: 24, fontWeight: '700' }, name: { fontSize: 20, fontWeight: '700', color: C.fg }, email: { fontSize: 14, color: C.secondary, marginTop: 2 },
  statsRow: { flexDirection: 'row', justifyContent: 'center', gap: 32, paddingVertical: 16, marginBottom: 24 },
  stat: { alignItems: 'center' }, statNum: { fontSize: 24, fontWeight: '700', color: C.fg }, statLabel: { fontSize: 12, color: C.secondary, fontWeight: '500', marginTop: 2 },
  menu: { backgroundColor: C.white, borderRadius: 16, overflow: 'hidden', marginBottom: 24 },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, gap: 12 },
  menuBorder: { borderBottomWidth: 1, borderBottomColor: C.cardBg },
  menuIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.cardBg, justifyContent: 'center', alignItems: 'center' },
  menuContent: { flex: 1 }, menuLabel: { fontSize: 14, fontWeight: '600', color: C.fg }, menuHint: { fontSize: 12, color: C.placeholder },
  signout: { alignItems: 'center', paddingVertical: 8 }, signoutText: { fontSize: 14, color: C.secondary, fontWeight: '500' },
  version: { fontSize: 12, color: C.placeholder, textAlign: 'center', marginTop: 16 },
});
