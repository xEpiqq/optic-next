import { NextResponse } from "next/server";
import { createServerComponentClient } from "../../../utils/supabase/supabaseAdmin";

// Expects POST { coordinates: [ { lat, lng }, ... ] }
// We'll use that to call our RPC "restaurants_in_polygon_stats",
// which returns how many restaurants are inside that polygon.
export async function POST(request) {
  const supabaseAdmin = createServerComponentClient();

  try {
    const { coordinates } = await request.json();

    // Basic validation
    if (!coordinates || !Array.isArray(coordinates) || coordinates.length < 3) {
      return NextResponse.json(
        { error: "Invalid polygon coordinates." },
        { status: 400 }
      );
    }

    // Convert to a valid GeoJSON Polygon
    const geoJson = {
      type: "Polygon",
      coordinates: [
        // Turn [{ lat, lng }, ...] into [[lng, lat], ...]
        coordinates.map((pt) => [pt.lng, pt.lat]),
      ],
    };

    // Call the new Postgres RPC
    const { data, error } = await supabaseAdmin.rpc(
      "restaurants_in_polygon_stats",
      { p_polygon: geoJson }
    );
    if (error) {
      console.error("territoryStats error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // data should be an array of length 1, e.g. [{ total: 42 }]
    let result = data;
    if (Array.isArray(data) && data.length > 0) {
      result = data[0];
    }

    return NextResponse.json(
      { total: result.total || 0 },
      { status: 200 }
    );
  } catch (err) {
    console.error("territoryStats route error:", err);
    return NextResponse.json(
      { error: "Unexpected error occurred." },
      { status: 500 }
    );
  }
}
