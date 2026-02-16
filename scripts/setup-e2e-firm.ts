/**
 * Setup a firm for the E2E attorney user so case creation works.
 * The cases table has a NOT NULL constraint on firm_id.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const envPath = resolve(__dirname, '..', '.env.local');
const envContent = readFileSync(envPath, 'utf-8');
const env: Record<string, string> = {};
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (trimmed.length === 0 || trimmed.startsWith('#')) continue;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx === -1) continue;
  env[trimmed.slice(0, eqIdx)] = trimmed.slice(eqIdx + 1);
}

const ATTORNEY_ID = '54888bdd-8af0-452a-a25b-770d5a797550';

const sb = createClient(env['NEXT_PUBLIC_SUPABASE_URL'], env['SUPABASE_SERVICE_ROLE_KEY'], {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  // Check if attorney already has a firm
  const { data: existing } = await sb
    .from('firm_members')
    .select('firm_id')
    .eq('user_id', ATTORNEY_ID)
    .limit(1)
    .single();

  if (existing) {
    console.log('Attorney already has firm:', existing.firm_id);
    return;
  }

  // Create a firm
  const { data: firm, error: firmErr } = await sb
    .from('firms')
    .insert({ name: 'E2E Test Firm', slug: 'e2e-test-firm', owner_id: ATTORNEY_ID })
    .select()
    .single();

  if (firmErr) {
    console.error('Failed to create firm:', JSON.stringify(firmErr));
    process.exit(1);
  }

  console.log('Created firm:', firm.id, firm.name);

  // Add attorney as firm member
  const { error: memberErr } = await sb
    .from('firm_members')
    .insert({ firm_id: firm.id, user_id: ATTORNEY_ID, role: 'owner' });

  if (memberErr) {
    console.error('Failed to add member:', JSON.stringify(memberErr));
    process.exit(1);
  }

  console.log('Added attorney as firm owner');

  // Set primary_firm_id on profile
  const { error: profileErr } = await sb
    .from('profiles')
    .update({ primary_firm_id: firm.id })
    .eq('id', ATTORNEY_ID);

  if (profileErr) {
    console.error('Failed to update profile:', JSON.stringify(profileErr));
    process.exit(1);
  }

  console.log('Set primary_firm_id on attorney profile');
  console.log('Done! Case creation should now work.');
}

main().catch(e => console.error('Fatal:', e));
