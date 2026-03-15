import { useState, useEffect } from 'react';
import {
  View, Text, Pressable, ScrollView, StyleSheet,
  ActivityIndicator, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTripStore, type CompactifyItem } from '../../store/trip-store';
import { C } from '../../lib/colors';
import { F } from '../../lib/fonts';

function fmtTime(s: string): string {
  if (!s) return '';
  const m = s.match(/(\d{1,2}):(\d{2})/);
  if (!m) return s;
  const h = Number(m[1]);
  const min = Number(m[2]);
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${String(min).padStart(2, '0')} ${ampm}`;
}

export default function CompactifyScreen() {
  const router = useRouter();
  const { tripId, dayIndex } = useLocalSearchParams<{ tripId: string; dayIndex: string }>();
  const { compactifyDay, deleteActivityBlock } = useTripStore();

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<CompactifyItem[]>([]);
  const [summary, setSummary] = useState('');
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await compactifyDay(tripId, Number(dayIndex ?? 0));
      if (cancelled) return;
      if (result) {
        setItems(result.items);
        setSummary(result.summary);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [tripId, dayIndex]);

  const keepItems = items.filter((i) => i.action === 'keep');
  const dropItems = items.filter((i) => i.action === 'drop');

  const handleApply = async () => {
    setApplying(true);
    for (const item of dropItems) {
      await deleteActivityBlock(item.id, tripId);
    }
    setApplying(false);
    setApplied(true);
  };

  if (loading) {
    return (
      <View style={s.loadingWrap}>
        <LinearGradient colors={[C.sage, C.sageDark]} style={StyleSheet.absoluteFillObject} />
        <LinearGradient colors={['rgba(0,0,0,0.1)', 'rgba(0,0,0,0.5)']} style={StyleSheet.absoluteFillObject} />
        <View style={s.loadingContent}>
          <Text style={s.loadingSparkle}>✦</Text>
          <Text style={s.loadingTitle}>Simplifying your day</Text>
          <Text style={s.loadingSub}>Roamio AI is figuring out what matters most...</Text>
          <ActivityIndicator color={C.white} style={{ marginTop: 24 }} />
        </View>
      </View>
    );
  }

  if (applied) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.appliedWrap}>
          <View style={s.appliedCircle}>
            <Feather name="check" size={32} color={C.white} />
          </View>
          <Text style={s.appliedTitle}>Day simplified</Text>
          <Text style={s.appliedSub}>
            {dropItems.length} activit{dropItems.length === 1 ? 'y' : 'ies'} removed. Breathe easy.
          </Text>
          <Pressable style={s.doneBtn} onPress={() => router.replace('/(tabs)' as never)}>
            <Text style={s.doneBtnText}>Back to today</Text>
            <Feather name="arrow-right" size={16} color={C.white} />
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={s.topBar}>
          <Pressable onPress={() => router.back()} style={s.closeBtn}>
            <Feather name="x" size={20} color={C.secondary} />
          </Pressable>
        </View>

        <Text style={s.title}>Simplified Day</Text>

        {/* Gemini summary */}
        <View style={s.summaryCard}>
          <Text style={s.summarySparkle}>✦</Text>
          <Text style={s.summaryText}>{summary}</Text>
        </View>

        {/* Keeping */}
        <Text style={s.sectionLabel}>KEEPING ({keepItems.length})</Text>
        {keepItems.map((item) => (
          <View key={item.id} style={s.itemCard}>
            <View style={s.itemLeft}>
              <View style={s.keepDot} />
              <View style={{ flex: 1 }}>
                <Text style={s.itemName}>{item.place_name}</Text>
                <Text style={s.itemTime}>
                  {fmtTime(item.start_time)}
                  {item.end_time ? ` → ${fmtTime(item.end_time)}` : ''}
                </Text>
              </View>
            </View>
            <Text style={s.itemReason}>{item.reason}</Text>
          </View>
        ))}

        {/* Dropping */}
        {dropItems.length > 0 && (
          <>
            <Text style={[s.sectionLabel, { marginTop: 24 }]}>DROPPING ({dropItems.length})</Text>
            {dropItems.map((item) => (
              <View key={item.id} style={[s.itemCard, s.itemCardDrop]}>
                <View style={s.itemLeft}>
                  <View style={s.dropDot} />
                  <View style={{ flex: 1 }}>
                    <Text style={[s.itemName, s.itemNameDrop]}>{item.place_name}</Text>
                    <Text style={s.itemTime}>
                      {fmtTime(item.start_time)}
                      {item.end_time ? ` → ${fmtTime(item.end_time)}` : ''}
                    </Text>
                  </View>
                </View>
                <Text style={s.itemReason}>{item.reason}</Text>
              </View>
            ))}
          </>
        )}

        {/* Actions */}
        <Pressable
          style={[s.applyBtn, applying && { opacity: 0.6 }]}
          onPress={handleApply}
          disabled={applying}
        >
          {applying ? (
            <ActivityIndicator size="small" color={C.white} />
          ) : (
            <Feather name="zap" size={16} color={C.white} />
          )}
          <Text style={s.applyBtnText}>
            {applying ? 'Simplifying...' : `Apply — drop ${dropItems.length} activit${dropItems.length === 1 ? 'y' : 'ies'}`}
          </Text>
        </Pressable>

        <Pressable style={s.cancelBtn} onPress={() => router.back()}>
          <Text style={s.cancelText}>Never mind, keep everything</Text>
        </Pressable>

      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  scroll: { paddingHorizontal: 20, paddingBottom: 48 },

  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', minHeight: Dimensions.get('window').height },
  loadingContent: { alignItems: 'center', paddingHorizontal: 40 },
  loadingSparkle: { fontSize: 48, color: C.white, marginBottom: 20 },
  loadingTitle: { fontSize: 22, fontFamily: F.bold, color: C.white, textAlign: 'center', marginBottom: 10 },
  loadingSub: { fontSize: 15, fontFamily: F.regular, color: 'rgba(255,255,255,0.75)', textAlign: 'center' },

  topBar: { paddingTop: 8, paddingBottom: 4, alignItems: 'flex-end' },
  closeBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.white, justifyContent: 'center', alignItems: 'center' },

  title: { fontSize: 26, fontFamily: F.bold, color: C.fg, marginBottom: 16 },

  summaryCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: C.white, borderRadius: 16, padding: 16, marginBottom: 24,
    borderLeftWidth: 3, borderLeftColor: C.sage,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8,
  },
  summarySparkle: { fontSize: 18, color: C.sage },
  summaryText: { flex: 1, fontSize: 14, fontFamily: F.medium, color: C.secondary, lineHeight: 21, fontStyle: 'italic' },

  sectionLabel: { fontSize: 10, fontFamily: F.bold, color: C.placeholder, letterSpacing: 1.5, marginBottom: 10 },

  itemCard: {
    backgroundColor: C.white, borderRadius: 16, padding: 14, marginBottom: 10,
    borderLeftWidth: 3, borderLeftColor: C.sage,
  },
  itemCardDrop: { borderLeftColor: '#c47a6e', opacity: 0.75 },
  itemLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  keepDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.sage },
  dropDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#c47a6e' },
  itemName: { fontSize: 15, fontFamily: F.bold, color: C.fg },
  itemNameDrop: { textDecorationLine: 'line-through', color: C.secondary },
  itemTime: { fontSize: 12, fontFamily: F.medium, color: C.placeholder, marginTop: 2 },
  itemReason: { fontSize: 12, fontFamily: F.regular, color: C.secondary, lineHeight: 17, marginLeft: 18 },

  applyBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: C.charcoal, borderRadius: 999, paddingVertical: 16, marginTop: 28,
  },
  applyBtnText: { color: C.white, fontSize: 15, fontFamily: F.semiBold },

  cancelBtn: { alignItems: 'center', paddingVertical: 14 },
  cancelText: { fontSize: 14, fontFamily: F.medium, color: C.placeholder },

  appliedWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  appliedCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: C.sage, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  appliedTitle: { fontSize: 24, fontFamily: F.bold, color: C.fg, marginBottom: 8 },
  appliedSub: { fontSize: 15, fontFamily: F.regular, color: C.secondary, textAlign: 'center', marginBottom: 32 },
  doneBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: C.charcoal, borderRadius: 999, paddingVertical: 14, paddingHorizontal: 28,
  },
  doneBtnText: { color: C.white, fontSize: 15, fontFamily: F.semiBold },
});
