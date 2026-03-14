import { View, Text, ScrollView, Image, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTripStore } from '../../store/trip-store';
import { formatDate } from '../../lib/utils';
import { C } from '../../lib/colors';
import { F } from '../../lib/fonts';

export default function TripsScreen() {
  const router = useRouter();
  const { trips, setActiveTrip } = useTripStore();
  return (
    <SafeAreaView style={s.safe}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <View style={s.header}>
          <Text style={s.title}>My Trips</Text>
          <Pressable style={s.addBtn} onPress={() => router.push('/trips/new' as never)}>
            <Feather name="plus" size={20} color={C.white} />
          </Pressable>
        </View>
        {trips.length === 0 ? (
          <View style={s.empty}>
            <Text style={s.emptyTitle}>No trips yet</Text>
            <Text style={s.emptySub}>Start by creating your first wellness travel plan</Text>
          </View>
        ) : (
          <View style={s.list}>
            {trips.map((trip) => (
              <Pressable key={trip.id} onPress={() => { setActiveTrip(trip); router.push(`/trips/${trip.id}` as never); }}>
                <View style={s.card}>
                  {trip.destination_image ? <Image source={{ uri: trip.destination_image }} style={s.cardImg} /> : <View style={[s.cardImg, { backgroundColor: C.sage }]} />}
                  <LinearGradient colors={['transparent', 'rgba(0,0,0,0.1)', 'rgba(0,0,0,0.6)']} style={StyleSheet.absoluteFill} />
                  <Pressable style={s.heart}><Feather name="heart" size={18} color={C.white} /></Pressable>
                  <View style={s.cardBottom}>
                    <Text style={s.cardTitle}>{trip.destination}</Text>
                    <Text style={s.cardDates}>{formatDate(trip.start_date)} – {formatDate(trip.end_date)}</Text>
                  </View>
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 110 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  title: { fontSize: 26, fontFamily: F.bold, color: C.fg },
  addBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.charcoal, justifyContent: 'center', alignItems: 'center' },
  list: { gap: 20 },
  card: { width: '100%', height: 200, borderRadius: 24, overflow: 'hidden' },
  cardImg: { width: '100%', height: '100%' },
  heart: { position: 'absolute', top: 16, right: 16, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  cardBottom: { position: 'absolute', bottom: 16, left: 20, right: 20 },
  cardTitle: { color: C.white, fontSize: 18, fontFamily: F.bold },
  cardDates: { color: 'rgba(255,255,255,0.7)', fontSize: 14, fontFamily: F.regular, marginTop: 4 },
  empty: { backgroundColor: C.white, borderRadius: 24, padding: 40, alignItems: 'center' },
  emptyTitle: { fontSize: 18, fontFamily: F.bold, color: C.fg, marginBottom: 8 },
  emptySub: { fontSize: 14, fontFamily: F.regular, color: C.secondary, textAlign: 'center' },
});
