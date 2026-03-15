import { useEffect, useState } from 'react';
import { View, Text, ScrollView, Image, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTripStore } from '../../store/trip-store';
import { ActivityIcon } from '../../components/ActivityIcon';
import { C } from '../../lib/colors';
import { F } from '../../lib/fonts';
import { formatDate, formatTimeRange, getEnergyColor, getEnergyLabel, isBlockActive } from '../../lib/utils';

function toClockMinutes(value: string): number {
  if (!value) return 0;
  const raw = String(value).trim();
  const hhmm = raw.match(/^(\d{1,2}):(\d{2})/);
  if (hhmm) {
    const h = Number(hhmm[1]);
    const m = Number(hhmm[2]);
    if (!Number.isNaN(h) && !Number.isNaN(m)) {
      return h * 60 + m;
    }
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return 0;
  return parsed.getHours() * 60 + parsed.getMinutes();
}

function sortBlocksByDayAndTime<T extends { day_index: number; start_time: string; place_name: string }>(
  blocks: T[]
): T[] {
  return [...blocks].sort((a, b) => {
    const dayDiff = (a.day_index ?? 0) - (b.day_index ?? 0);
    if (dayDiff !== 0) return dayDiff;

    const timeDiff = toClockMinutes(a.start_time) - toClockMinutes(b.start_time);
    if (timeDiff !== 0) return timeDiff;

    return a.place_name.localeCompare(b.place_name);
  });
}

function getCurrentTripDayIndex(startDate: string, endDate: string, now: Date): number | null {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T23:59:59`);
  const currentDay = new Date(now);
  currentDay.setHours(0, 0, 0, 0);

  if (currentDay < start || currentDay > end) return null;
  const diffMs = currentDay.getTime() - start.getTime();
  return Math.floor(diffMs / (24 * 60 * 60 * 1000));
}

export default function DashboardScreen() {
  const router = useRouter();
  const { user, activeTrip, activityBlocks, checkIns } = useTripStore();
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const allTripBlocks = activeTrip ? sortBlocksByDayAndTime(activityBlocks[activeTrip.id] || []) : [];
  const currentTripDayIndex = activeTrip
    ? getCurrentTripDayIndex(activeTrip.start_date, activeTrip.end_date, now)
    : null;
  const blocksForCurrentDay =
    currentTripDayIndex == null
      ? []
      : allTripBlocks.filter((b) => b.day_index === currentTripDayIndex);
  const displayBlocks = blocksForCurrentDay.length > 0 ? blocksForCurrentDay : allTripBlocks;
  const activeBlock = displayBlocks.find((b) => isBlockActive(b.start_time, b.end_time, currentMinutes));
  const activeTripBlockIds = new Set(allTripBlocks.map((b) => b.id));
  const tripCheckIns = checkIns.filter((c) => activeTripBlockIds.has(c.activity_block_id));
  const checkedInIds = new Set(tripCheckIns.map((c) => c.activity_block_id));

  const hour = now.getHours();
  const timeOfDay = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  const activitySectionTitle =
    blocksForCurrentDay.length > 0 && currentTripDayIndex != null
      ? `Day ${currentTripDayIndex + 1} Activities`
      : 'Trip Activities';

  const avgEnergy = tripCheckIns.length > 0
    ? (tripCheckIns.reduce((sum, c) => sum + c.energy_level, 0) / tripCheckIns.length).toFixed(1)
    : '--';
  const lowEnergyCount = tripCheckIns.filter((c) => c.energy_level <= 4).length;
  const rerouteCount = tripCheckIns.filter((c) => c.agent_outcome === 'rerouted').length;

  const pulseTitle = lowEnergyCount > 0 ? 'Energy needs support today' : 'Steady wellness trend';
  const pulseBody = lowEnergyCount > 0
    ? 'Community support and gentler alternatives are ready whenever needed.'
    : 'You are pacing well. Keep checking in to stay ahead of fatigue.';

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={s.topBar}>
          <View style={{ flex: 1 }}>
            <Text style={s.greeting}>Good {timeOfDay}</Text>
            <Text style={s.greetingName}>{user?.display_name || 'Traveler'}, your wellness comes first</Text>
          </View>
          <View style={s.avatar}>
            <Text style={s.avatarText}>{(user?.display_name || 'T').charAt(0).toUpperCase()}</Text>
          </View>
        </View>

        <View style={s.dateRow}>
          <Feather name="heart" size={13} color={C.secondary} />
          <Text style={s.dateText}>{dateStr}</Text>
        </View>

        <LinearGradient colors={['#eef4ea', '#f7f4ef']} style={s.pulseCard}>
          <View style={s.pulseHeader}>
            <View style={s.pulseIcon}>
              <Feather name="activity" size={18} color={C.sageDark} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.pulseTitle}>{pulseTitle}</Text>
              <Text style={s.pulseBody}>{pulseBody}</Text>
            </View>
          </View>

          <View style={s.statsRow}>
            <View style={s.statCard}>
              <Text style={s.statValue}>{avgEnergy}</Text>
              <Text style={s.statLabel}>Avg energy</Text>
            </View>
            <View style={s.statCard}>
              <Text style={s.statValue}>{lowEnergyCount}</Text>
              <Text style={s.statLabel}>Low energy</Text>
            </View>
            <View style={s.statCard}>
              <Text style={s.statValue}>{rerouteCount}</Text>
              <Text style={s.statLabel}>AI reroutes</Text>
            </View>
          </View>

          <View style={s.actionsRow}>
            <Pressable style={s.communityBtn} onPress={() => router.push('/(tabs)/support' as never)}>
              <Feather name="life-buoy" size={14} color={C.white} />
              <Text style={s.communityBtnText}>Community support</Text>
            </Pressable>

            {activeBlock ? (
              <Pressable style={s.secondaryBtn} onPress={() => router.push(`/checkin/${activeBlock.id}` as never)}>
                <Feather name="check-circle" size={14} color={C.charcoal} />
                <Text style={s.secondaryBtnText}>Check in now</Text>
              </Pressable>
            ) : (
              <Pressable style={s.secondaryBtn} onPress={() => router.push('/(tabs)/favorites' as never)}>
                <Feather name="bar-chart-2" size={14} color={C.charcoal} />
                <Text style={s.secondaryBtnText}>Wellness insights</Text>
              </Pressable>
            )}
          </View>

        </LinearGradient>

        {activeTrip ? (
          <Pressable onPress={() => router.push(`/trips/${activeTrip.id}` as never)}>
            <View style={s.tripCard}>
              {activeTrip.destination_image ? (
                <Image source={{ uri: activeTrip.destination_image }} style={s.tripImage} />
              ) : (
                <View style={[s.tripImage, { backgroundColor: C.sage }]} />
              )}
              <LinearGradient colors={['transparent', 'rgba(0,0,0,0.15)', 'rgba(0,0,0,0.65)']} style={StyleSheet.absoluteFill} />
              <View style={s.tripBottom}>
                <Text style={s.tripTitle}>{activeTrip.destination}</Text>
                <Text style={s.tripSub}>{formatDate(activeTrip.start_date)} - {formatDate(activeTrip.end_date)} | {allTripBlocks.length} activities</Text>
              </View>
            </View>
          </Pressable>
        ) : (
          <View style={s.emptyCard}>
            <Text style={s.emptyTitle}>Start a wellness plan</Text>
            <Text style={s.emptySub}>Create a trip, then let AI monitor your energy and suggest gentler alternatives.</Text>
            <Pressable style={s.emptyBtn} onPress={() => router.push('/trips/new' as never)}>
              <Feather name="plus" size={16} color={C.white} />
              <Text style={s.emptyBtnText}>Create trip</Text>
            </Pressable>
          </View>
        )}

        {activeTrip && displayBlocks.length > 0 && (
          <View style={s.section}>
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>{activitySectionTitle}</Text>
              <View style={s.badge}><Text style={s.badgeText}>{checkedInIds.size}/{displayBlocks.length}</Text></View>
            </View>

            <View style={s.roadmap}>
              {displayBlocks.map((block, idx) => {
                const isActive = block.id === activeBlock?.id;
                const isCheckedIn = checkedInIds.has(block.id);
                const isLast = idx === displayBlocks.length - 1;
                const ec = getEnergyColor(block.energy_cost_estimate);
                const nodeColor = isActive ? C.sage : isCheckedIn ? C.sage : C.border;

                return (
                  <Pressable
                    key={block.id}
                    style={s.rmRow}
                    onPress={() => router.push(`/checkin/${block.id}` as never)}
                  >
                    {/* Spine */}
                    <View style={s.rmSpine}>
                      <View style={[
                        s.rmNode,
                        { backgroundColor: nodeColor, borderColor: nodeColor + '40' },
                        isActive && s.rmNodeActive,
                      ]}>
                        {isCheckedIn && <Feather name="check" size={8} color={C.white} />}
                        {isActive && !isCheckedIn && <View style={s.rmNodePulse} />}
                      </View>
                      {!isLast && (
                        <View style={[s.rmLine, { backgroundColor: isCheckedIn ? C.sage + '50' : C.border }]} />
                      )}
                    </View>

                    {/* Card */}
                    <View style={[s.rmCard, isActive && s.rmCardActive]}>
                      {isActive && <View style={s.rmNowBadge}><Text style={s.rmNowText}>NOW</Text></View>}
                      <View style={s.rmCardTop}>
                        <View style={[s.rmIconWrap, { backgroundColor: isActive ? C.sage + '18' : C.cardBg }]}>
                          <ActivityIcon type={block.activity_type} size={16} color={isActive ? C.sage : C.secondary} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={s.rmName} numberOfLines={1}>{block.place_name}</Text>
                          <Text style={s.rmTime}>{formatTimeRange(block.start_time, block.end_time)}</Text>
                        </View>
                        <View style={[s.rmEnergyDot, { backgroundColor: ec.bg }]}>
                          <Text style={[s.rmEnergyText, { color: ec.text }]}>{getEnergyLabel(block.energy_cost_estimate)}</Text>
                        </View>
                      </View>
                      {isCheckedIn && (
                        <View style={s.rmDoneRow}>
                          <Feather name="check-circle" size={11} color={C.sage} />
                          <Text style={s.rmDoneText}>Checked in</Text>
                        </View>
                      )}
                      {isActive && !isCheckedIn && (
                        <View style={s.rmCtaRow}>
                          <Feather name="zap" size={12} color={C.sageDark} />
                          <Text style={s.rmCtaText}>Tap to check in</Text>
                        </View>
                      )}
                    </View>
                  </Pressable>
                );
              })}

              {/* End node */}
              <View style={s.rmEndRow}>
                <View style={s.rmSpine}>
                  <View style={s.rmEndDot} />
                </View>
                <Text style={s.rmEndText}>End of day</Text>
              </View>
            </View>
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

  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  greeting: { fontSize: 28, fontFamily: F.bold, color: C.fg, letterSpacing: -0.5 },
  greetingName: { fontSize: 14, fontFamily: F.medium, color: C.secondary, marginTop: 4, lineHeight: 20 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.sage, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: C.white, fontSize: 17, fontFamily: F.bold },

  dateRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: C.white, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10,
    marginBottom: 16, alignSelf: 'flex-start',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8,
  },
  dateText: { fontSize: 13, fontFamily: F.medium, color: C.secondary },

  pulseCard: {
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: '#dce7d5',
    marginBottom: 18,
  },
  pulseHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 12 },
  pulseIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#dde9d6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseTitle: { fontSize: 17, fontFamily: F.bold, color: C.fg },
  pulseBody: { fontSize: 13, fontFamily: F.regular, color: C.secondary, marginTop: 4, lineHeight: 18 },

  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  statCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  statValue: { fontSize: 18, fontFamily: F.bold, color: C.sageDark },
  statLabel: { fontSize: 11, fontFamily: F.medium, color: C.placeholder, marginTop: 2 },

  actionsRow: { flexDirection: 'row', gap: 8 },
  communityBtn: {
    flex: 1,
    backgroundColor: C.charcoal,
    borderRadius: 999,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  communityBtnText: { color: C.white, fontSize: 12, fontFamily: F.semiBold },
  secondaryBtn: {
    flex: 1,
    backgroundColor: C.white,
    borderRadius: 999,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: C.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  secondaryBtnText: { color: C.charcoal, fontSize: 12, fontFamily: F.semiBold },

  tripCard: {
    width: '100%',
    height: 210,
    borderRadius: 26,
    overflow: 'hidden',
    marginBottom: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 6,
  },
  tripImage: { width: '100%', height: '100%' },
  tripBottom: { position: 'absolute', bottom: 16, left: 18, right: 18 },
  tripTitle: {
    color: C.white,
    fontSize: 24,
    fontFamily: F.bold,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  tripSub: { color: 'rgba(255,255,255,0.9)', fontSize: 13, fontFamily: F.medium, marginTop: 5 },

  emptyCard: { backgroundColor: C.white, borderRadius: 24, padding: 32, alignItems: 'center' },
  emptyTitle: { fontSize: 18, fontFamily: F.bold, color: C.fg, marginBottom: 8 },
  emptySub: { fontSize: 14, fontFamily: F.regular, color: C.secondary, marginBottom: 20, textAlign: 'center' },
  emptyBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.charcoal, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 999 },
  emptyBtnText: { color: C.white, fontFamily: F.semiBold, fontSize: 14 },

  section: { marginBottom: 16 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  sectionTitle: { fontSize: 18, fontFamily: F.bold, color: C.fg },
  badge: { backgroundColor: C.cardBg, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999 },
  badgeText: { fontSize: 11, fontFamily: F.bold, color: C.secondary },

  // Roadmap timeline
  roadmap: { paddingLeft: 4 },
  rmRow: { flexDirection: 'row', alignItems: 'stretch', minHeight: 72 },
  rmSpine: { width: 24, alignItems: 'center', paddingTop: 2 },
  rmNode: {
    width: 14, height: 14, borderRadius: 7, borderWidth: 2,
    justifyContent: 'center', alignItems: 'center', zIndex: 1,
  },
  rmNodeActive: {
    width: 18, height: 18, borderRadius: 9,
    shadowColor: C.sage, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.4, shadowRadius: 6,
  },
  rmNodePulse: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.white },
  rmLine: { flex: 1, width: 2, marginVertical: 2 },

  rmCard: {
    flex: 1, marginLeft: 10, marginBottom: 8,
    backgroundColor: C.white, borderRadius: 14, padding: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
  },
  rmCardActive: {
    backgroundColor: '#f5f9f2', borderWidth: 1, borderColor: C.sage + '40',
    shadowColor: C.sage, shadowOpacity: 0.1, shadowRadius: 12,
  },
  rmNowBadge: {
    position: 'absolute', top: -8, right: 12,
    backgroundColor: C.sage, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, zIndex: 1,
  },
  rmNowText: { color: C.white, fontSize: 9, fontFamily: F.bold, letterSpacing: 1 },
  rmCardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rmIconWrap: { width: 34, height: 34, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  rmName: { fontSize: 14, fontFamily: F.bold, color: C.fg },
  rmTime: { fontSize: 11, fontFamily: F.medium, color: C.placeholder, marginTop: 1 },
  rmEnergyDot: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999 },
  rmEnergyText: { fontSize: 9, fontFamily: F.bold },
  rmDoneRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6, marginLeft: 44 },
  rmDoneText: { fontSize: 11, fontFamily: F.medium, color: C.sage },
  rmCtaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6, marginLeft: 44 },
  rmCtaText: { fontSize: 11, fontFamily: F.semiBold, color: C.sageDark },

  rmEndRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2, paddingBottom: 8 },
  rmEndDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.border },
  rmEndText: { marginLeft: 18, fontSize: 11, fontFamily: F.regular, color: C.placeholder },
});
