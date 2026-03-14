import { useState, useRef } from 'react';
import { View, Text, Pressable, Image, Animated, PanResponder, Dimensions, Linking, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTripStore } from '../../store/trip-store';
import { C } from '../../lib/colors';
import { F } from '../../lib/fonts';

const SCREEN_W = Dimensions.get('window').width;
const CARD_W = SCREEN_W - 40;
const SWIPE_THRESHOLD = 80;

function getEnergyBadgeColor(label: 'very low' | 'low' | 'moderate'): string {
  switch (label) {
    case 'very low': return C.sage;
    case 'low': return C.sageLight;
    case 'moderate': return '#b8a06a';
  }
}

export default function SuggestionsScreen() {
  const router = useRouter();
  const {
    suggestions,
    updateSuggestionOutcome,
    addActivityBlock,
    activeTrip,
    activityBlocks,
    checkIns,
    latestCheckInId,
    trips,
  } = useTripStore();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [placing, setPlacing] = useState(false);

  const pan = useRef(new Animated.ValueXY()).current;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 10,
      onPanResponderMove: Animated.event([null, { dx: pan.x }], { useNativeDriver: false }),
      onPanResponderRelease: (_, gesture) => {
        if (suggestions.length > 0) {
          if (gesture.dx > SWIPE_THRESHOLD) goPrev();
          else if (gesture.dx < -SWIPE_THRESHOLD) goNext();
        }
        Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: false }).start();
      },
    })
  ).current;

  const goNext = () => setCurrentIndex((prev) => (prev + 1) % suggestions.length);
  const goPrev = () => setCurrentIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);

  const handleChoose = async (placeId: string, placeName: string) => {
    if (placing) return;
    setPlacing(true);

    // Find source check-in's activity block by searching all trips
    const sourceCheckIn = checkIns.find((c) => c.id === latestCheckInId);
    let tripId: string | null = null;
    let sourceBlock: (typeof activityBlocks)[string][number] | null = null;
    if (sourceCheckIn) {
      for (const [tid, blocks] of Object.entries(activityBlocks)) {
        const found = blocks.find((b) => b.id === sourceCheckIn.activity_block_id);
        if (found) { tripId = tid; sourceBlock = found; break; }
      }
    }
    if (!tripId) tripId = activeTrip?.id ?? null;

    if (!tripId) {
      Alert.alert('Add failed', 'Could not determine trip');
      setPlacing(false);
      return;
    }

    // Find the next block after the source — the alternative replaces that slot
    const allBlocks = activityBlocks[tripId] ?? [];
    const nextBlock = sourceBlock
      ? allBlocks
          .filter((b) => b.start_time > sourceBlock!.end_time)
          .sort((a, b) => a.start_time.localeCompare(b.start_time))[0] ?? null
      : null;

    // Build full ISO timestamps — DB stores timestamptz, not plain HH:MM
    const trip = trips.find((t) => t.id === tripId);
    const dayIndex = sourceBlock?.day_index ?? 0;
    const baseDate = trip?.start_date ? new Date(trip.start_date) : new Date();
    baseDate.setDate(baseDate.getDate() + dayIndex);
    const dateStr = baseDate.toISOString().split('T')[0]; // "YYYY-MM-DD"

    let startISO: string;
    let endISO: string;
    if (nextBlock) {
      // Slot in place of next scheduled event
      startISO = nextBlock.start_time.includes('T')
        ? nextBlock.start_time
        : `${dateStr}T${nextBlock.start_time.slice(0, 5)}:00`;
      endISO = nextBlock.end_time.includes('T')
        ? nextBlock.end_time
        : `${dateStr}T${nextBlock.end_time.slice(0, 5)}:00`;
    } else {
      // No next event — schedule 30 min after source block ends
      const endHHMM = sourceBlock ? sourceBlock.end_time.slice(0, 5) : '14:00';
      const [eh, em] = endHHMM.split(':').map(Number);
      const startMin = (eh ?? 14) * 60 + (em ?? 0) + 30;
      const endMin = startMin + 60;
      const pad = (n: number) => String(Math.floor(n) % 24).padStart(2, '0');
      startISO = `${dateStr}T${pad(startMin / 60)}:${String(startMin % 60).padStart(2, '0')}:00`;
      endISO = `${dateStr}T${pad(endMin / 60)}:${String(endMin % 60).padStart(2, '0')}:00`;
    }

    // Check for overlap with existing blocks on that day
    const parseHHMM = (s: string): number => {
      const clean = s.slice(0, 5);
      const [h, m] = clean.split(':').map(Number);
      return (h ?? 0) * 60 + (m ?? 0);
    };
    const newStart = parseHHMM(startISO.includes('T') ? startISO.split('T')[1] : startISO);
    const newEnd = parseHHMM(endISO.includes('T') ? endISO.split('T')[1] : endISO);
    const sameDay = allBlocks.filter((b) => b.day_index === dayIndex);
    const conflicting = sameDay.find((b) => {
      const bs = parseHHMM(b.start_time.includes('T') ? b.start_time.split('T')[1] : b.start_time);
      const be = parseHHMM(b.end_time.includes('T') ? b.end_time.split('T')[1] : b.end_time);
      return newStart < be && newEnd > bs;
    });
    if (conflicting) {
      // Push start to after the conflicting block
      const be = parseHHMM(conflicting.end_time.includes('T') ? conflicting.end_time.split('T')[1] : conflicting.end_time);
      const adjustedStart = be + 15;
      const adjustedEnd = adjustedStart + 60;
      const pad = (n: number) => String(Math.floor(n / 60) % 24).padStart(2, '0') + ':' + String(n % 60).padStart(2, '0');
      const datePrefix = startISO.includes('T') ? startISO.split('T')[0] : startISO.slice(0, 10);
      startISO = `${datePrefix}T${pad(adjustedStart)}:00`;
      endISO = `${datePrefix}T${pad(adjustedEnd)}:00`;
    }

    await updateSuggestionOutcome({
      agent_outcome: 'rerouted',
      selected_place_id: placeId,
      selected_place_name: placeName,
    });

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
      if (!result) {
        Alert.alert('Add failed', 'Insert returned null');
        setPlacing(false);
        return;
      }
    } catch (err: any) {
      Alert.alert('Add failed', String(err?.message ?? err));
      setPlacing(false);
      return;
    }

    router.replace('/(tabs)');
  };

  const current = suggestions[currentIndex];

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.container}>
        <View style={s.header}>
          <Pressable onPress={() => router.back()} style={s.backBtn}>
            <Feather name="chevron-left" size={18} color={C.fg} />
          </Pressable>
          <View>
            <Text style={s.headerTitle}>Alternative activities</Text>
            <Text style={s.headerSub}>Swipe to browse options</Text>
          </View>
        </View>

        {suggestions.length === 0 ? (
          <View style={s.emptyState}>
            <View style={s.emptyIcon}>
              <Feather name="map" size={24} color={C.placeholder} />
            </View>
            <Text style={s.emptyTitle}>No nearby alternatives yet</Text>
            <Text style={s.emptyText}>
              No nearby places were found. Check your location permissions and try again.
            </Text>
          </View>
        ) : (
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
                  style={[s.card, { zIndex: suggestions.length - offset, opacity: isTop ? 1 : 0.6 }, animatedStyle]}
                >
                  {suggestion.image_url ? (
                    <Image source={{ uri: suggestion.image_url }} style={s.cardImage} />
                  ) : (
                    <View style={[s.cardImage, { backgroundColor: C.sage }]} />
                  )}
                  <LinearGradient colors={['transparent', 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0.8)']} style={StyleSheet.absoluteFill} />

                  <View style={[s.energyBadge, { backgroundColor: getEnergyBadgeColor(suggestion.energy_cost_label) }]}>
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
                      {suggestion.maps_url ? (
                        <Pressable style={s.metaItem} onPress={() => Linking.openURL(suggestion.maps_url)}>
                          <Feather name="external-link" size={12} color="rgba(255,255,255,0.7)" />
                          <Text style={s.metaText}>Maps</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
                </Animated.View>
              );
            })}
          </Animated.View>
        )}

        {suggestions.length > 1 ? (
          <View style={s.navRow}>
            <Pressable style={s.navBtn} onPress={goPrev} disabled={placing}>
              <Feather name="chevron-left" size={20} color={C.fg} />
            </Pressable>
            <View style={s.dots}>
              {suggestions.map((_, idx) => (
                <Pressable key={idx} onPress={() => !placing && setCurrentIndex(idx)}>
                  <View style={[s.dot, idx === currentIndex && s.dotActive]} />
                </Pressable>
              ))}
            </View>
            <Pressable style={s.navBtn} onPress={goNext} disabled={placing}>
              <Feather name="chevron-right" size={20} color={C.fg} />
            </Pressable>
          </View>
        ) : null}

        <Pressable
          style={[s.chooseBtn, placing && s.chooseBtnDisabled]}
          onPress={() => current && handleChoose(current.place_id, current.place_name)}
          disabled={placing}
        >
          {placing ? (
            <ActivityIndicator size="small" color={C.white} />
          ) : (
            <Feather name="plus-circle" size={18} color={C.white} />
          )}
          <Text style={s.chooseBtnText}>
            {placing ? 'Adding…' : 'Add to my plan'}
          </Text>
        </Pressable>

        <Pressable
          onPress={async () => {
            await updateSuggestionOutcome({ agent_outcome: 'dismissed' });
            router.replace('/(tabs)');
          }}
          style={s.skipBtn}
          disabled={placing}
        >
          <Text style={s.skipText}>Skip — keep my current plan</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  container: { flex: 1, paddingHorizontal: 20, paddingTop: 8 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.white, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontFamily: F.bold, color: C.fg },
  headerSub: { fontSize: 12, fontFamily: F.regular, color: C.placeholder },

  cardStack: { height: 420, marginBottom: 16 },
  emptyState: {
    height: 320, backgroundColor: C.white, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, marginBottom: 16,
  },
  emptyIcon: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: C.cardBg,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  emptyTitle: { fontSize: 18, fontFamily: F.bold, color: C.fg, marginBottom: 8, textAlign: 'center' },
  emptyText: { fontSize: 14, fontFamily: F.regular, color: C.secondary, textAlign: 'center', lineHeight: 20 },
  card: { position: 'absolute', width: CARD_W, height: 400, borderRadius: 24, overflow: 'hidden' },
  cardImage: { width: '100%', height: '100%' },
  energyBadge: { position: 'absolute', top: 16, left: 16, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  energyBadgeText: { color: C.white, fontSize: 12, fontFamily: F.semiBold },
  cardBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 24 },
  cardTitle: { color: C.white, fontSize: 20, fontFamily: F.bold, marginBottom: 8 },
  cardDesc: { color: 'rgba(255,255,255,0.8)', fontSize: 14, fontFamily: F.regular, lineHeight: 20, marginBottom: 12 },
  cardMeta: { flexDirection: 'row', gap: 16 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontFamily: F.medium },

  navRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 24, marginBottom: 20 },
  navBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: C.white, justifyContent: 'center', alignItems: 'center' },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.border },
  dotActive: { width: 24, backgroundColor: C.charcoal },

  chooseBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: C.charcoal, borderRadius: 999, paddingVertical: 15, marginBottom: 12,
    shadowColor: C.charcoal, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8,
  },
  chooseBtnDisabled: { backgroundColor: C.border },
  chooseBtnText: { color: C.white, fontSize: 15, fontFamily: F.semiBold },
  skipBtn: { alignItems: 'center', paddingVertical: 8 },
  skipText: { color: C.secondary, fontSize: 14, fontFamily: F.medium },
});
