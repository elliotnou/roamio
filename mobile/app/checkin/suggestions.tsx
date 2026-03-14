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
    case 'very low': return C.sage;
    case 'low': return C.sageLight;
    case 'moderate': return '#b8a06a';
  }
}

export default function SuggestionsScreen() {
  const router = useRouter();
  const { suggestions } = useTripStore();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [chosenId, setChosenId] = useState<string | null>(null);
  const [placing, setPlacing] = useState(false);

  const pan = useRef(new Animated.ValueXY()).current;

  // Placement animation values
  const placeScale = useRef(new Animated.Value(1)).current;
  const placeOpacity = useRef(new Animated.Value(1)).current;
  const placeY = useRef(new Animated.Value(0)).current;
  const checkScale = useRef(new Animated.Value(0)).current;
  const checkOpacity = useRef(new Animated.Value(0)).current;
  const toastOpacity = useRef(new Animated.Value(0)).current;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 10,
      onPanResponderMove: Animated.event([null, { dx: pan.x }], { useNativeDriver: false }),
      onPanResponderRelease: (_, g) => {
        if (g.dx > SWIPE_THRESHOLD) goPrev();
        else if (g.dx < -SWIPE_THRESHOLD) goNext();
        Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: false }).start();
      },
    })
  ).current;

  const goNext = () => setCurrentIndex((p) => (p + 1) % suggestions.length);
  const goPrev = () => setCurrentIndex((p) => (p - 1 + suggestions.length) % suggestions.length);

  const handleChoose = (placeId: string) => {
    if (placing) return;
    setChosenId(placeId);
    setPlacing(true);

    // Step 1: Card pulses up slightly
    Animated.sequence([
      Animated.spring(placeScale, { toValue: 1.04, useNativeDriver: true, speed: 20 }),
      // Step 2: Card shrinks and flies up (placed into schedule)
      Animated.parallel([
        Animated.timing(placeScale, { toValue: 0.7, duration: 350, useNativeDriver: true }),
        Animated.timing(placeOpacity, { toValue: 0, duration: 350, useNativeDriver: true }),
        Animated.timing(placeY, { toValue: -120, duration: 350, useNativeDriver: true }),
      ]),
    ]).start();

    // Step 3: Show checkmark burst
    setTimeout(() => {
      Animated.parallel([
        Animated.spring(checkScale, { toValue: 1, useNativeDriver: true, speed: 10 }),
        Animated.timing(checkOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    }, 200);

    // Step 4: Fade in toast
    setTimeout(() => {
      Animated.timing(toastOpacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    }, 300);

    // Navigate after animation completes
    setTimeout(() => router.replace('/(tabs)'), 1600);
  };

  const current = suggestions[currentIndex];

  return (
    <SafeAreaView style={s.safe}>

      {/* Toast */}
      <Animated.View style={[s.toast, { opacity: toastOpacity }]}>
        <Feather name="check-circle" size={18} color={C.white} />
        <Text style={s.toastText}>Added to your plan</Text>
      </Animated.View>

      {/* Placement checkmark burst */}
      <Animated.View style={[
        s.checkBurst,
        { opacity: checkOpacity, transform: [{ scale: checkScale }] }
      ]}>
        <View style={s.checkCircleOuter}>
          <View style={s.checkCircleInner}>
            <Feather name="check" size={32} color={C.white} />
          </View>
        </View>
        <Text style={s.checkBurstText}>Placed in your itinerary</Text>
      </Animated.View>

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

        <Animated.View
          style={[
            s.cardStack,
            placing && {
              transform: [{ scale: placeScale }, { translateY: placeY }],
              opacity: placeOpacity,
            }
          ]}
          {...panResponder.panHandlers}
        >
          {suggestions.map((suggestion, idx) => {
            const offset = ((idx - currentIndex) + suggestions.length) % suggestions.length;
            if (offset > 2) return null;

            const scale = 1 - offset * 0.04;
            const translateY = offset * 10;
            const isTop = offset === 0;

            const animatedStyle = isTop ? {
              transform: [
                { translateX: pan.x },
                { scale },
                { translateY },
                { rotate: pan.x.interpolate({ inputRange: [-200, 0, 200], outputRange: ['-5deg', '0deg', '5deg'] }) },
              ],
            } : {
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
                    {suggestion.maps_url && (
                      <Pressable style={s.metaItem} onPress={() => Linking.openURL(suggestion.maps_url)}>
                        <Feather name="external-link" size={12} color="rgba(255,255,255,0.7)" />
                        <Text style={s.metaText}>Maps</Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              </Animated.View>
            );
          })}
        </Animated.View>

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

        <Pressable
          style={[s.chooseBtn, (!!chosenId && chosenId !== current?.place_id) && s.chooseBtnDisabled]}
          onPress={() => current && handleChoose(current.place_id)}
          disabled={!!chosenId}
        >
          <Feather
            name={chosenId === current?.place_id ? 'check' : 'plus-circle'}
            size={18}
            color={C.white}
          />
          <Text style={s.chooseBtnText}>
            {chosenId === current?.place_id ? 'Added to plan!' : 'Add to my plan'}
          </Text>
        </Pressable>

        <Pressable onPress={() => router.replace('/(tabs)')} style={s.skipBtn} disabled={placing}>
          <Text style={s.skipText}>Skip — keep my current plan</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },

  toast: {
    position: 'absolute', top: 60, alignSelf: 'center', zIndex: 200,
    backgroundColor: C.eHighText, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 999,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8,
  },
  toastText: { color: C.white, fontFamily: F.semiBold, fontSize: 14 },

  checkBurst: {
    position: 'absolute', top: 0, bottom: 0, left: 0, right: 0,
    justifyContent: 'center', alignItems: 'center', zIndex: 100,
    pointerEvents: 'none',
  } as any,
  checkCircleOuter: {
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: C.sage + '20', justifyContent: 'center', alignItems: 'center', marginBottom: 20,
  },
  checkCircleInner: {
    width: 84, height: 84, borderRadius: 42,
    backgroundColor: C.sage, justifyContent: 'center', alignItems: 'center',
  },
  checkBurstText: { fontSize: 16, fontFamily: F.semiBold, color: C.fg, textAlign: 'center' },

  container: { flex: 1, paddingHorizontal: 20, paddingTop: 8 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.white, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontFamily: F.bold, color: C.fg },
  headerSub: { fontSize: 12, fontFamily: F.regular, color: C.placeholder },

  cardStack: { height: 420, marginBottom: 16 },
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
