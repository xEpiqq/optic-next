import { NextResponse } from 'next/server';
import { createServerComponentClient } from '../../../utils/supabase/supabaseAdmin';

export async function POST(request) {
  const supabaseAdmin = createServerComponentClient();

  try {
    const { territoryId, managers = [] } = await request.json();

    if (!territoryId || !Array.isArray(managers) || managers.length === 0) {
      return NextResponse.json(
        { error: 'Missing territoryId or no managers array provided.' },
        { status: 400 }
      );
    }

    // Fetch the territory, selecting geom as GeoJSON
    // If your table stores raw geometry, we can do ST_AsGeoJSON(geom) as geom
    // or if your "geom" column is already a JSON/GeoJSON type, just select it directly.
    const { data: territoryData, error: territoryError } = await supabaseAdmin
      .from('territories')
      .select('id, name, color, geom')
      .eq('id', territoryId)
      .single();

    if (territoryError || !territoryData) {
      console.error('Could not find territory:', territoryError);
      return NextResponse.json({ error: 'Territory not found.' }, { status: 404 });
    }

    // territoryData.geom is assumed to be valid GeoJSON
    const geoJson = territoryData.geom;
    if (!geoJson || geoJson.type !== 'Polygon') {
      return NextResponse.json({ error: 'Territory geometry is invalid.' }, { status: 400 });
    }

    // Call the new RPC to assign managers to all pins in the polygon
    const { error: assignError, data: insertedCount } = await supabaseAdmin
      .rpc('assign_managers_to_polygon', {
        p_polygon: geoJson,
        p_manager_ids: managers
      });

    if (assignError) {
      console.error('Error assigning managers to territory:', assignError);
      return NextResponse.json({ error: assignError.message }, { status: 500 });
    }

    return NextResponse.json(
      {
        message: 'Managers assigned successfully.',
        territoryId,
        insertedCount: insertedCount || 0
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Unexpected error in assignTerritoryManagers:', error);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
