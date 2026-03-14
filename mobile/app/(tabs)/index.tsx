import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useTripStore } from '../../store/trip-store';
import { formatDate, DEMO_CURRENT_DAY } from '../../lib/utils';

export default function Dashboard() {
  const { activeTrip, activityBlocks } = useTripStore();

  if (!activeTrip) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>No active trip</Text>
        <StatusBar style="auto" />
      </View>
    );
  }

  const todayBlocks = activityBlocks[activeTrip.id]?.filter(
    block => block.day_index === DEMO_CURRENT_DAY
  ) || [];

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{activeTrip.destination}</Text>
        <Text style={styles.date}>
          {formatDate(activeTrip.start_date)} - {formatDate(activeTrip.end_date)}
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Today's Activities</Text>
        {todayBlocks.map((block) => (
          <View key={block.id} style={styles.activityCard}>
            <Text style={styles.activityName}>{block.place_name}</Text>
            <Text style={styles.activityTime}>
              {block.start_time} - {block.end_time}
            </Text>
            <Text style={styles.activityType}>{block.activity_type}</Text>
          </View>
        ))}
      </View>

      <StatusBar style="auto" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF8F5',
  },
  header: {
    padding: 20,
    backgroundColor: '#8B9A7B',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FAF8F5',
  },
  date: {
    fontSize: 16,
    color: '#E8EDE4',
    marginTop: 4,
  },
  section: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 16,
  },
  activityCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  activityName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  activityTime: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  activityType: {
    fontSize: 12,
    color: '#8B9A7B',
    marginTop: 4,
    textTransform: 'capitalize',
  },
});