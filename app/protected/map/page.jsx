import { supabase } from '@/lib/supabaseClient';
import MapPage from './MapPage'; // We'll create a MapPage client component for the UI.

// This is a server component that fetches the initial data and passes it to a client component.
export default async function Page() {
  const initialZoomLevel = 5;

  // Fetch initial clusters
  const { data: clusters, error: clustersError } = await supabase.rpc('get_cached_clusters', {
    p_zoom_level: initialZoomLevel,
    p_min_lat: null,
    p_min_lon: null,
    p_max_lat: null,
    p_max_lon: null,
  });

  if (clustersError) {
    console.error(`Error fetching clusters:`, clustersError);
    throw new Error('Failed to fetch initial clusters.');
  }

  // Fetch existing territories
  const { data: territories, error: territoriesError } = await supabase
    .from('territories')
    .select('id, name, color, geom');

  if (territoriesError) {
    console.error('Error fetching territories:', territoriesError);
    throw new Error('Failed to fetch territories.');
  }

  return (
    <MapPage
      initialClusters={clusters ?? []}
      initialZoomLevel={initialZoomLevel}
      initialTerritories={territories ?? []}
    />
  );
}
