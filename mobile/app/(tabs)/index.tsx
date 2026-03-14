import { View, Text, ScrollView, Image, Pressable, TextInput, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTripStore } from '../../store/trip-store';
import { ActivityIcon } from '../../components/ActivityIcon';
import { C } from '../../lib/colors';
import { F } from '../../lib/fonts';
import { formatTimeRange, getEnergyColor, getEnergyLabel, isBlockActive, DEMO_CURRENT_MINUTES, DEMO_CURRENT_DAY } from '../../lib/utils';

export default function DashboardScreen() {
  const router = useRouter();
  const { user, activeTrip, activityBlocks, checkIns } = useTripStore();
  const todayBlocks = activeTrip ? (activityBlocks[activeTrip.id] || []).filter((b) => b.day_index === DEMO_CURRENT_DAY) : [];
  const activeBlock = todayBlocks.find((b) => isBlockActive(b.start_time, b.end_time, DEMO_CURRENT_MINUTES));
  const checkedInIds = new Set(checkIns.map((c) => c.activity_block_id));
  const getHour = () => { const h = Math.floor(DEMO_CURRENT_MINUTES / 60); if (h < 12) return 'morning'; if (h < 17) return 'afternoon'; return 'evening'; };

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={s.topBar}>
          <View>
            <Text style={s.greeting}>Hello, {user.display_name}</Text>
            <Text style={s.sub}>Good {getHour()}</Text>
          </View>
          <View style={s.avatar}><Text style={s.avatarText}>{user.display_name.charAt(0).toUpperCase()}</Text></View>
        </View>

        <View style={s.searchWrap}>
          <Feather name="search" size={18} color={C.placeholder} style={s.searchIcon} />
          <TextInput style={s.searchInput} placeholder="Search destinations..." placeholderTextColor={C.placeholder} editable={false} />
        </View>

        {activeTrip ? (
          <Pressable onPress={() => router.push(`/trips/${activeTrip.id}` as never)}>
            <View style={s.heroCard}>
              {activeTrip.destination_image ? <Image source={{ uri: activeTrip.destination_image }} style={s.heroImage} /> : <View style={[s.heroImage, { backgroundColor: C.sage }]} />}
              <LinearGradient colors={['transparent', 'rgba(0,0,0,0.1)', 'rgba(0,0,0,0.6)']} style={StyleSheet.absoluteFill} />
              <Pressable style={s.heartBtn}><Feather name="heart" size={18} color={C.white} /></Pressable>
              <View style={s.heroBottom}>
                <Text style={s.heroTitle}>{activeTrip.destination}</Text>
                <View style={s.ratingRow}>
                  <Feather name="star" size={14} color={C.amber} />
                  <Text style={s.ratingText}>4.8</Text>
                  <Text style={s.ratingCount}>(2.4k reviews)</Text>
                </View>
              </View>
            </View>
          </Pressable>
        ) : (
          <View style={s.emptyCard}>
            <Text style={s.emptyTitle}>No active trip yet</Text>
            <Text style={s.emptySub}>Start planning your next wellness adventure</Text>
            <Pressable style={s.emptyBtn} onPress={() => router.push('/trips/new' as never)}>
              <Feather name="plus" size={16} color={C.white} />
              <Text style={s.emptyBtnText}>Create your first trip</Text>
            </Pressable>
          </View>
        )}

        {activeTrip && todayBlocks.length > 0 && (
          <View style={s.section}>
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>Today's Plan</Text>
              <View style={s.badge}><Text style={s.badgeText}>{todayBlocks.length} activities</Text></View>
            </View>
            {todayBlocks.slice().sort((a, b) => a.start_time.localeCompare(b.start_time)).map((block) => {
              const isActive = block.id === activeBlock?.id;
              const isCheckedIn = checkedInIds.has(block.id);
              const ec = getEnergyColor(block.energy_cost_estimate);
              return (
                <View key={block.id} style={[s.blockCard, isActive && s.blockCardActive]}>
                  <View style={s.blockRow}>
                    <View style={s.blockIcon}><ActivityIcon type={block.activity_type} size={18} color={C.secondary} /></View>
                    <View style={s.blockContent}>
                      <View style={s.blockTop}>
                        <View style={{ flex: 1 }}>
                          <Text style={s.blockName}>{block.place_name}</Text>
                          <Text style={s.blockTime}>{formatTimeRange(block.start_time, block.end_time)}</Text>
                        </View>
                        <View style={[s.energyBadge, { backgroundColor: ec.bg }]}>
                          <Text style={[s.energyText, { color: ec.text }]}>{getEnergyLabel(block.energy_cost_estimate)}</Text>
                        </View>
                      </View>
                      {isCheckedIn && <View style={s.doneRow}><View style={s.doneDot} /><Text style={s.doneText}>Done</Text></View>}
                      {isActive && !isCheckedIn && (
                        <Pressable style={s.checkinBtn} onPress={() => router.push(`/checkin/${block.id}` as never)}>
                          <Feather name="check-circle" size={14} color={C.white} />
                          <Text style={s.checkinBtnText}>Check In</Text>
                        </Pressable>
                      )}
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 110 },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  greeting: { fontSize: 26, fontFamily: F.bold, color: C.fg },
  sub: { fontSize: 14, fontFamily: F.regular, color: C.secondary, marginTop: 2 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.charcoal, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: C.white, fontSize: 16, fontFamily: F.bold },
  searchWrap: { position: 'relative', marginBottom: 24 },
  searchIcon: { position: 'absolute', left: 16, top: 14, zIndex: 1 },
  searchInput: { backgroundColor: C.white, borderWidth: 1, borderColor: C.border, borderRadius: 16, paddingLeft: 44, paddingRight: 16, paddingVertical: 13, fontSize: 14, fontFamily: F.regular, color: C.fg },
  heroCard: { width: '100%', height: 220, borderRadius: 24, overflow: 'hidden', marginBottom: 28 },
  heroImage: { width: '100%', height: '100%' },
  heartBtn: { position: 'absolute', top: 16, right: 16, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  heroBottom: { position: 'absolute', bottom: 16, left: 20, right: 20 },
  heroTitle: { color: C.white, fontSize: 22, fontFamily: F.bold },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  ratingText: { color: 'rgba(255,255,255,0.9)', fontSize: 14, fontFamily: F.semiBold },
  ratingCount: { color: 'rgba(255,255,255,0.6)', fontSize: 14, fontFamily: F.regular },
  emptyCard: { backgroundColor: C.white, borderRadius: 24, padding: 32, alignItems: 'center' },
  emptyTitle: { fontSize: 18, fontFamily: F.bold, color: C.fg, marginBottom: 8 },
  emptySub: { fontSize: 14, fontFamily: F.regular, color: C.secondary, marginBottom: 20, textAlign: 'center' },
  emptyBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.charcoal, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 999 },
  emptyBtnText: { color: C.white, fontFamily: F.semiBold, fontSize: 14 },
  section: { marginBottom: 16 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontFamily: F.bold, color: C.fg },
  badge: { backgroundColor: C.cardBg, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999 },
  badgeText: { fontSize: 12, fontFamily: F.medium, color: C.secondary },
  blockCard: { backgroundColor: C.white, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: 'transparent' },
  blockCardActive: { borderLeftWidth: 4, borderLeftColor: C.sage, borderColor: C.border },
  blockRow: { flexDirection: 'row', gap: 12 },
  blockIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: C.cardBg, justifyContent: 'center', alignItems: 'center' },
  blockContent: { flex: 1 },
  blockTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  blockName: { fontSize: 14, fontFamily: F.semiBold, color: C.fg },
  blockTime: { fontSize: 12, fontFamily: F.regular, color: C.placeholder, marginTop: 2 },
  energyBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  energyText: { fontSize: 10, fontFamily: F.semiBold },
  doneRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  doneDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.sage },
  doneText: { fontSize: 12, fontFamily: F.medium, color: C.eHighText },
  checkinBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.charcoal, borderRadius: 999, paddingVertical: 10, paddingHorizontal: 16, marginTop: 12 },
  checkinBtnText: { color: C.white, fontSize: 14, fontFamily: F.semiBold },
});
