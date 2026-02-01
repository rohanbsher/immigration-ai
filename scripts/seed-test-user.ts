import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load env vars from .env.local
const envPath = resolve(__dirname, '..', '.env.local');
const envContent = readFileSync(envPath, 'utf-8');
const env: Record<string, string> = {};
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx === -1) continue;
  env[trimmed.slice(0, eqIdx)] = trimmed.slice(eqIdx + 1);
}

const SUPABASE_URL = env['NEXT_PUBLIC_SUPABASE_URL'];
const SERVICE_ROLE_KEY = env['SUPABASE_SERVICE_ROLE_KEY'];

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const TEST_USER = {
  email: 'test-attorney@immigration-ai.dev',
  password: 'TestAttorney123!',
  email_confirm: true,
  user_metadata: {
    first_name: 'Test',
    last_name: 'Attorney',
    role: 'attorney',
    bar_number: 'TEST-12345',
  },
};

async function seed() {
  console.log('Creating test user:', TEST_USER.email);

  // Check if user already exists
  const { data: existing } = await supabase.auth.admin.listUsers();
  const alreadyExists = existing?.users?.find((u) => u.email === TEST_USER.email);

  if (alreadyExists) {
    console.log('Test user already exists. ID:', alreadyExists.id);
    console.log('Skipping creation.');
    return;
  }

  const { data, error } = await supabase.auth.admin.createUser(TEST_USER);

  if (error) {
    console.error('Failed to create test user:', error.message);
    process.exit(1);
  }

  console.log('Test user created successfully!');
  console.log('  ID:', data.user.id);
  console.log('  Email:', data.user.email);
  console.log('  Password:', TEST_USER.password);
  console.log('  Role:', TEST_USER.user_metadata.role);
  console.log('\nThe handle_new_user trigger should auto-create the profile row.');
}

seed().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
