import { useState, useRef } from 'react';
import { View, Text, Pressable, Image, Animated, PanResponder, Dimensions, Linking, StyleSheet } from 'react-native';
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
    case 'very low':
      return C.sage;
    case 'low':
      return C.sageLight;
    case 'moderate':
      return '#b8a06a';
  }
}

export default function SuggestionsScreen() {
  const router = useRouter();
  const { suggestions, updateSuggestionOutcome } = useTripStore();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [chosenId, setChosenId] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);

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
    setChosenId(placeId);
    await updateSuggestionOutcome({
      agent_outcome: 'rerouted',
      selected_place_id: placeId,
      selected_place_name: placeName,
    });
    setShowToast(true);
    setTimeout(() => router.replace('/(tabs)'), 1800);
  };

  const current = suggestions[currentIndex];

  return (
    <SafeAreaView style={s.safe}>
      {showToast && (
        <View style={s.toast}>
          <Feather name="check-circle" size={18} color={C.white} />
          <Text style={s.toastText}>Plan updated</Text>
        </View>
      )}

      <View style={s.container}>
        <View style={s.header}>
          <Pressable onPress={() => router.back()} style={s.backBtn}>
            <Feather name="chevron-left" size={18} color={C.fg} />
          </Pressable>
          <View>
            <Text style={s.headerTitle}>Gentler alternatives</Text>
            <Text style={s.headerSub}>Swipe to browse</Text>
          </View>
        </View>

        {suggestions.length === 0 ? (
          <View style={s.emptyState}>
            <View style={s.emptyIcon}>
              <Feather name="map" size={24} color={C.placeholder} />
            </View>
            <Text style={s.emptyTitle}>No nearby alternatives yet</Text>
            <Text style={s.emptyText}>
              The AI classifier ran, but nearby place search still needs Task 3 before we can show real options here.
            </Text>
          </View>
        ) : (
          <View style={s.cardStack} {...panResponder.panHandlers}>
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
                : {
                    transform: [{ scale }, { translateY }],
                  };

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
          </View>
        )}

        {suggestions.length > 0 ? (
          <View style={s.navRow}>
            <Pressable style={s.navBtn} onPress={goPrev}>
              <Feather name="chevron-left" size={20} color={C.fg} />
            </Pressable>
            <View style={s.dots}>
              {suggestions.map((_, idx) => (
                <Pressable key={idx} onPress={() => setCurrentIndex(idx)}>
                  <View style={[s.dot, idx === currentIndex && s.dotActive]} />
                </Pressable>
              ))}
            </View>
            <Pressable style={s.navBtn} onPress={goNext}>
              <Feather name="chevron-right" size={20} color={C.fg} />
            </Pressable>
          </View>
        ) : null}

        {current ? (
          <Pressable
            style={[s.chooseBtn, chosenId && chosenId !== current.place_id && s.chooseBtnDisabled]}
            onPress={() => handleChoose(current.place_id, current.place_name)}
            disabled={!!chosenId}
          >
            <Text style={s.chooseBtnText}>{chosenId === current.place_id ? 'Chosen' : 'Choose this'}</Text>
          </Pressable>
        ) : null}

        <Pressable
          onPress={async () => {
            await updateSuggestionOutcome({ agent_outcome: 'dismissed' });
            router.replace('/(tabs)');
          }}
          style={s.skipBtn}
        >
          <Text style={s.skipText}>Skip — keep my current plan</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  toast: {
    position: 'absolute',
    top: 60,
    left: '50%',
    marginLeft: -80,
    zIndex: 100,
    backgroundColor: C.eHighText,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  toastText: { color: C.white, fontFamily: F.semiBold, fontSize: 14 },
  container: { flex: 1, paddingHorizontal: 20, paddingTop: 8 },

  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.white, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontFamily: F.bold, color: C.fg },
  headerSub: { fontSize: 12, fontFamily: F.regular, color: C.placeholder },

  cardStack: { height: 420, marginBottom: 16 },
  emptyState: {
    height: 320,
    backgroundColor: C.white,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    marginBottom: 16,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: C.cardBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
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

  chooseBtn: { backgroundColor: C.charcoal, borderRadius: 999, paddingVertical: 14, alignItems: 'center', marginBottom: 12 },
  chooseBtnDisabled: { backgroundColor: C.border },
  chooseBtnText: { color: C.white, fontSize: 14, fontFamily: F.semiBold },
  skipBtn: { alignItems: 'center', paddingVertical: 8 },
  skipText: { color: C.secondary, fontSize: 14, fontFamily: F.medium },
});
