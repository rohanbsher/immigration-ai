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

const TEST_USERS = [
  {
    email: 'e2e-attorney@immigration-ai.dev',
    password: 'E2EAttorney123!',
    email_confirm: true,
    user_metadata: {
      first_name: 'E2E',
      last_name: 'Attorney',
      role: 'attorney',
      bar_number: 'E2E-TEST-001',
    },
  },
  {
    email: 'e2e-client@immigration-ai.dev',
    password: 'E2EClient123!',
    email_confirm: true,
    user_metadata: {
      first_name: 'E2E',
      last_name: 'Client',
      role: 'client',
    },
  },
];

async function seed() {
  const { data: existing } = await supabase.auth.admin.listUsers();
  const existingEmails = new Set(existing?.users?.map((u) => u.email) ?? []);

  for (const user of TEST_USERS) {
    console.log(`\nSeeding user: ${user.email}`);

    if (existingEmails.has(user.email)) {
      const found = existing?.users?.find((u) => u.email === user.email);
      console.log(`  Already exists. ID: ${found?.id}`);
      console.log('  Skipping creation.');
      continue;
    }

    const { data, error } = await supabase.auth.admin.createUser(user);

    if (error) {
      console.error(`  Failed to create user: ${error.message}`);
      process.exit(1);
    }

    console.log('  Created successfully!');
    console.log(`  ID: ${data.user.id}`);
    console.log(`  Email: ${data.user.email}`);
    console.log(`  Password: ${user.password}`);
    console.log(`  Role: ${user.user_metadata.role}`);
  }

  console.log('\nThe handle_new_user trigger should auto-create profile rows.');
}

seed().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
