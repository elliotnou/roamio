import { View, Text, StyleSheet } from 'react-native';
import { useTripStore } from '../../store/trip-store';

export default function Profile() {
  const { user, trips, checkIns } = useTripStore();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {user.display_name.charAt(0).toUpperCase()}
          </Text>
        </View>
        <Text style={styles.name}>{user.display_name}</Text>
        <Text style={styles.email}>{user.email}</Text>
      </View>

      <View style={styles.stats}>
        <View style={styles.stat}>
          <Text style={styles.statNumber}>{trips.length}</Text>
          <Text style={styles.statLabel}>Trips</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statNumber}>{checkIns.length}</Text>
          <Text style={styles.statLabel}>Check-ins</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statNumber}>42</Text>
          <Text style={styles.statLabel}>Activities</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF8F5',
  },
  header: {
    backgroundColor: '#8B9A7B',
    padding: 40,
    alignItems: 'center',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#8B9A7B',
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  email: {
    fontSize: 16,
    color: '#E8EDE4',
    marginTop: 4,
  },
  stats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 20,
  },
  stat: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
});