import { NextResponse } from 'next/server';
import { createServerComponentClient } from '../../../utils/supabase/supabaseAdmin';

export async function POST(request) {
  const supabaseAdmin = createServerComponentClient();

  try {
    const { name } = await request.json();
    const { data: newTeam, error: insertError } = await supabaseAdmin
      .from("teams")
      .insert({ name })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting team:', insertError);
      return NextResponse.json({ error: 'Failed to add team' }, { status: 500 });
    }

    return NextResponse.json(newTeam, { status: 200 });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
}
