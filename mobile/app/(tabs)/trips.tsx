import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image } from 'react-native';
import { useTripStore } from '../../store/trip-store';
import { formatDate } from '../../lib/utils';

export default function Trips() {
  const { trips, setActiveTrip } = useTripStore();

  const renderTrip = ({ item }: { item: typeof trips[0] }) => (
    <TouchableOpacity
      style={styles.tripCard}
      onPress={() => setActiveTrip(item)}
    >
      <Image
        source={{ uri: item.destination_image }}
        style={styles.tripImage}
        resizeMode="cover"
      />
      <View style={styles.tripOverlay}>
        <Text style={styles.tripDestination}>{item.destination}</Text>
        <Text style={styles.tripDates}>
          {formatDate(item.start_date)} - {formatDate(item.end_date)}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>My Trips</Text>
      <FlatList
        data={trips}
        renderItem={renderTrip}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF8F5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1A1A1A',
    padding: 20,
    paddingBottom: 10,
  },
  list: {
    padding: 20,
    paddingTop: 0,
  },
  tripCard: {
    height: 200,
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  tripImage: {
    width: '100%',
    height: '100%',
  },
  tripOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    padding: 16,
  },
  tripDestination: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  tripDates: {
    fontSize: 14,
    color: '#E8EDE4',
    marginTop: 4,
  },
});