import { useState, useRef } from 'react';
import {
  View, Text, Pressable, ScrollView, Image,
  StyleSheet, ActivityIndicator, Alert, Dimensions,
  Animated, PanResponder,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTripStore } from '../../store/trip-store';
import { C } from '../../lib/colors';
import { F } from '../../lib/fonts';

const SCREEN_W = Dimensions.get('window').width;
const CARD_W = SCREEN_W - 40;
const SWIPE_THRESHOLD = 80;

function fmtTime(s: string): string {
  if (!s) return '';
  const m = s.match(/(\d{1,2}):(\d{2})/);
  if (!m) return s;
  const h = Number(m[1]);
  const min = Number(m[2]);
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${String(min).padStart(2, '0')} ${ampm}`;
}

function getEnergyColor(label: string): string {
  if (label === 'very low') return C.sage;
  if (label === 'low') return '#a8b89a';
  return '#b8a06a';
}

export default function CheckInResultScreen() {
  const router = useRouter();
  const { blockId } = useLocalSearchParams<{ blockId: string }>();
  const {
    activityBlocks,
    suggestions,
    next_activity,
    gemini_message,
    trips,
    checkIns,
    latestCheckInId,
    addActivityBlock,
    updateSuggestionOutcome,
  } = useTripStore();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [placing, setPlacing] = useState(false);

  const pan = useRef(new Animated.ValueXY()).current;
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 10,
      onPanResponderMove: Animated.event([null, { dx: pan.x }], { useNativeDriver: false }),
      onPanResponderRelease: (_, g) => {
        if (suggestions.length > 0) {
          if (g.dx > SWIPE_THRESHOLD) setCurrentIndex((i) => (i - 1 + suggestions.length) % suggestions.length);
          else if (g.dx < -SWIPE_THRESHOLD) setCurrentIndex((i) => (i + 1) % suggestions.length);
        }
        Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: false }).start();
      },
    })
  ).current;

  const block = Object.values(activityBlocks).flat().find((b) => b.id === blockId);
  const nothingLeft = !next_activity;

  const handleChoose = async (placeId: string, placeName: string) => {
    if (placing) return;
    setPlacing(true);

    const sourceCheckIn = checkIns.find((c) => c.id === latestCheckInId);
    let tripId: string | null = null;
    let sourceBlock: (typeof activityBlocks)[string][number] | null = null;
    if (sourceCheckIn) {
      for (const [tid, blocks] of Object.entries(activityBlocks)) {
        const found = blocks.find((b) => b.id === sourceCheckIn.activity_block_id);
        if (found) { tripId = tid; sourceBlock = found; break; }
      }
    }
    if (!tripId) tripId = block?.trip_id ?? null;
    if (!tripId) { Alert.alert('Could not determine trip'); setPlacing(false); return; }

    const allBlocks = activityBlocks[tripId] ?? [];
    const trip = trips.find((t) => t.id === tripId);
    const dayIndex = sourceBlock?.day_index ?? 0;
    const baseDate = trip?.start_date ? new Date(trip.start_date) : new Date();
    baseDate.setDate(baseDate.getDate() + dayIndex);
    const dateStr = baseDate.toISOString().split('T')[0];

    let startISO: string;
    let endISO: string;

    if (nothingLeft) {
      // Nothing left today — append after source block end
      const endHHMM = sourceBlock ? sourceBlock.end_time.slice(0, 5) : '15:00';
      const [eh, em] = endHHMM.split(':').map(Number);
      const startMin = (eh ?? 15) * 60 + (em ?? 0) + 30;
      const endMin = startMin + 60;
      const pad = (n: number) =>
        String(Math.floor(n / 60) % 24).padStart(2, '0') + ':' + String(n % 60).padStart(2, '0');
      startISO = `${dateStr}T${pad(startMin)}:00`;
      endISO = `${dateStr}T${pad(endMin)}:00`;
    } else {
      const nextBlock = next_activity;
      if (nextBlock) {
        startISO = nextBlock.start_time.includes('T') ? nextBlock.start_time : `${dateStr}T${nextBlock.start_time.slice(0, 5)}:00`;
        endISO = nextBlock.end_time.includes('T') ? nextBlock.end_time : `${dateStr}T${nextBlock.end_time.slice(0, 5)}:00`;
      } else {
        const endHHMM = sourceBlock ? sourceBlock.end_time.slice(0, 5) : '15:00';
        const [eh, em] = endHHMM.split(':').map(Number);
        const startMin = (eh ?? 15) * 60 + (em ?? 0) + 30;
        const endMin = startMin + 60;
        const pad = (n: number) =>
          String(Math.floor(n / 60) % 24).padStart(2, '0') + ':' + String(n % 60).padStart(2, '0');
        startISO = `${dateStr}T${pad(startMin)}:00`;
        endISO = `${dateStr}T${pad(endMin)}:00`;
      }
    }

    await updateSuggestionOutcome({ agent_outcome: 'rerouted', selected_place_id: placeId, selected_place_name: placeName });

    try {
      const result = await addActivityBlock({
        trip_id: tripId,
        day_index: dayIndex,
        place_name: placeName,
        resolved_place_id: placeId,
        resolved_place_name: placeName,
        resolved_lat: null,
        resolved_lng: null,
        start_time: startISO,
        end_time: endISO,
        activity_type: 'other',
        energy_cost_estimate: sourceCheckIn?.energy_level ?? 5,
      });
      if (!result) { Alert.alert('Add failed', 'Insert returned null'); setPlacing(false); return; }
    } catch (err: any) {
      Alert.alert('Add failed', String(err?.message ?? err));
      setPlacing(false);
      return;
    }

    router.replace('/(tabs)' as never);
  };

  const current = suggestions[currentIndex];

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Top bar */}
        <View style={s.topBar}>
          <Pressable onPress={() => router.replace('/(tabs)' as never)} style={s.closeBtn}>
            <Feather name="x" size={20} color={C.secondary} />
          </Pressable>
        </View>

        {/* Confirmed badge */}
        <View style={s.confirmedRow}>
          <View style={s.checkCircle}>
            <Feather name="check" size={14} color={C.white} />
          </View>
          <Text style={s.confirmedText}>
            Checked in{block ? ` at ${block.place_name}` : ''}
          </Text>
        </View>

        {/* Next stop */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>
            {nothingLeft ? "YOU'RE DONE FOR TODAY" : 'YOUR NEXT STOP'}
          </Text>
          <View style={s.nextCard}>
            {nothingLeft ? (
              <>
                <Text style={s.nextName}>Nothing left on the plan 🎉</Text>
                <Text style={s.nextSub}>
                  The day is yours. Want to add something?
                </Text>
              </>
            ) : (
              <>
                <View style={s.nextTimeRow}>
                  <Feather name="clock" size={13} color={C.placeholder} />
                  <Text style={s.nextTime}>
                    {fmtTime(next_activity!.start_time)}
                    {next_activity!.end_time ? ` → ${fmtTime(next_activity!.end_time)}` : ''}
                  </Text>
                </View>
                <Text style={s.nextName}>{next_activity!.place_name}</Text>
              </>
            )}
          </View>
        </View>

        {/* Gemini card stack */}
        {suggestions.length > 0 && (
          <View style={s.section}>
            {/* Witty Gemini message */}
            <View style={s.geminiHeader}>
              <Text style={s.geminiSpark}>✦</Text>
              <Text style={s.geminiMessage}>{gemini_message}</Text>
            </View>

            {/* Swipeable card stack */}
            <Animated.View style={s.cardStack} {...panResponder.panHandlers}>
              {suggestions.map((suggestion, idx) => {
                const offset = ((idx - currentIndex) + suggestions.length) % suggestions.length;
                if (offset > 2) return null;

                const scale = 1 - offset * 0.04;
                const translateY = offset * 10;
                const isTop = offset === 0;

                const animatedStyle = isTop
                  ? {
                      transform: [
                        { translateX: pan.x },
                        { scale },
                        { translateY },
                        {
                          rotate: pan.x.interpolate({
                            inputRange: [-200, 0, 200],
                            outputRange: ['-5deg', '0deg', '5deg'],
                          }),
                        },
                      ],
                    }
                  : { transform: [{ scale }, { translateY }] };

                return (
                  <Animated.View
                    key={suggestion.place_id}
                    style={[
                      s.card,
                      { zIndex: suggestions.length - offset, opacity: isTop ? 1 : 0.6 },
                      animatedStyle,
                    ]}
                  >
                    {suggestion.image_url ? (
                      <Image source={{ uri: suggestion.image_url }} style={s.cardImage} />
                    ) : (
                      <LinearGradient colors={[C.sage, C.sageDark]} style={s.cardImage} />
                    )}
                    <LinearGradient
                      colors={['transparent', 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0.82)']}
                      style={StyleSheet.absoluteFill}
                    />

                    {idx === 0 && (
                      <View style={s.geminiPickBadge}>
                        <Text style={s.geminiPickText}>✦ Gemini's Pick</Text>
                      </View>
                    )}

                    <View style={[s.energyBadge, { backgroundColor: getEnergyColor(suggestion.energy_cost_label) }]}>
                      <Text style={s.energyBadgeText}>{suggestion.energy_cost_label} energy</Text>
                    </View>

                    <View style={s.cardBottom}>
                      <Text style={s.cardTitle}>{suggestion.place_name}</Text>
                      <Text style={s.cardDesc}>{suggestion.why_it_fits}</Text>
                      <View style={s.cardMeta}>
                        <View style={s.metaItem}>
                          <Feather name="map-pin" size={12} color="rgba(255,255,255,0.7)" />
                          <Text style={s.metaText}>{suggestion.distance_km} km</Text>
                        </View>
                        <View style={s.metaItem}>
                          <Feather name="clock" size={12} color="rgba(255,255,255,0.7)" />
                          <Text style={s.metaText}>{suggestion.estimated_duration_minutes} min</Text>
                        </View>
                      </View>
                    </View>
                  </Animated.View>
                );
              })}
            </Animated.View>

            {/* Dot nav */}
            {suggestions.length > 1 && (
              <View style={s.navRow}>
                <Pressable style={s.navBtn} onPress={() => setCurrentIndex((i) => (i - 1 + suggestions.length) % suggestions.length)} disabled={placing}>
                  <Feather name="chevron-left" size={20} color={C.fg} />
                </Pressable>
                <View style={s.dots}>
                  {suggestions.map((_, idx) => (
                    <Pressable key={idx} onPress={() => !placing && setCurrentIndex(idx)}>
                      <View style={[s.dot, idx === currentIndex && s.dotActive]} />
                    </Pressable>
                  ))}
                </View>
                <Pressable style={s.navBtn} onPress={() => setCurrentIndex((i) => (i + 1) % suggestions.length)} disabled={placing}>
                  <Feather name="chevron-right" size={20} color={C.fg} />
                </Pressable>
              </View>
            )}

            {/* Swap / Add CTA */}
            <Pressable
              style={[s.swapBtn, placing && s.swapBtnDisabled]}
              onPress={() => current && handleChoose(current.place_id, current.place_name)}
              disabled={placing}
            >
              {placing ? (
                <ActivityIndicator size="small" color={C.white} />
              ) : (
                <Feather name={nothingLeft ? 'plus-circle' : 'repeat'} size={17} color={C.white} />
              )}
              <Text style={s.swapBtnText}>
                {placing ? 'Adding…' : nothingLeft ? 'Add to my day' : 'Swap in'}
              </Text>
            </Pressable>
          </View>
        )}

        {/* Keep plan */}
        <Pressable style={s.keepBtn} onPress={() => router.replace('/(tabs)' as never)}>
          <Text style={s.keepBtnText}>
            {nothingLeft ? "I'm done, thanks" : 'Keep the plan'}
          </Text>
          <Feather name="arrow-right" size={16} color={C.white} />
        </Pressable>

      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  scroll: { paddingHorizontal: 20, paddingBottom: 48 },

  topBar: { paddingTop: 8, paddingBottom: 4, alignItems: 'flex-end' },
  closeBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.white, justifyContent: 'center', alignItems: 'center' },

  confirmedRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 24, marginTop: 8 },
  checkCircle: { width: 28, height: 28, borderRadius: 14, backgroundColor: C.sage, justifyContent: 'center', alignItems: 'center' },
  confirmedText: { fontSize: 15, fontFamily: F.semiBold, color: C.fg },

  section: { marginBottom: 24 },
  sectionLabel: { fontSize: 10, fontFamily: F.bold, color: C.placeholder, letterSpacing: 1.5, marginBottom: 10 },

  nextCard: {
    backgroundColor: C.white, borderRadius: 20, padding: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 3,
  },
  nextTimeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  nextTime: { fontSize: 13, fontFamily: F.medium, color: C.placeholder },
  nextName: { fontSize: 20, fontFamily: F.bold, color: C.fg },
  nextSub: { fontSize: 13, fontFamily: F.regular, color: C.secondary, marginTop: 6 },

  geminiHeader: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: C.white, borderRadius: 16, padding: 16, marginBottom: 14,
    borderLeftWidth: 3, borderLeftColor: C.sage,
  },
  geminiSpark: { fontSize: 18, color: C.sage, lineHeight: 22 },
  geminiMessage: { flex: 1, fontSize: 14, fontFamily: F.medium, color: C.secondary, lineHeight: 21, fontStyle: 'italic' },

  cardStack: { height: 380, marginBottom: 16 },
  card: { position: 'absolute', width: CARD_W, height: 360, borderRadius: 24, overflow: 'hidden' },
  cardImage: { width: '100%', height: '100%' },

  geminiPickBadge: {
    position: 'absolute', top: 16, right: 16,
    backgroundColor: 'rgba(255,255,255,0.18)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.45)',
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999,
  },
  geminiPickText: { color: C.white, fontSize: 11, fontFamily: F.semiBold },

  energyBadge: { position: 'absolute', top: 16, left: 16, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  energyBadgeText: { color: C.white, fontSize: 12, fontFamily: F.semiBold },

  cardBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 24 },
  cardTitle: { color: C.white, fontSize: 20, fontFamily: F.bold, marginBottom: 6 },
  cardDesc: { color: 'rgba(255,255,255,0.8)', fontSize: 14, fontFamily: F.regular, lineHeight: 20, marginBottom: 10 },
  cardMeta: { flexDirection: 'row', gap: 16 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontFamily: F.medium },

  navRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 24, marginBottom: 16 },
  navBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.white, justifyContent: 'center', alignItems: 'center' },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.border },
  dotActive: { width: 24, backgroundColor: C.charcoal },

  swapBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: C.charcoal, borderRadius: 999, paddingVertical: 15,
    shadowColor: C.charcoal, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8,
  },
  swapBtnDisabled: { backgroundColor: C.border },
  swapBtnText: { color: C.white, fontSize: 15, fontFamily: F.semiBold },

  keepBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: C.charcoal, borderRadius: 999, paddingVertical: 16, marginTop: 4,
    opacity: 0.7,
  },
  keepBtnText: { color: C.white, fontSize: 15, fontFamily: F.semiBold },
});
