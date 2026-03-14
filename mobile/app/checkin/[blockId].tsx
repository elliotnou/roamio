import { useState, useEffect, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Dimensions, PanResponder, Animated, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTripStore } from '../../store/trip-store';
import { C } from '../../lib/colors';
import { F } from '../../lib/fonts';
import type { ActivityBlock } from '../../types';

const SLIDER_W = Dimensions.get('window').width - 80;

// Colour stops at 1/10 through 10/10
const ENERGY_COLORS = ['#c47a6e', '#c47a6e', '#c47a6e', '#b8a06a', '#b8a06a', '#a8b89a', '#a8b89a', C.sage, C.sage, C.sage];

function getEnergyColor(level: number): string {
  return ENERGY_COLORS[Math.max(0, Math.min(9, level - 1))];
}

function getEnergyLabel(level: number): string {
  if (level <= 2) return 'Very Low';
  if (level <= 4) return 'Low';
  if (level <= 6) return 'Moderate';
  if (level <= 8) return 'Good';
  return 'Energized';
}

function getEnergyIcon(level: number): React.ComponentProps<typeof Feather>['name'] {
  if (level <= 3) return 'moon';
  if (level <= 5) return 'cloud';
  if (level <= 7) return 'sun';
  return 'zap';
}

function formatBlockTime(timeStr: string): string {
  try {
    const d = new Date(timeStr);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  } catch {
    return '';
  }
}

export default function CheckInScreen() {
  const router = useRouter();
  const { blockId } = useLocalSearchParams<{ blockId: string }>();
  const { activityBlocks, submitCheckIn, user } = useTripStore();

  // energyLevel drives labels / icons (updated on every drag frame via listener)
  const [energyLevel, setEnergyLevel] = useState(5);
  const [step, setStep] = useState<'slider' | 'next' | 'done'>('slider');
  const [nextBlock, setNextBlock] = useState<ActivityBlock | null>(null);
  const [submitError, setSubmitError] = useState('');

  // Single animated value: 0 → SLIDER_W
  const posAnim = useRef(new Animated.Value((5 / 10) * SLIDER_W)).current;

  // Derived animated values (all run on the native thread via interpolate)
  const fillWidth = posAnim; // width IS posAnim

  const thumbBorderColor = posAnim.interpolate({
    inputRange: [0, SLIDER_W * 0.3, SLIDER_W * 0.5, SLIDER_W * 0.8, SLIDER_W],
    outputRange: ['#c47a6e', '#c47a6e', '#b8a06a', '#a8b89a', C.sage],
    extrapolate: 'clamp',
  });

  const fillColor = posAnim.interpolate({
    inputRange: [0, SLIDER_W * 0.3, SLIDER_W * 0.5, SLIDER_W * 0.8, SLIDER_W],
    outputRange: ['#c47a6e', '#c47a6e', '#b8a06a', '#a8b89a', C.sage],
    extrapolate: 'clamp',
  });

  // Keep a ref for the current level (used inside panResponder without stale closures)
  const levelRef = useRef(5);

  // Listen to posAnim changes to update JS-side state (labels, icons)
  useEffect(() => {
    const id = posAnim.addListener(({ value }) => {
      const level = Math.max(1, Math.min(10, Math.round((value / SLIDER_W) * 10)));
      if (level !== levelRef.current) {
        levelRef.current = level;
        setEnergyLevel(level);
      }
    });
    return () => posAnim.removeListener(id);
  }, [posAnim]);

  const fadeAnim = useRef(new Animated.Value(1)).current;

  const block = Object.values(activityBlocks).flat().find((b) => b.id === blockId);

  useEffect(() => {
    if (step === 'done') {
      const timer = setTimeout(() => router.replace('/(tabs)'), 2000);
      return () => clearTimeout(timer);
    }
  }, [step, router]);

  // PanResponder: update posAnim directly, no setState here
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const x = Math.max(0, Math.min(evt.nativeEvent.locationX, SLIDER_W));
        posAnim.setValue(x);
      },
      onPanResponderMove: (evt) => {
        const x = Math.max(0, Math.min(evt.nativeEvent.locationX, SLIDER_W));
        posAnim.setValue(x);
      },
      onPanResponderRelease: () => {
        // snap thumb to nearest whole level for clean resting position
        const snapped = (levelRef.current / 10) * SLIDER_W;
        Animated.spring(posAnim, {
          toValue: snapped,
          useNativeDriver: false,
          speed: 40,
          bounciness: 6,
        }).start();
      },
    })
  ).current;

  const transitionStep = (nextStep: 'slider' | 'next' | 'done') => {
    Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => {
      setStep(nextStep);
      Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }).start();
    });
  };

  const handleSubmit = async () => {
    setSubmitError('');

    if (!block) {
      setSubmitError('Could not find this activity block.');
      return;
    }

    const saved = await submitCheckIn({
      activity_block_id: block.id,
      user_id: user?.id || '',
      energy_level: levelRef.current,
      current_lat: block.resolved_lat ?? 51.1784,
      current_lng: block.resolved_lng ?? -115.5708,
      agent_outcome: levelRef.current <= 4 ? 'rerouted' : 'affirmed',
      selected_place_id: null,
      selected_place_name: null,
    });

    if (!saved) {
      setSubmitError('Could not save your check-in. Please try again.');
      return;
    }

    const allBlocks = Object.values(activityBlocks).flat();
    const sorted = [...allBlocks].sort((a, b) => a.start_time.localeCompare(b.start_time));
    const idx = sorted.findIndex(b => b.id === blockId);
    setNextBlock(idx >= 0 && idx < sorted.length - 1 ? sorted[idx + 1] : null);
    transitionStep('next');
  };

  const color = getEnergyColor(energyLevel);
  const isFatigued = energyLevel <= 4;

  return (
    // ScrollView with scrollEnabled=false absorbs vertical gestures so the
    // tab bar navigator never sees them — prevents tab hide/show on drag
    <SafeAreaView style={s.safe}>
      <ScrollView
        scrollEnabled={false}
        contentContainerStyle={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
      >
      <View style={s.topBar}>
        <Pressable onPress={() => router.back()} style={s.closeBtn}>
          <Feather name="x" size={20} color={C.secondary} />
        </Pressable>
        <View style={s.stepDots}>
          {(['slider', 'next', 'done'] as const).map((st) => (
            <View
              key={st}
              style={[
                s.stepDot,
                step === st && s.stepDotActive,
                ['slider', 'next', 'done'].indexOf(st) < ['slider', 'next', 'done'].indexOf(step) && s.stepDotPast,
              ]}
            />
          ))}
        </View>
        <View style={{ width: 40 }} />
      </View>

      <Animated.View style={[s.center, { opacity: fadeAnim }]}>

        {/* ── STEP 1: Slider ── */}
        {step === 'slider' && (
          <>
            <View style={s.activityCard}>
              <Text style={s.activityLabel}>CHECKING IN</Text>
              <Text style={s.activityName}>{block?.place_name ?? 'Your Activity'}</Text>
            </View>

            <Text style={s.question}>How's your energy right now?</Text>

            {/* Energy pill — updates live as you drag */}
            <View style={[s.energyIndicator, { backgroundColor: color + '15' }]}>
              <Feather name={getEnergyIcon(energyLevel)} size={24} color={color} />
              <Text style={[s.energyLabel2, { color }]}>{getEnergyLabel(energyLevel)}</Text>
              <Text style={[s.energyNum, { color }]}>{energyLevel}</Text>
            </View>

            {/* Slider track */}
            <View style={s.sliderWrap}>
              <View style={s.sliderTrack} {...panResponder.panHandlers}>
                {/* Fill bar — driven by Animated.Value directly, no state */}
                <Animated.View
                  style={[s.sliderFill, { width: fillWidth, backgroundColor: fillColor }]}
                  pointerEvents="none"
                />
                {/* Thumb — translate by posAnim */}
                <Animated.View
                  style={[
                    s.sliderThumb,
                    {
                      transform: [{ translateX: Animated.add(posAnim, new Animated.Value(-14)) }],
                      borderColor: thumbBorderColor,
                    },
                  ]}
                  pointerEvents="none"
                />
              </View>
              <View style={s.sliderLabels}>
                <Text style={s.sliderLabelText}>Low energy</Text>
                <Text style={s.sliderLabelText}>High energy</Text>
              </View>
            </View>

            <Pressable style={[s.submitBtn, { backgroundColor: color }]} onPress={handleSubmit}>
              <Feather name="check-circle" size={16} color={C.white} />
              <Text style={s.submitBtnText}>Confirm energy level</Text>
            </Pressable>

            {submitError ? <Text style={s.submitError}>{submitError}</Text> : null}

            <Pressable onPress={() => router.back()} style={s.cancelBtn}>
              <Text style={s.cancelText}>Not now</Text>
            </Pressable>
          </>
        )}

        {/* ── STEP 2: Next activity ── */}
        {step === 'next' && (
          <>
            <View style={[s.energyReadingPill, { backgroundColor: color + '18', borderColor: color + '40' }]}>
              <Feather name={getEnergyIcon(energyLevel)} size={16} color={color} />
              <Text style={[s.energyReadingText, { color }]}>
                {getEnergyLabel(energyLevel)} energy · {energyLevel}/10
              </Text>
            </View>

            {nextBlock ? (
              <>
                <Text style={s.nextLabel}>{isFatigued ? 'You seem a bit tired.' : "You're all set!"}</Text>
                <Text style={s.nextSub}>
                  {isFatigued ? 'Your next activity might feel like a stretch.' : 'Your next activity is ready.'}
                </Text>

                <View style={[s.nextCard, { borderLeftColor: color }]}>
                  <Text style={s.nextCardLabel}>NEXT UP</Text>
                  <Text style={s.nextCardName}>{nextBlock.place_name}</Text>
                  {nextBlock.start_time && (
                    <View style={s.nextCardMeta}>
                      <Feather name="clock" size={12} color={C.placeholder} />
                      <Text style={s.nextCardTime}>{formatBlockTime(nextBlock.start_time)}</Text>
                    </View>
                  )}
                </View>

                <Text style={s.nudge}>
                  {isFatigued ? 'Want to swap it for something gentler?' : 'Want to explore other options anyway?'}
                </Text>

                <Pressable
                  style={[s.exploreBtn, { borderColor: color, backgroundColor: color + '10' }]}
                  onPress={() => router.replace(`/checkin/suggestions?blockId=${blockId}` as never)}
                >
                  <Feather name="shuffle" size={16} color={color} />
                  <Text style={[s.exploreBtnText, { color }]}>
                    {isFatigued ? 'Show me gentler alternatives' : 'Explore alternative activities'}
                  </Text>
                </Pressable>

                <Pressable style={[s.proceedBtn, { backgroundColor: color }]} onPress={() => transitionStep('done')}>
                  <Text style={s.proceedBtnText}>{isFatigued ? "I'll push through" : "Let's go!"}</Text>
                  <Feather name="arrow-right" size={16} color={C.white} />
                </Pressable>
              </>
            ) : (
              <>
                <Text style={s.nextLabel}>{isFatigued ? 'You seem a bit tired.' : "You're all set!"}</Text>
                <Text style={s.nextSub}>That was your last activity for now.</Text>
                <View style={[s.energyIndicator, { backgroundColor: color + '15', marginVertical: 24 }]}>
                  <Feather name={getEnergyIcon(energyLevel)} size={24} color={color} />
                  <Text style={[s.energyLabel2, { color }]}>{getEnergyLabel(energyLevel)} energy</Text>
                </View>
                <Pressable style={[s.proceedBtn, { backgroundColor: color }]} onPress={() => transitionStep('done')}>
                  <Text style={s.proceedBtnText}>Back to dashboard</Text>
                  <Feather name="arrow-right" size={16} color={C.white} />
                </Pressable>
              </>
            )}
          </>
        )}

        {/* ── STEP 3: Done ── */}
        {step === 'done' && (
          <View style={s.successWrap}>
            <View style={[s.successIcon, { backgroundColor: color }]}>
              <Feather name="check" size={32} color={C.white} />
            </View>
            <Text style={s.successTitle}>You're all set</Text>
            <Text style={s.successSub}>Enjoy {block?.place_name ?? 'your activity'}</Text>
          </View>
        )}

      </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.white },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 8 },
  closeBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.bg, justifyContent: 'center', alignItems: 'center' },
  stepDots: { flexDirection: 'row', gap: 6 },
  stepDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.border },
  stepDotActive: { width: 20, backgroundColor: C.charcoal },
  stepDotPast: { backgroundColor: C.sage },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40, minHeight: Dimensions.get('window').height - 120 },

  activityCard: { width: '100%', backgroundColor: C.bg, borderRadius: 16, paddingHorizontal: 20, paddingVertical: 16, alignItems: 'center', marginBottom: 32 },
  activityLabel: { fontSize: 10, fontFamily: F.semiBold, color: C.placeholder, letterSpacing: 1.5, marginBottom: 6 },
  activityName: { fontSize: 18, fontFamily: F.bold, color: C.fg, textAlign: 'center' },

  question: { fontSize: 16, fontFamily: F.medium, color: C.secondary, marginBottom: 28 },

  energyIndicator: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 999, marginBottom: 32 },
  energyLabel2: { fontSize: 16, fontFamily: F.semiBold },
  energyNum: { fontSize: 16, fontFamily: F.bold, marginLeft: 2 },

  sliderWrap: { width: SLIDER_W, marginBottom: 40 },
  sliderTrack: {
    height: 10, backgroundColor: C.cardBg, borderRadius: 5,
    position: 'relative', overflow: 'visible',
  },
  sliderFill: { position: 'absolute', left: 0, top: 0, height: 10, borderRadius: 5 },
  sliderThumb: {
    position: 'absolute', top: -11, width: 32, height: 32, borderRadius: 16,
    backgroundColor: C.white, borderWidth: 3,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.18, shadowRadius: 6, elevation: 6,
  },
  sliderLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 },
  sliderLabelText: { fontSize: 12, fontFamily: F.medium, color: C.placeholder },

  submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, width: '100%', borderRadius: 999, paddingVertical: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8 },
  submitBtnText: { color: C.white, fontSize: 16, fontFamily: F.bold },

  cancelBtn: { marginTop: 16 },
  cancelText: { fontSize: 14, fontFamily: F.medium, color: C.placeholder },
  submitError: { marginTop: 12, color: C.eLowText, fontSize: 13, fontFamily: F.regular, textAlign: 'center' },

  energyReadingPill: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, borderWidth: 1, marginBottom: 28 },
  energyReadingText: { fontSize: 14, fontFamily: F.semiBold },

  nextLabel: { fontSize: 22, fontFamily: F.bold, color: C.fg, textAlign: 'center', marginBottom: 8 },
  nextSub: { fontSize: 15, fontFamily: F.regular, color: C.secondary, textAlign: 'center', marginBottom: 24 },

  nextCard: { width: '100%', backgroundColor: C.bg, borderRadius: 16, padding: 20, borderLeftWidth: 4, marginBottom: 20 },
  nextCardLabel: { fontSize: 10, fontFamily: F.bold, color: C.placeholder, letterSpacing: 1.5, marginBottom: 6 },
  nextCardName: { fontSize: 17, fontFamily: F.bold, color: C.fg, marginBottom: 8 },
  nextCardMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  nextCardTime: { fontSize: 13, fontFamily: F.medium, color: C.secondary },

  nudge: { fontSize: 14, fontFamily: F.regular, color: C.secondary, textAlign: 'center', marginBottom: 20 },

  exploreBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, width: '100%', borderRadius: 999, paddingVertical: 14, borderWidth: 1.5, marginBottom: 12 },
  exploreBtnText: { fontSize: 15, fontFamily: F.semiBold },

  proceedBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, width: '100%', borderRadius: 999, paddingVertical: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8 },
  proceedBtnText: { color: C.white, fontSize: 16, fontFamily: F.bold },

  successWrap: { alignItems: 'center' },
  successIcon: { width: 72, height: 72, borderRadius: 36, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  successTitle: { fontSize: 24, fontFamily: F.bold, color: C.fg, marginBottom: 8 },
  successSub: { fontSize: 16, fontFamily: F.regular, color: C.secondary },
});
