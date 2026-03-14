import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);

async function createTestUser() {
  console.log('Signing up a test user...');
  const { data, error } = await supabase.auth.signUp({
    email: 'test' + Date.now() + '@example.com',
    password: 'password123',
    options: {
      data: {
        display_name: 'Test User'
      }
    }
  });

  if (error) {
    console.error('Error creating user:', error.message);
    return;
  }

  console.log('User created:', data.user.id);
  
  // Also add row to public.users because there may not be a trigger
  const { error: insertError } = await supabase.from('users').upsert({
    id: data.user.id,
    email: data.user.email,
    display_name: 'Test User'
  });
  
  if (insertError) {
    console.error('Error inserting into public.users:', insertError.message);
  } else {
    console.log('User added to public.users table as well');
  }
}

createTestUser();
