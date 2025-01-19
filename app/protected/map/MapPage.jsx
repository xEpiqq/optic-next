// app/protected/map/MapPage.jsx
"use client";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import Toolbar from "@/components/Toolbar";
import Territory from "@/components/Territory";
import Sidebar from "@/components/Sidebar";
import FilterModal from "@/components/FilterModal";
import AssignLeadsModal from "@/components/AssignLeadsModal";

const ZOOM_THRESHOLD = 15;

// Convert numeric status to a hex color
function getStatusColor(status) {
  switch (status) {
    case 0: return "#6A0DAD"; // New
    case 1: return "#FFD700"; // Gone
    case 2: return "#1E90FF"; // Later
    case 3: return "#FF6347"; // Nope
    case 4: return "#32CD32"; // Sold
    case 5: return "#00008B"; // Return
    default: return "#007bff"; // fallback
  }
}

export default function MapPage({
  initialClusters = [],
  initialZoomLevel = 5,
  initialTerritories = []
}) {
  const supabase = createClient();
  const mapRef = useRef(null);
  const map = useRef(null);

  // Keep references to cluster (legacy) and individual (advanced) markers
  const clusterMarkers = useRef([]);
  const individualMarkers = useRef([]);
  const territoryPolygons = useRef([]);

  const infoWindowRef = useRef(null); // for showing marker details
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const hasLoadedIndividuals = useRef(false);
  const fetchCounter = useRef(0);

  const [showTerritory, setShowTerritory] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);

  // Clear an array of markers (both legacy and advanced)
  const clearMarkers = (ref) => {
    ref.current.forEach((m) => {
      if (m instanceof google.maps.Marker) {
        // Legacy marker
        m.setMap(null);
      } else if (m.map) {
        // Advanced marker
        m.map = null;
      }
    });
    ref.current = [];
  };

  const clearPolygons = () => {
    territoryPolygons.current.forEach((p) => p.setMap(null));
    territoryPolygons.current = [];
  };

  // Simplify zoom levels -> cluster zoom levels
  const getMappedZoom = (z) => {
    if (z >= 12) return 10;
    if (z >= 11) return 9;
    if (z >= 10) return 8;
    if (z >= 8) return 6;
    if (z >= 3) return 5;
    return Math.round(z);
  };

  // Draw polygons for each territory
  const drawTerritories = (territories) => {
    clearPolygons();
    (territories || []).forEach((t) => {
      if (!t.geom || !t.geom.coordinates) return;
      const coords = t.geom.coordinates[0].map(([lng, lat]) => ({ lat, lng }));
      const polygon = new google.maps.Polygon({
        paths: coords,
        strokeColor: t.color || "#FF0000",
        strokeOpacity: 0.8,
        strokeWeight: 2,
        fillColor: t.color || "#FF0000",
        fillOpacity: 0.35,
        map: map.current
      });
      territoryPolygons.current.push(polygon);
    });
  };

  // Fetch cluster points (kept as legacy google.maps.Marker with circle icon)
  const fetchClusters = async (z) => {
    const currentFetchId = ++fetchCounter.current;
    if (!map.current) return;
    const bounds = map.current.getBounds();
    if (!bounds) return;

    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();
    const [min_lat, min_lon, max_lat, max_lon] =
      z === 5
        ? [null, null, null, null]
        : [sw.lat(), sw.lng(), ne.lat(), ne.lng()];

    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.rpc("get_cached_clusters", {
        p_zoom_level: z,
        p_min_lat: min_lat,
        p_min_lon: min_lon,
        p_max_lat: max_lat,
        p_max_lon: max_lon
      });
      if (error) throw error;
      if (currentFetchId !== fetchCounter.current) return;

      clearMarkers(clusterMarkers);
      (data || []).forEach((c) => {
        const lat = parseFloat(c.latitude);
        const lng = parseFloat(c.longitude);
        if (isNaN(lat) || isNaN(lng)) return;

        // Legacy cluster marker as a circle
        const scale = (() => {
          const minScale = 20;
          const maxScale = 50;
          const normalized = Math.min(1, Math.max(0, (c.count - 1) / 999));
          return minScale + normalized * (maxScale - minScale);
        })();

        const marker = new google.maps.Marker({
          position: { lat, lng },
          map: map.current,
          label: {
            text: String(c.count),
            color: "white",
            fontSize: "12px",
            fontWeight: "bold"
          },
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            fillColor: "#007bff",
            fillOpacity: 0.6,
            scale,
            strokeColor: "#fff",
            strokeWeight: 1
          }
        });
        clusterMarkers.current.push(marker);
      });
    } catch (e) {
      if (currentFetchId === fetchCounter.current) setError(e.message);
    } finally {
      if (currentFetchId === fetchCounter.current) setLoading(false);
    }
  };

  // Fetch individual points, show advanced markers with PinElement
  const fetchIndividuals = async () => {
    const currentFetchId = ++fetchCounter.current;
    if (!map.current) return;

    const bounds = map.current.getBounds();
    if (!bounds) return;

    // Expand bounding box
    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();
    const dLat = ne.lat() - sw.lat();
    const dLng = ne.lng() - sw.lng();
    const minLat = sw.lat() - dLat;
    const minLon = sw.lng() - dLng;
    const maxLat = ne.lat() + dLat;
    const maxLon = ne.lng() + dLng;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/restaurants?min_lat=${minLat}&min_lon=${minLon}&max_lat=${maxLat}&max_lon=${maxLon}`
      );
      if (!res.ok) throw new Error("Failed to fetch individuals");
      const { restaurants } = await res.json();

      console.log("Fetched restaurants:", restaurants);
      if (currentFetchId !== fetchCounter.current) return;

      clearMarkers(individualMarkers);

      // Initialize InfoWindow if not already
      if (!infoWindowRef.current) {
        infoWindowRef.current = new google.maps.InfoWindow();
      }

      // Import advanced marker library
      const { AdvancedMarkerElement, PinElement } =
        await google.maps.importLibrary("marker");

      (restaurants || []).forEach((r) => {
        const lat = parseFloat(r.latitude);
        const lng = parseFloat(r.longitude);
        if (!isNaN(lat) && !isNaN(lng)) {
          const numericStatus = typeof r.status === "string"
            ? parseInt(r.status, 10)
            : r.status;

          const color = getStatusColor(numericStatus);

          // Create a pin with custom color
          const pin = new PinElement({
            background: color,
            borderColor: "transparent",
            glyphColor: "#ffffff",
            scale: 0.9
          });

          // Create advanced marker
          const advMarker = new AdvancedMarkerElement({
            map: map.current,
            position: { lat, lng },
            title: `Status: ${numericStatus}`,
            content: pin.element
          });

          // Make the cursor a pointer on hover
          advMarker.element.style.cursor = "pointer";

          // Grow slightly on hover
          advMarker.element.addEventListener("mouseover", () => {
            pin.scale = 1.1;
          });
          advMarker.element.addEventListener("mouseout", () => {
            pin.scale = 0.9;
          });

          // On click, show a custom InfoWindow
          advMarker.element.addEventListener("click", () => {
            // Build a dark-styled popup with more details
            const detailsHtml = `
              <div style="min-width:220px; color: #fff; background: #222; padding: 8px; border-radius: 4px;">
                <h3 style="margin:0; font-size:1rem; color:#ffd700;">
                  ${r.first_name || ""} ${r.last_name || ""}
                </h3>
                <p style="font-size:0.9rem; margin:2px 0;">
                  <strong>Address:</strong> ${r.address || ""} 
                  ${r.city ? ", " + r.city : ""} ${r.state || ""}
                </p>
                <p style="font-size:0.85rem; margin:2px 0;">
                  <strong>Phone:</strong> ${r.phone || "N/A"}
                </p>
                <p style="font-size:0.85rem; margin:2px 0;">
                  <strong>Status:</strong> ${numericStatus}
                </p>
                <hr style="border:none; border-bottom:1px solid #555; margin:6px 0;" />
                <p style="font-size:0.8rem; margin:0;">
                  <em>Last updated:</em> ${r.updated_at || "N/A"}
                </p>
              </div>
            `;
            infoWindowRef.current.setContent(detailsHtml);
            infoWindowRef.current.open({
              anchor: advMarker,
              map: map.current
            });
          });

          individualMarkers.current.push(advMarker);
        }
      });
      hasLoadedIndividuals.current = true;
    } catch (e) {
      if (currentFetchId === fetchCounter.current) setError(e.message);
    } finally {
      if (currentFetchId === fetchCounter.current) setLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        // Load Maps JS with advanced marker library
        if (!window.google) {
          await new Promise((resolve, reject) => {
            const s = document.createElement("script");
            s.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&v=weekly&libraries=geometry,drawing,marker`;
            s.async = true;
            s.defer = true;
            s.onload = resolve;
            s.onerror = reject;
            document.head.appendChild(s);
          });
        }

        // Initialize the map with an ID to use advanced markers (replace with your real map ID)
        map.current = new google.maps.Map(mapRef.current, {
          center: { lat: 39.5, lng: -98.35 },
          zoom: initialZoomLevel,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          gestureHandling: "greedy",
          mapId: "YOUR_MAP_ID"
        });

        // On first load
        google.maps.event.addListenerOnce(map.current, "idle", () => {
          fetchClusters(getMappedZoom(map.current.getZoom()));
          drawTerritories(initialTerritories);
        });

        // On zoom change
        map.current.addListener("zoom_changed", () => {
          const z = map.current.getZoom();
          if (hasLoadedIndividuals.current && z > ZOOM_THRESHOLD) return;

          google.maps.event.addListenerOnce(map.current, "idle", async () => {
            if (z >= ZOOM_THRESHOLD) {
              clearMarkers(clusterMarkers);
              await fetchIndividuals();
            } else {
              clearMarkers(individualMarkers);
              await fetchClusters(getMappedZoom(z));
            }
          });
        });
      } catch (err) {
        console.error("Google Maps failed to load:", err);
        setError("Google Maps failed to load.");
      }
    })();
  }, []);

  return (
    <div className="relative w-screen h-screen">
      <div ref={mapRef} className="w-full h-full" />
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="h-10 w-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      {error && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-red-500 text-white p-2 rounded">
          {error}
        </div>
      )}

      <Sidebar isExpanded={showSidebar} onToggle={setShowSidebar} />
      <Territory
        isExpanded={showTerritory}
        onToggle={setShowTerritory}
        territories={initialTerritories}
        map={map.current}
      />
      <FilterModal isExpanded={showFilter} onToggle={setShowFilter} />
      <AssignLeadsModal
        isExpanded={showAssign}
        onToggle={setShowAssign}
        polygon={null}
      />
      <Toolbar
        onPan={() => setShowSidebar(!showSidebar)}
        onFilterLeads={() => setShowFilter(!showFilter)}
        onToggleTerritoryMode={() => setShowTerritory(!showTerritory)}
        onAssignLeads={() => setShowAssign(!showAssign)}
        onCreateLead={() => {}}
      />
    </div>
  );
}
