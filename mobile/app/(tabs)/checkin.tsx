import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useTripStore } from '../../store/trip-store';

export default function Checkin() {
  const { energyLevel, setEnergyLevel } = useTripStore();

  const handleCheckin = (level: number) => {
    setEnergyLevel(level);
    Alert.alert('Check-in Complete', `Energy level set to ${level}/10`);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>How are you feeling?</Text>
      <Text style={styles.subtitle}>Rate your current energy level</Text>

      <View style={styles.sliderContainer}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((level) => (
          <TouchableOpacity
            key={level}
            style={[
              styles.levelButton,
              energyLevel === level && styles.selectedButton,
            ]}
            onPress={() => handleCheckin(level)}
          >
            <Text
              style={[
                styles.levelText,
                energyLevel === level && styles.selectedText,
              ]}
            >
              {level}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.scale}>
        1 = Exhausted • 10 = Energized
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF8F5',
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 40,
  },
  sliderContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 40,
  },
  levelButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  selectedButton: {
    backgroundColor: '#8B9A7B',
  },
  levelText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  selectedText: {
    color: '#FFFFFF',
  },
  scale: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
});