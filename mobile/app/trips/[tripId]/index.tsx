import { useState } from 'react';
import { View, Text, ScrollView, Image, Pressable, StyleSheet, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTripStore } from '../../../store/trip-store';
import { ActivityIcon } from '../../../components/ActivityIcon';
import { C } from '../../../lib/colors';
import { formatDate, getDayCount, formatTimeRange, getEnergyColor, getEnergyLabel } from '../../../lib/utils';

export default function TripDetailScreen() {
  const router = useRouter();
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { trips, activityBlocks, checkIns } = useTripStore();

  const trip = trips.find((t) => t.id === tripId);
  const blocks = activityBlocks[tripId ?? ''] || [];
  const checkedInIds = new Set(checkIns.map((c) => c.activity_block_id));
  const dayCount = trip ? getDayCount(trip.start_date, trip.end_date) : 0;

  const [activeTab, setActiveTab] = useState<'itinerary' | 'activities' | 'details'>('itinerary');
  const [expandedDays, setExpandedDays] = useState<Set<number>>(new Set([0]));

  const toggleDay = (d: number) => {
    setExpandedDays((prev) => {
      const next = new Set(prev);
      next.has(d) ? next.delete(d) : next.add(d);
      return next;
    });
  };

  const getTimeOfDay = (time: string): string => {
    const h = parseInt(time.split(':')[0], 10);
    if (h < 12) return 'Morning';
    if (h < 17) return 'Afternoon';
    return 'Evening';
  };

  if (!trip) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.notFound}>
          <Text style={s.notFoundTitle}>Trip not found</Text>
          <Pressable onPress={() => router.back()}>
            <Text style={s.notFoundLink}>Go back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={s.safe}>
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        {/* Hero image */}
        <View style={s.hero}>
          {trip.destination_image ? (
            <Image source={{ uri: trip.destination_image }} style={s.heroImage} />
          ) : (
            <View style={[s.heroImage, { backgroundColor: C.sage }]} />
          )}
          <LinearGradient colors={['rgba(0,0,0,0.2)', 'transparent', 'rgba(0,0,0,0.4)']} style={StyleSheet.absoluteFill} />
          <SafeAreaView style={s.heroOverlay}>
            <Pressable onPress={() => router.back()} style={s.heroBtn}>
              <Feather name="arrow-left" size={18} color={C.white} />
            </Pressable>
            <Pressable style={s.heroBtn}>
              <Feather name="heart" size={18} color={C.white} />
            </Pressable>
          </SafeAreaView>
        </View>

        {/* Trip info */}
        <View style={s.info}>
          <Text style={s.tripName}>{trip.destination}</Text>
          <Text style={s.tripDates}>{formatDate(trip.start_date)} – {formatDate(trip.end_date)}</Text>
        </View>

        {/* Tab pills */}
        <View style={s.tabs}>
          {(['itinerary', 'activities', 'details'] as const).map((tab) => (
            <Pressable key={tab} onPress={() => setActiveTab(tab)} style={[s.tab, activeTab === tab && s.tabActive]}>
              <Text style={[s.tabText, activeTab === tab && s.tabTextActive]}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Content */}
        <View style={s.content}>
          {activeTab === 'itinerary' && (
            <View style={s.dayList}>
              {Array.from({ length: dayCount }, (_, dayIndex) => {
                const dayBlocks = blocks
                  .filter((b) => b.day_index === dayIndex)
                  .sort((a, b) => a.start_time.localeCompare(b.start_time));
                const isExpanded = expandedDays.has(dayIndex);

                const groups: Record<string, typeof dayBlocks> = {};
                dayBlocks.forEach((block) => {
                  const tod = getTimeOfDay(block.start_time);
                  if (!groups[tod]) groups[tod] = [];
                  groups[tod].push(block);
                });

                return (
                  <View key={dayIndex} style={s.dayCard}>
                    <Pressable onPress={() => toggleDay(dayIndex)} style={s.dayHeader}>
                      <View style={s.dayHeaderLeft}>
                        <Text style={s.dayTitle}>Day {dayIndex + 1}</Text>
                        <View style={s.dayBadge}>
                          <Text style={s.dayBadgeText}>
                            {dayBlocks.length} {dayBlocks.length === 1 ? 'activity' : 'activities'}
                          </Text>
                        </View>
                      </View>
                      <Feather name={isExpanded ? 'chevron-up' : 'chevron-down'} size={18} color={C.placeholder} />
                    </Pressable>

                    {isExpanded && (
                      <View style={s.dayContent}>
                        {Object.entries(groups).map(([timeOfDay, groupBlocks]) => (
                          <View key={timeOfDay} style={s.todGroup}>
                            <Text style={s.todLabel}>{timeOfDay.toUpperCase()}</Text>
                            {groupBlocks.map((block) => {
                              const ec = getEnergyColor(block.energy_cost_estimate);
                              const isCheckedIn = checkedInIds.has(block.id);
                              return (
                                <View key={block.id} style={s.blockRow}>
                                  <View style={s.blockTime}>
                                    <Text style={s.blockTimeText}>
                                      {formatTimeRange(block.start_time, block.end_time).split(' – ')[0]}
                                    </Text>
                                  </View>
                                  <View style={s.blockInfo}>
                                    <View style={s.blockTop}>
                                      <Text style={s.blockName}>{block.place_name}</Text>
                                      <View style={[s.energyBadge, { backgroundColor: ec.bg }]}>
                                        <Text style={[s.energyText, { color: ec.text }]}>
                                          {getEnergyLabel(block.energy_cost_estimate)}
                                        </Text>
                                      </View>
                                    </View>
                                    <Text style={s.blockTimeRange}>
                                      {formatTimeRange(block.start_time, block.end_time)}
                                    </Text>
                                    {isCheckedIn && (
                                      <View style={s.doneRow}>
                                        <View style={s.doneDot} />
                                        <Text style={s.doneText}>Done</Text>
                                      </View>
                                    )}
                                  </View>
                                </View>
                              );
                            })}
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          )}

          {activeTab === 'activities' && (
            <View style={s.placeholder}>
              <Text style={s.placeholderText}>{blocks.length} activities across {dayCount} days</Text>
            </View>
          )}

          {activeTab === 'details' && (
            <View style={s.placeholder}>
              <Text style={s.placeholderText}>Trip details coming soon</Text>
            </View>
          )}

          {/* Add Activity */}
          <Pressable style={s.addBtn} onPress={() => router.push(`/trips/${tripId}/itinerary` as never)}>
            <Feather name="plus" size={16} color={C.white} />
            <Text style={s.addBtnText}>Add Activity</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  notFound: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  notFoundTitle: { fontSize: 20, fontWeight: '700', color: C.fg, marginBottom: 8 },
  notFoundLink: { fontSize: 14, fontWeight: '600', color: C.sage },

  hero: { width: '100%', height: 260 },
  heroImage: { width: '100%', height: '100%' },
  heroOverlay: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 8 },
  heroBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },

  info: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8 },
  tripName: { fontSize: 24, fontWeight: '700', color: C.fg },
  tripDates: { fontSize: 14, color: C.secondary, marginTop: 4 },

  tabs: { flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 12, gap: 8 },
  tab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, backgroundColor: C.white },
  tabActive: { backgroundColor: C.charcoal },
  tabText: { fontSize: 14, fontWeight: '600', color: C.secondary },
  tabTextActive: { color: C.white },

  content: { paddingHorizontal: 20, paddingBottom: 32 },
  dayList: { gap: 12, marginTop: 8 },
  dayCard: { backgroundColor: C.white, borderRadius: 16, overflow: 'hidden' },
  dayHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16 },
  dayHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dayTitle: { fontSize: 16, fontWeight: '700', color: C.fg },
  dayBadge: { backgroundColor: C.cardBg, paddingHorizontal: 10, paddingVertical: 2, borderRadius: 999 },
  dayBadgeText: { fontSize: 12, color: C.secondary },

  dayContent: { paddingHorizontal: 20, paddingBottom: 16 },
  todGroup: { marginBottom: 16 },
  todLabel: { fontSize: 10, fontWeight: '600', color: C.placeholder, letterSpacing: 1, marginBottom: 8 },
  blockRow: { flexDirection: 'row', gap: 12, paddingVertical: 8 },
  blockTime: { width: 56 },
  blockTimeText: { fontSize: 12, color: C.secondary, fontWeight: '500' },
  blockInfo: { flex: 1 },
  blockTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  blockName: { fontSize: 14, fontWeight: '600', color: C.fg, flex: 1 },
  energyBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  energyText: { fontSize: 10, fontWeight: '600' },
  blockTimeRange: { fontSize: 12, color: C.placeholder, marginTop: 2 },
  doneRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  doneDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.sage },
  doneText: { fontSize: 12, color: C.eHighText, fontWeight: '500' },

  placeholder: { paddingVertical: 40, alignItems: 'center' },
  placeholderText: { fontSize: 14, color: C.secondary },

  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: C.charcoal, borderRadius: 999, paddingVertical: 14, marginTop: 20,
  },
  addBtnText: { color: C.white, fontSize: 14, fontWeight: '600' },
});
