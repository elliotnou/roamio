import { Tabs } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { C } from '../../lib/colors';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: C.sage,
        tabBarInactiveTintColor: C.placeholder,
        tabBarShowLabel: false,
        tabBarStyle: {
          backgroundColor: C.white,
          borderTopColor: C.border,
          borderTopWidth: 0.5,
          height: 60,
          paddingBottom: 8,
        },
      }}
    >
      <Tabs.Screen name="index" options={{ tabBarIcon: ({ color, size }) => <Feather name="home" size={size} color={color} /> }} />
      <Tabs.Screen name="trips" options={{ tabBarIcon: ({ color, size }) => <Feather name="map" size={size} color={color} /> }} />
      <Tabs.Screen name="favorites" options={{ tabBarIcon: ({ color, size }) => <Feather name="heart" size={size} color={color} /> }} />
      <Tabs.Screen name="profile" options={{ tabBarIcon: ({ color, size }) => <Feather name="user" size={size} color={color} /> }} />
    </Tabs>
  );
}
