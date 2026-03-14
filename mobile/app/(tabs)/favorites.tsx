import { View, Text, ScrollView, StyleSheet, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useTripStore } from '../../store/trip-store';
import { C } from '../../lib/colors';
import { F } from '../../lib/fonts';

const CHART_W = Dimensions.get('window').width - 80;
const CHART_H = 160;

function EnergyChart({ dataPoints }: { dataPoints: { label: string; value: number }[] }) {
  if (dataPoints.length < 1) return null;

  const maxVal = 10;
  const stepX = dataPoints.length > 1 ? CHART_W / (dataPoints.length - 1) : CHART_W / 2;

  const points = dataPoints.map((d, i) => ({
    x: dataPoints.length === 1 ? CHART_W / 2 : i * stepX,
    y: CHART_H - (d.value / maxVal) * CHART_H,
    value: d.value,
    label: d.label,
  }));

  // Build SVG-like path using Views
  return (
    <View style={ch.container}>
      {/* Grid lines */}
      {[2, 4, 6, 8, 10].map((v) => (
        <View key={v} style={[ch.gridLine, { bottom: (v / maxVal) * CHART_H }]}>
          <Text style={ch.gridLabel}>{v}</Text>
        </View>
      ))}

      {/* Line segments */}
      {points.slice(0, -1).map((p, i) => {
        const next = points[i + 1];
        const dx = next.x - p.x;
        const dy = next.y - p.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx) * (180 / Math.PI);
        return (
          <View
            key={i}
            style={[
              ch.line,
              {
                width: len,
                left: p.x + 20,
                top: p.y,
                transform: [{ rotate: `${angle}deg` }],
              },
            ]}
          />
        );
      })}

      {/* Data points */}
      {points.map((p, i) => {
        const color = p.value <= 4 ? '#c47a6e' : p.value <= 6 ? '#b8a06a' : C.sage;
        return (
          <View key={i} style={[ch.pointWrap, { left: p.x + 20 - 14, top: p.y - 14 }]}>
            <View style={[ch.point, { backgroundColor: color }]} />
            <Text style={ch.pointValue}>{p.value}</Text>
          </View>
        );
      })}

      {/* X-axis labels */}
      {points.map((p, i) => (
        <Text key={i} style={[ch.xLabel, { left: p.x + 20 - 16, top: CHART_H + 8 }]}>{p.label}</Text>
      ))}
    </View>
  );
}

const ch = StyleSheet.create({
  container: { width: CHART_W + 40, height: CHART_H + 40, position: 'relative', marginLeft: -8 },
  gridLine: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: C.border, flexDirection: 'row' },
  gridLabel: { position: 'absolute', left: -4, top: -8, fontSize: 10, fontFamily: F.regular, color: C.placeholder },
  line: { position: 'absolute', height: 2.5, backgroundColor: C.sage, transformOrigin: 'left center', borderRadius: 1 },
  pointWrap: { position: 'absolute', width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  point: { width: 10, height: 10, borderRadius: 5, borderWidth: 2, borderColor: C.white },
  pointValue: { fontSize: 9, fontFamily: F.bold, color: C.secondary, marginTop: 1 },
  xLabel: { position: 'absolute', fontSize: 10, fontFamily: F.medium, color: C.placeholder, width: 32, textAlign: 'center' },
});

export default function InsightsScreen() {
  const { trips, checkIns, activityBlocks } = useTripStore();

  const totalActivities = Object.values(activityBlocks).flat().length;
  const totalCheckIns = checkIns.length;
  const avgEnergy = totalCheckIns > 0
    ? (checkIns.reduce((sum, c) => sum + c.energy_level, 0) / totalCheckIns).toFixed(1)
    : '—';
  const highEnergyCount = checkIns.filter(c => c.energy_level >= 7).length;
  const lowEnergyCount = checkIns.filter(c => c.energy_level <= 4).length;
  const reroutedCount = checkIns.filter(c => c.agent_outcome === 'rerouted').length;

  // Build chart data from check-ins ordered by timestamp
  const chartData = checkIns
    .slice()
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
    .map((c, i) => {
      const block = Object.values(activityBlocks).flat().find(b => b.id === c.activity_block_id);
      return {
        label: block ? block.place_name.split(' ')[0].slice(0, 5) : `#${i + 1}`,
        value: c.energy_level,
      };
    });

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <Text style={s.title}>Insights</Text>
        <Text style={s.subtitle}>Your wellness travel patterns</Text>

        <View style={s.statsGrid}>
          <View style={s.statCard}>
            <View style={[s.statIcon, { backgroundColor: C.sage + '20' }]}>
              <Feather name="map" size={20} color={C.sage} />
            </View>
            <Text style={s.statValue}>{trips.length}</Text>
            <Text style={s.statLabel}>Trips</Text>
          </View>
          <View style={s.statCard}>
            <View style={[s.statIcon, { backgroundColor: '#b8a06a20' }]}>
              <Feather name="calendar" size={20} color="#b8a06a" />
            </View>
            <Text style={s.statValue}>{totalActivities}</Text>
            <Text style={s.statLabel}>Activities</Text>
          </View>
          <View style={s.statCard}>
            <View style={[s.statIcon, { backgroundColor: C.sage + '20' }]}>
              <Feather name="check-circle" size={20} color={C.sage} />
            </View>
            <Text style={s.statValue}>{totalCheckIns}</Text>
            <Text style={s.statLabel}>Check-ins</Text>
          </View>
          <View style={s.statCard}>
            <View style={[s.statIcon, { backgroundColor: '#c47a6e20' }]}>
              <Feather name="activity" size={20} color="#c47a6e" />
            </View>
            <Text style={s.statValue}>{avgEnergy}</Text>
            <Text style={s.statLabel}>Avg Energy</Text>
          </View>
        </View>

        {/* Energy Trend Chart */}
        {chartData.length >= 1 && (
          <View style={s.chartSection}>
            <Text style={s.sectionTitle}>Energy Trend</Text>
            <View style={s.chartCard}>
              <EnergyChart dataPoints={chartData} />
            </View>
          </View>
        )}

        <Text style={s.sectionTitle}>Energy Breakdown</Text>
        <View style={s.breakdownCard}>
          <View style={s.breakdownRow}>
            <View style={[s.dot, { backgroundColor: C.sage }]} />
            <View style={s.breakdownContent}>
              <Text style={s.breakdownLabel}>High Energy</Text>
              <Text style={s.breakdownDesc}>Feeling great, fully engaged</Text>
            </View>
            <Text style={s.breakdownValue}>{highEnergyCount}</Text>
          </View>
          <View style={s.divider} />
          <View style={s.breakdownRow}>
            <View style={[s.dot, { backgroundColor: '#c47a6e' }]} />
            <View style={s.breakdownContent}>
              <Text style={s.breakdownLabel}>Low Energy</Text>
              <Text style={s.breakdownDesc}>Needed rest or gentler activities</Text>
            </View>
            <Text style={s.breakdownValue}>{lowEnergyCount}</Text>
          </View>
          <View style={s.divider} />
          <View style={s.breakdownRow}>
            <View style={[s.dot, { backgroundColor: '#b8a06a' }]} />
            <View style={s.breakdownContent}>
              <Text style={s.breakdownLabel}>AI Reroutes</Text>
              <Text style={s.breakdownDesc}>Plans adjusted by Roamio AI</Text>
            </View>
            <Text style={s.breakdownValue}>{reroutedCount}</Text>
          </View>
        </View>

        {totalCheckIns === 0 && (
          <View style={s.emptyCard}>
            <Feather name="activity" size={32} color={C.placeholder} />
            <Text style={s.emptyTitle}>No data yet</Text>
            <Text style={s.emptyDesc}>Check in during your activities to see your energy patterns and wellness insights here</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 110 },
  title: { fontSize: 32, fontFamily: F.bold, color: C.fg, letterSpacing: -0.5 },
  subtitle: { fontSize: 14, fontFamily: F.regular, color: C.secondary, marginTop: 4, marginBottom: 28 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 32 },
  statCard: {
    width: '47%', backgroundColor: C.white, borderRadius: 20, padding: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 12, elevation: 2,
  },
  statIcon: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  statValue: { fontSize: 28, fontFamily: F.bold, color: C.fg },
  statLabel: { fontSize: 13, fontFamily: F.medium, color: C.secondary, marginTop: 2 },
  chartSection: { marginBottom: 32 },
  sectionTitle: { fontSize: 18, fontFamily: F.bold, color: C.fg, marginBottom: 16 },
  chartCard: {
    backgroundColor: C.white, borderRadius: 20, padding: 24, paddingBottom: 32,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 12, elevation: 2,
  },
  breakdownCard: {
    backgroundColor: C.white, borderRadius: 20, padding: 20, marginBottom: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 12, elevation: 2,
  },
  breakdownRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 14 },
  breakdownContent: { flex: 1 },
  breakdownLabel: { fontSize: 15, fontFamily: F.semiBold, color: C.fg },
  breakdownDesc: { fontSize: 12, fontFamily: F.regular, color: C.placeholder, marginTop: 2 },
  breakdownValue: { fontSize: 20, fontFamily: F.bold, color: C.fg, marginLeft: 12 },
  divider: { height: 1, backgroundColor: C.border, marginVertical: 4 },
  emptyCard: { backgroundColor: C.white, borderRadius: 20, padding: 32, alignItems: 'center', gap: 8 },
  emptyTitle: { fontSize: 16, fontFamily: F.bold, color: C.fg },
  emptyDesc: { fontSize: 13, fontFamily: F.regular, color: C.secondary, textAlign: 'center', lineHeight: 20 },
});
