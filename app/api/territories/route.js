import { NextResponse } from 'next/server';
import { createServerComponentClient } from '../../../utils/supabase/supabaseAdmin';

// GET /api/territories
export async function GET(request) {
  const supabaseAdmin = createServerComponentClient();
  const { searchParams } = new URL(request.url);
  const min_lat = parseFloat(searchParams.get('min_lat'));
  const min_lon = parseFloat(searchParams.get('min_lon'));
  const max_lat = parseFloat(searchParams.get('max_lat'));
  const max_lon = parseFloat(searchParams.get('max_lon'));

  // Adjust logic if bounding is needed. Here we just select all.
  const { data, error } = await supabaseAdmin
    .from('territories')
    .select('id, name, description, geometry');

  if (error) {
    console.error('Error fetching territories:', error);
    return NextResponse.json({ error: 'Failed to fetch territories.' }, { status: 500 });
  }

  return NextResponse.json({ territories: data }, { status: 200 });
}

// POST /api/territories
export async function POST(request) {
  const supabaseAdmin = createServerComponentClient();

  try {
    const { name, description, geometry } = await request.json();
    const wkt = geoJSONToWKT(geometry);

    const { data, error } = await supabaseAdmin
      .from('territories')
      .insert([
        {
          name,
          description,
          // This assumes you can directly insert WKT. If PostGIS or a function is needed, adjust accordingly.
          geometry: wkt,
        }
      ])
      .select();

    if (error) {
      console.error('Error creating territory:', error);
      return NextResponse.json({ error: 'Failed to create territory.' }, { status: 500 });
    }

    return NextResponse.json({ territory: data[0] }, { status: 201 });
  } catch (err) {
    console.error('Error parsing request body:', err);
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }
}

function geoJSONToWKT(geoJSON) {
  if (geoJSON.type !== 'Polygon') {
    throw new Error('Only Polygon type is supported.');
  }
  const coordinates = geoJSON.coordinates[0].map(coord => coord.join(' ')).join(', ');
  return `POLYGON((${coordinates}))`;
}

// DELETE /api/territories?id=someID
export async function DELETE(request) {
  const supabaseAdmin = createServerComponentClient();
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'Missing territory id' }, { status: 400 });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('territories')
      .delete()
      .eq('id', id)
      .select();

    if (error) {
      console.error('Error deleting territory:', error);
      return NextResponse.json({ error: 'Failed to delete territory.' }, { status: 500 });
    }

    return NextResponse.json({ message: 'Territory deleted successfully.' }, { status: 200 });
  } catch (err) {
    console.error('Unexpected error deleting territory:', err);
    return NextResponse.json({ error: 'Unexpected error occurred.' }, { status: 500 });
  }
}
