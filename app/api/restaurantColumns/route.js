import { NextResponse } from 'next/server';
import { createServerComponentClient } from '../../../utils/supabase/supabaseAdmin';

export async function GET() {
  const supabaseAdmin = createServerComponentClient();

  try {
    const { data, error } = await supabaseAdmin.rpc('get_restaurant_columns');
    if (error) {
      console.error('Error fetching restaurant columns:', error);
      return NextResponse.json({ error: 'Failed to fetch restaurant columns.' }, { status: 500 });
    }

    const columns = data.map((row) => row.col_name);
    console.log(columns);
    return NextResponse.json({ columns }, { status: 200 });
  } catch (err) {
    console.error('Unexpected error:', err);
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}
