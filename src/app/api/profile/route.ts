import { NextRequest, NextResponse } from 'next/server';
import { profilesService } from '@/lib/db';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const updateProfileSchema = z.object({
  first_name: z.string().min(1).optional(),
  last_name: z.string().min(1).optional(),
  phone: z.string().nullable().optional(),
  avatar_url: z.string().url().nullable().optional(),
  bar_number: z.string().nullable().optional(),
  firm_name: z.string().nullable().optional(),
  specializations: z.array(z.string()).nullable().optional(),
  date_of_birth: z.string().nullable().optional(),
  country_of_birth: z.string().nullable().optional(),
  nationality: z.string().nullable().optional(),
  alien_number: z.string().nullable().optional(),
});

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const profile = await profilesService.getProfile(user.id);

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    return NextResponse.json(profile);
  } catch (error) {
    console.error('Error fetching profile:', error);
    return NextResponse.json(
      { error: 'Failed to fetch profile' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = updateProfileSchema.parse(body);

    const updatedProfile = await profilesService.updateProfile(user.id, validatedData);

    return NextResponse.json(updatedProfile);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error('Error updating profile:', error);
    return NextResponse.json(
      { error: 'Failed to update profile' },
      { status: 500 }
    );
  }
}
