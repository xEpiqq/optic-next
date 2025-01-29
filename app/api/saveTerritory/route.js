import { NextResponse } from 'next/server';
import { createServerComponentClient } from '../../../utils/supabase/supabaseAdmin';

export async function POST(request) {
  const supabaseAdmin = createServerComponentClient();

  try {
    // Now we destructure "managers" from the JSON as well
    const { name, color, coordinates, managers = [] } = await request.json();

    // Validate required fields
    if (
      !name ||
      !color ||
      !coordinates ||
      !Array.isArray(coordinates) ||
      coordinates.length < 3
    ) {
      return NextResponse.json({ message: 'Invalid input data.' }, { status: 400 });
    }

    // Construct a valid GeoJSON polygon
    const geoJson = {
      type: 'Polygon',
      coordinates: [
        coordinates.map(coord => [coord.lng, coord.lat])
      ]
    };

    // Ensure the first and last coordinate match to close the polygon
    const firstCoord = geoJson.coordinates[0][0];
    const lastCoord = geoJson.coordinates[0][geoJson.coordinates[0].length - 1];
    if (firstCoord[0] !== lastCoord[0] || firstCoord[1] !== lastCoord[1]) {
      geoJson.coordinates[0].push(firstCoord);
    }

    // Insert territory
    const { data, error } = await supabaseAdmin
      .from('territories')
      .insert([{ name, color, geom: geoJson }])
      .select();

    if (error) {
      console.error('Supabase insert error:', error);
      return NextResponse.json(
        { message: 'Failed to save territory.', details: error.message },
        { status: 500 }
      );
    }

    // data should be an array with the newly inserted territory
    const newTerritory = data && data.length > 0 ? data[0] : null;

    // If we have an array of managers, call the new RPC to link them
    if (managers && managers.length > 0) {
      const { error: assignErr } = await supabaseAdmin
        .rpc('assign_managers_to_polygon', {
          p_polygon: geoJson,
          p_manager_ids: managers
        });

      if (assignErr) {
        console.error('Error assigning managers:', assignErr);
        // Not a fatal error for territory creation, but we should let the client know
        return NextResponse.json(
          {
            message: 'Territory saved, but failed to assign managers.',
            territory: newTerritory
          },
          { status: 200 }
        );
      }
    }

    return NextResponse.json(
      { message: 'Territory saved successfully.', data },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error in saveTerritory API:', error);
    return NextResponse.json({ message: 'Internal server error.', details: error.message }, { status: 500 });
  }
}
