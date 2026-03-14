import { useEffect, useRef } from 'react';
import { View, Text, ScrollView, Image, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTripStore } from '../../store/trip-store';
import { formatDate } from '../../lib/utils';
import { fetchPlaceAutocomplete, fetchPlacePrimaryPhotoUrl } from '../../lib/places';
import { C } from '../../lib/colors';
import { F } from '../../lib/fonts';

export default function TripsScreen() {
  const router = useRouter();
  const inFlightRef = useRef<Set<string>>(new Set());
  const attemptedRef = useRef<Set<string>>(new Set());
  const { trips, setActiveTrip, setTripDestinationImage } = useTripStore();

  useEffect(() => {
    const missingImageTrips = trips.filter((trip) => !trip.destination_image && !attemptedRef.current.has(trip.id));

    missingImageTrips.forEach((trip) => {
      if (inFlightRef.current.has(trip.id)) {
        return;
      }

      attemptedRef.current.add(trip.id);
      inFlightRef.current.add(trip.id);

      (async () => {
        try {
          const matches = await fetchPlaceAutocomplete(trip.destination);
          const placeId = matches[0]?.placeId;
          if (!placeId) {
            return;
          }

          const imageUrl = await fetchPlacePrimaryPhotoUrl(placeId);
          if (!imageUrl) {
            return;
          }

          await setTripDestinationImage(trip.id, imageUrl);
        } finally {
          inFlightRef.current.delete(trip.id);
        }
      })();
    });
  }, [trips, setTripDestinationImage]);

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
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 },
  title: { fontSize: 32, fontFamily: F.bold, color: C.fg, letterSpacing: -0.5 },
  addBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: C.charcoal, justifyContent: 'center', alignItems: 'center', shadowColor: C.charcoal, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 6 },
  list: { gap: 24 },
  card: { width: '100%', height: 240, borderRadius: 32, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 8 },
  cardImg: { width: '100%', height: '100%', backgroundColor: C.sage },
  heart: { position: 'absolute', top: 16, right: 16, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center' },
  cardBottom: { position: 'absolute', bottom: 16, left: 20, right: 20 },
  cardTitle: { color: C.white, fontSize: 28, fontFamily: F.bold, textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 8 },
  cardDates: { color: 'rgba(255,255,255,0.9)', fontSize: 15, fontFamily: F.medium, marginTop: 4, textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  empty: { backgroundColor: C.white, borderRadius: 24, padding: 40, alignItems: 'center' },
  emptyTitle: { fontSize: 18, fontFamily: F.bold, color: C.fg, marginBottom: 8 },
  emptySub: { fontSize: 14, fontFamily: F.regular, color: C.secondary, textAlign: 'center' },
});
