import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator } from 'react-native';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useTripStore } from '../store/trip-store';
import { useFonts } from 'expo-font';
import {
  InstrumentSans_400Regular,
  InstrumentSans_500Medium,
  InstrumentSans_600SemiBold,
  InstrumentSans_700Bold,
} from '@expo-google-fonts/instrument-sans';
import { C } from '../lib/colors';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    InstrumentSans_400Regular,
    InstrumentSans_500Medium,
    InstrumentSans_600SemiBold,
    InstrumentSans_700Bold,
  });

  const [isReady, setIsReady] = useState(false);
  const router = useRouter();
  const segments = useSegments();
  const { fetchData } = useTripStore();

  useEffect(() => {
    if (!fontsLoaded) return;

    const initAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        await fetchData();
        router.replace('/(tabs)');
      } else {
        router.replace('/login');
      }
      setIsReady(true);
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isReady) return;
      
      if (session) {
        await fetchData();
        router.replace('/(tabs)');
      } else {
        router.replace('/login');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [fontsLoaded, isReady]);

  if (!fontsLoaded || !isReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.bg }}>
        <ActivityIndicator color={C.charcoal} />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="trips" />
        <Stack.Screen name="checkin/[blockId]" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="checkin/suggestions" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      </Stack>
    </>
  );
}
