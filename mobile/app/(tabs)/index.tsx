import { useState } from 'react';
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

  const activeIndex = todayBlocks.findIndex((b) => b.id === activeBlock?.id);
  const pastBlocks = activeIndex > 0 ? todayBlocks.slice(0, activeIndex) : [];
  const upcomingBlocks = activeIndex >= 0 ? todayBlocks.slice(activeIndex) : todayBlocks;

  const [showPast, setShowPast] = useState(false);

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
            {pastBlocks.length > 0 && (
              <View style={s.pastContainer}>
                <Pressable onPress={() => setShowPast(!showPast)} style={s.pastHeader}>
                  <Text style={s.pastTitle}>Past ({pastBlocks.length})</Text>
                  <Feather name={showPast ? "chevron-up" : "chevron-down"} size={16} color={C.placeholder} />
                </Pressable>
                {showPast && pastBlocks.map((block) => {
                  const isCheckedIn = checkedInIds.has(block.id);
                  return (
                    <View key={block.id} style={[s.blockCard, s.blockCardPast]}>
                      <View style={s.blockRow}>
                        <View style={[s.blockIcon, s.blockIconPast]}><ActivityIcon type={block.activity_type} size={16} color={C.placeholder} /></View>
                        <View style={s.blockContent}>
                          <View style={s.blockTop}>
                            <View style={{ flex: 1 }}>
                              <Text style={[s.blockName, s.blockTextPast]}>{block.place_name}</Text>
                              <Text style={s.blockTime}>{formatTimeRange(block.start_time, block.end_time)}</Text>
                            </View>
                            {isCheckedIn && <Feather name="check" size={16} color={C.sage} style={{ marginTop: 2 }} />}
                          </View>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
            
            {upcomingBlocks.map((block) => {
              const isActive = block.id === activeBlock?.id;
              const isCheckedIn = checkedInIds.has(block.id);
              const ec = getEnergyColor(block.energy_cost_estimate);
              return (
                <View key={block.id} style={[s.blockCard, isActive && s.blockCardActive]}>
                  {isActive && <View style={s.activeIndicator}><Text style={s.activeText}>NOW</Text></View>}
                  <View style={s.blockRow}>
                    <View style={[s.blockIcon, isActive && s.blockIconActive]}><ActivityIcon type={block.activity_type} size={isActive ? 20 : 18} color={isActive ? C.sage : C.secondary} /></View>
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
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 },
  greeting: { fontSize: 32, fontFamily: F.bold, color: C.fg, letterSpacing: -0.5 },
  sub: { fontSize: 16, fontFamily: F.medium, color: C.secondary, marginTop: 4 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: C.sage, justifyContent: 'center', alignItems: 'center', shadowColor: C.sage, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  avatarText: { color: C.white, fontSize: 18, fontFamily: F.bold },
  searchWrap: { position: 'relative', marginBottom: 24 },
  searchIcon: { position: 'absolute', left: 16, top: 14, zIndex: 1 },
  searchInput: { backgroundColor: C.white, borderWidth: 1, borderColor: C.border, borderRadius: 16, paddingLeft: 44, paddingRight: 16, paddingVertical: 13, fontSize: 14, fontFamily: F.regular, color: C.fg },
  heroCard: { width: '100%', height: 260, borderRadius: 32, overflow: 'hidden', marginBottom: 36, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 8 },
  heroImage: { width: '100%', height: '100%' },
  heartBtn: { position: 'absolute', top: 20, right: 20, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.25)', justifyContent: 'center', alignItems: 'center' },
  heroBottom: { position: 'absolute', bottom: 20, left: 24, right: 24 },
  heroTitle: { color: C.white, fontSize: 28, fontFamily: F.bold, textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 8 },
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
  blockCard: { backgroundColor: C.white, borderRadius: 20, padding: 20, marginBottom: 16, borderLeftWidth: 4, borderLeftColor: 'transparent', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 12, elevation: 3 },
  blockCardActive: { borderLeftColor: C.sage, shadowOpacity: 0.12, shadowRadius: 16, transform: [{ scale: 1.02 }] },
  blockCardPast: { opacity: 0.6, padding: 16, marginBottom: 12, shadowOpacity: 0 },
  activeIndicator: { position: 'absolute', top: -10, right: 20, backgroundColor: C.sage, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, zIndex: 1, shadowColor: C.sage, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4 },
  activeText: { color: C.white, fontSize: 10, fontFamily: F.bold, letterSpacing: 1 },
  blockRow: { flexDirection: 'row', gap: 16 },
  blockIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: C.cardBg, justifyContent: 'center', alignItems: 'center' },
  blockIconActive: { backgroundColor: C.sage + '20' }, // 20 hex opacity
  blockIconPast: { width: 40, height: 40, borderRadius: 12 },
  blockContent: { flex: 1, justifyContent: 'center' },
  blockTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  blockName: { fontSize: 16, fontFamily: F.bold, color: C.fg },
  blockTextPast: { fontSize: 14, fontFamily: F.semiBold },
  blockTime: { fontSize: 13, fontFamily: F.medium, color: C.placeholder, marginTop: 4 },
  pastContainer: { marginBottom: 16 },
  pastHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 8, marginBottom: 8 },
  pastTitle: { fontSize: 14, fontFamily: F.bold, color: C.placeholder, textTransform: 'uppercase', letterSpacing: 1 },
  energyBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  energyText: { fontSize: 10, fontFamily: F.semiBold },
  doneRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  doneDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.sage },
  doneText: { fontSize: 12, fontFamily: F.medium, color: C.eHighText },
  checkinBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.charcoal, borderRadius: 999, paddingVertical: 12, paddingHorizontal: 16, marginTop: 12 },
  checkinBtnText: { color: C.white, fontSize: 14, fontFamily: F.semiBold },
});
