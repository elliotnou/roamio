import { useState, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTripStore } from '../../store/trip-store';
import { C } from '../../lib/colors';
import { F } from '../../lib/fonts';

const moods = [
  { key: 'energized', label: 'Energized', icon: 'zap' as const, color: C.sage, level: 8 },
  { key: 'balanced', label: 'Balanced', icon: 'sun' as const, color: '#b8a06a', level: 6 },
  { key: 'rest', label: 'Need Rest', icon: 'moon' as const, color: '#c47a6e', level: 3 },
];

export default function CheckInScreen() {
  const router = useRouter();
  const { blockId } = useLocalSearchParams<{ blockId: string }>();
  const { activityBlocks, submitCheckIn, user } = useTripStore();

  const [selected, setSelected] = useState<string | null>(null);
  const [affirmed, setAffirmed] = useState(false);

  const block = Object.values(activityBlocks).flat().find((b) => b.id === blockId);

  useEffect(() => {
    if (affirmed) {
      const timer = setTimeout(() => router.replace('/(tabs)'), 1800);
      return () => clearTimeout(timer);
    }
  }, [affirmed, router]);

  const handleSelect = (mood: typeof moods[number]) => {
    setSelected(mood.key);

    if (block) {
      submitCheckIn({
        id: `checkin-${Date.now()}`,
        activity_block_id: block.id,
        user_id: user.id,
        energy_level: mood.level,
        current_lat: block.resolved_lat ?? 51.1784,
        current_lng: block.resolved_lng ?? -115.5708,
        agent_outcome: mood.level <= 4 ? 'rerouted' : 'affirmed',
        selected_place_id: null,
        selected_place_name: null,
        timestamp: new Date().toISOString(),
      });
    }

    setTimeout(() => {
      if (mood.level <= 4) {
        router.replace(`/checkin/suggestions?blockId=${blockId}` as never);
      } else {
        setAffirmed(true);
      }
    }, 400);
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.topBar}>
        <Pressable onPress={() => router.back()} style={s.backBtn}>
          <Feather name="x" size={20} color={C.secondary} />
        </Pressable>
      </View>

      <View style={s.center}>
        {affirmed ? (
          <View style={s.affirmedWrap}>
            <View style={s.affirmedIcon}>
              <Feather name="check" size={32} color={C.white} />
            </View>
            <Text style={s.affirmedTitle}>You're all set</Text>
            <Text style={s.affirmedSub}>Enjoy {block?.place_name ?? 'your activity'}</Text>
          </View>
        ) : (
          <>
            <View style={s.activityCard}>
              <Text style={s.activityLabel}>CHECKING IN</Text>
              <Text style={s.activityName}>{block?.place_name ?? 'Your Activity'}</Text>
            </View>

            <Text style={s.question}>How are you feeling?</Text>

            <View style={s.moodRow}>
              {moods.map((mood) => (
                <Pressable
                  key={mood.key}
                  style={[s.moodCard, selected === mood.key && { borderColor: mood.color, borderWidth: 2 }]}
                  onPress={() => handleSelect(mood)}
                  disabled={!!selected}
                >
                  <View style={[s.moodIcon, { backgroundColor: mood.color + '18' }]}>
                    <Feather name={mood.icon} size={24} color={mood.color} />
                  </View>
                  <Text style={s.moodLabel}>{mood.label}</Text>
                </Pressable>
              ))}
            </View>

            <Pressable onPress={() => router.back()} style={s.cancelBtn}>
              <Text style={s.cancelText}>Not now</Text>
            </Pressable>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.white },
  topBar: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 20, paddingVertical: 8 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.bg, justifyContent: 'center', alignItems: 'center' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },

  activityCard: { width: '100%', backgroundColor: C.bg, borderRadius: 16, paddingHorizontal: 20, paddingVertical: 16, alignItems: 'center', marginBottom: 40 },
  activityLabel: { fontSize: 10, fontFamily: F.semiBold, color: C.placeholder, letterSpacing: 1.5, marginBottom: 6 },
  activityName: { fontSize: 20, fontFamily: F.bold, color: C.fg, textAlign: 'center' },

  question: { fontSize: 16, fontFamily: F.medium, color: C.secondary, marginBottom: 24 },

  moodRow: { flexDirection: 'row', gap: 12, width: '100%' },
  moodCard: {
    flex: 1, backgroundColor: C.bg, borderRadius: 20, paddingVertical: 24, alignItems: 'center', gap: 12,
    borderWidth: 2, borderColor: 'transparent',
  },
  moodIcon: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center' },
  moodLabel: { fontSize: 13, fontFamily: F.semiBold, color: C.fg },

  cancelBtn: { marginTop: 32 },
  cancelText: { fontSize: 14, fontFamily: F.medium, color: C.placeholder },

  affirmedWrap: { alignItems: 'center' },
  affirmedIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: C.sage, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  affirmedTitle: { fontSize: 24, fontFamily: F.bold, color: C.fg, marginBottom: 8 },
  affirmedSub: { fontSize: 16, fontFamily: F.regular, color: C.secondary },
});
