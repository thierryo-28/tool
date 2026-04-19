import { NextRequest, NextResponse } from 'next/server';
import {
  getCurrentUserPrimaryEmail,
  getOrCreateProfileId,
  requireClerkUserId
} from '@/lib/server/viewsAuth';
import { getSupabaseAdminClient } from '@/lib/server/supabaseAdmin';
import { profilePlannerSettingsBodySchema } from '@/lib/server/profilePlannerSettingsSchema';
import {
  emptyProfilePlannerSettings,
  type ProfilePlannerSettings
} from '@/lib/profilePlannerSettings';

interface SettingsRow {
  profile_id: string;
  settings: unknown;
  updated_at: string;
}

function parseStoredSettings(raw: unknown): ProfilePlannerSettings {
  const parsed = profilePlannerSettingsBodySchema.safeParse(raw);
  if (parsed.success) {
    return {
      version: parsed.data.version,
      salesTemplates: parsed.data.salesTemplates,
      sdrTemplates: parsed.data.sdrTemplates
    };
  }
  return emptyProfilePlannerSettings();
}

export async function GET() {
  try {
    const clerkUserId = await requireClerkUserId();
    const email = await getCurrentUserPrimaryEmail();
    const profileId = await getOrCreateProfileId(clerkUserId, email);
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from('profile_planner_settings')
      .select('profile_id, settings, updated_at')
      .eq('profile_id', profileId)
      .maybeSingle<SettingsRow>();
    if (error) throw error;
    if (!data) {
      return NextResponse.json({
        settings: emptyProfilePlannerSettings(),
        updatedAt: null as string | null
      });
    }
    return NextResponse.json({
      settings: parseStoredSettings(data.settings),
      updatedAt: data.updated_at
    });
  } catch (e) {
    if (e instanceof Error && e.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json(
      { error: 'Failed to load settings' },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = profilePlannerSettingsBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const clerkUserId = await requireClerkUserId();
    const email = await getCurrentUserPrimaryEmail();
    const profileId = await getOrCreateProfileId(clerkUserId, email);
    const supabase = getSupabaseAdminClient();
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('profile_planner_settings')
      .upsert(
        {
          profile_id: profileId,
          settings: parsed.data,
          updated_at: now
        },
        { onConflict: 'profile_id' }
      )
      .select('profile_id, settings, updated_at')
      .single<SettingsRow>();
    if (error) throw error;

    return NextResponse.json({
      settings: parseStoredSettings(data.settings),
      updatedAt: data.updated_at
    });
  } catch (e) {
    if (e instanceof Error && e.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json(
      { error: 'Failed to save settings' },
      { status: 500 }
    );
  }
}
