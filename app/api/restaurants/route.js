import { NextResponse } from 'next/server';
import { createServerComponentClient } from '../../../utils/supabase/supabaseAdmin';

export async function GET(request) {
  const supabaseAdmin = createServerComponentClient();

  console.log("FETCHING RESTAURANTS WITHIN BOUNDS");
  const { searchParams } = new URL(request.url);
  const min_lat = parseFloat(searchParams.get('min_lat'));
  const min_lon = parseFloat(searchParams.get('min_lon'));
  const max_lat = parseFloat(searchParams.get('max_lat'));
  const max_lon = parseFloat(searchParams.get('max_lon'));

  let filters = [];
  const filtersParam = searchParams.get('filters');
  if (filtersParam) {
    try {
      filters = JSON.parse(decodeURIComponent(filtersParam));
    } catch (error) {
      console.error('Invalid filters parameter:', error);
      return NextResponse.json({ error: 'Invalid filters parameter.' }, { status: 400 });
    }
  }

  // Validate bounding box params:
  if (
    isNaN(min_lat) ||
    isNaN(min_lon) ||
    isNaN(max_lat) ||
    isNaN(max_lon)
  ) {
    return NextResponse.json(
      { error: 'Invalid or missing query parameters.' },
      { status: 400 }
    );
  }

  try {
    // IMPORTANT CHANGE HERE: now we select from `restaurants`,
    // and we filter by the newly added `latitude` / `longitude` columns.
    let query = supabaseAdmin
      .from('restaurants')
      .select(`
        id,
        address,
        address2,
        city,
        state,
        phone,
        first_name,
        last_name,
        latitude,
        longitude,
        status,
        knocks,
        last_knocked,
        email,
        updated_at,
        user_id
      `)
      .lte('latitude', max_lat)
      .gte('latitude', min_lat)
      .lte('longitude', max_lon)
      .gte('longitude', min_lon);

    // If there are dynamic filters, apply them
    const allowedOperators = ['eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'like', 'ilike'];
    const operatorMap = {
      '=': 'eq',
      '!=': 'neq',
      '>': 'gt',
      '<': 'lt',
      '>=': 'gte',
      '<=': 'lte',
      'LIKE': 'like',
    };

    for (const filter of filters) {
      const { column, operator, value } = filter;
      if (column && operator && value !== undefined) {
        const supabaseOperator = operatorMap[operator];
        if (!supabaseOperator || !allowedOperators.includes(supabaseOperator)) {
          return NextResponse.json(
            { error: `Invalid operator: ${operator}` },
            { status: 400 }
          );
        }
        query = query[supabaseOperator](column, value);
      }
    }

    const { data, error } = await query;
    if (error) {
      console.error('Error fetching restaurants:', error);
      return NextResponse.json(
        { error: 'Failed to fetch restaurants.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ restaurants: data }, { status: 200 });
  } catch (err) {
    console.error('Unexpected error:', err);
    return NextResponse.json(
      { error: 'An unexpected error occurred.' },
      { status: 500 }
    );
  }
}
