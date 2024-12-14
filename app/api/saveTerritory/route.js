import { NextResponse } from 'next/server';
import { createServerComponentClient } from '../../../utils/supabase/supabaseAdmin';

export async function POST(request) {
  const supabaseAdmin = createServerComponentClient();

  try {
    const { name, color, coordinates } = await request.json();

    if (
      !name ||
      !color ||
      !coordinates ||
      !Array.isArray(coordinates) ||
      coordinates.length < 3
    ) {
      return NextResponse.json({ message: 'Invalid input data.' }, { status: 400 });
    }

    const geoJson = {
      type: 'Polygon',
      coordinates: [
        coordinates.map(coord => [coord.lng, coord.lat])
      ]
    };

    const firstCoord = geoJson.coordinates[0][0];
    const lastCoord = geoJson.coordinates[0][geoJson.coordinates[0].length - 1];
    if (firstCoord[0] !== lastCoord[0] || firstCoord[1] !== lastCoord[1]) {
      geoJson.coordinates[0].push(firstCoord);
    }

    const { data, error } = await supabaseAdmin
      .from('territories')
      .insert([{ name, color, geom: geoJson }]);

    if (error) {
      console.error('Supabase insert error:', error);
      return NextResponse.json({ message: 'Failed to save territory.', details: error.message }, { status: 500 });
    }

    return NextResponse.json({ message: 'Territory saved successfully.', data }, { status: 200 });
  } catch (error) {
    console.error('Error in saveTerritory API:', error);
    return NextResponse.json({ message: 'Internal server error.', details: error.message }, { status: 500 });
  }
}
