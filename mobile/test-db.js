import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);

async function runTest() {
  console.log('Fetching an existing user...');
  const { data: users, error: userError } = await supabase.from('users').select('id').limit(1);
  
  if (userError || !users || users.length === 0) {
    console.error('User Fetch Error:', userError || 'No users found');
    return;
  }
  const userId = users[0].id;
  console.log('Using User ID:', userId);

  console.log('Inserting trip...');
  const { data: tripData, error: tripError } = await supabase.from('trips').insert([{
    user_id: userId,
    destination: 'Test City',
    start_date: new Date().toISOString(),
    end_date: new Date().toISOString(),
    travel_vibes: ['relaxing']
  }]).select().single();

  if (tripError) {
    console.error('Trip Error:', tripError);
    return;
  }
  console.log('Trip created:', tripData.id);

  console.log('Inserting activity...');
  const { data: blockData, error: blockError } = await supabase.from('activity_blocks').insert([{
    trip_id: tripData.id,
    day_index: 0,
    place_name: 'Test Place',
    activity_type: 'other',
    energy_cost_estimate: 5,
    start_time: '09:00:00',
    end_time: '11:00:00'
  }]).select().single();

  if (blockError) {
    console.error('Block Error:', blockError);
    return;
  }
  console.log('Block created:', blockData.id);

  console.log('Inserting check in...');
  const { data: checkInData, error: checkInError } = await supabase.from('check_ins').insert([{
    activity_block_id: blockData.id,
    user_id: userId,
    energy_level: 5,
    current_lat: 0.0,
    current_lng: 0.0,
    agent_outcome: 'accept'
  }]).select().single();

  if (checkInError) {
    console.error('CheckIn Error:', checkInError);
    return;
  }
  console.log('Success! All inserts worked.');

  // Clean up
  await supabase.from('trips').delete().eq('id', tripData.id);
}

runTest();
