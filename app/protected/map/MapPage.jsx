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
  initialTerritories = [],
}) {
  const supabase = createClient();
  const mapRef = useRef(null);
  const map = useRef(null);

  // cluster and individual markers
  const clusterMarkers = useRef([]);
  const individualMarkers = useRef([]);

  const infoWindowRef = useRef(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const hasLoadedIndividuals = useRef(false);
  const fetchCounter = useRef(0);

  const [showTerritory, setShowTerritory] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);

  // For "Assign Leads" polygon drawing
  const [isAssigning, setIsAssigning] = useState(false);
  const drawingManagerRef = useRef(null);
  const [assignPolygon, setAssignPolygon] = useState(null);

  // Track whether we’re in satellite view or not
  const [isSatelliteView, setIsSatelliteView] = useState(false);

  // Helper to toggle satellite/roadmap
  function handleToggleSatelliteView() {
    if (!map.current) return;
    if (isSatelliteView) {
      map.current.setMapTypeId("roadmap");
      setIsSatelliteView(false);
    } else {
      map.current.setMapTypeId("satellite");
      setIsSatelliteView(true);
    }
  }

  // Clear an array of markers
  const clearMarkers = (ref) => {
    ref.current.forEach((m) => {
      if (m instanceof google.maps.Marker) {
        m.setMap(null);
      } else if (m.map) {
        m.map = null;
      }
    });
    ref.current = [];
  };

  // Simplify zoom -> cluster zoom
  const getMappedZoom = (z) => {
    if (z >= 12) return 10;
    if (z >= 11) return 9;
    if (z >= 10) return 8;
    if (z >= 8) return 6;
    if (z >= 3) return 5;
    return Math.round(z);
  };

  // fetch cluster points
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
        p_max_lon: max_lon,
      });
      if (error) throw error;
      if (currentFetchId !== fetchCounter.current) return;

      clearMarkers(clusterMarkers);
      (data || []).forEach((c) => {
        const lat = parseFloat(c.latitude);
        const lng = parseFloat(c.longitude);
        if (isNaN(lat) || isNaN(lng)) return;

        const minScale = 20;
        const maxScale = 50;
        const normalized = Math.min(1, Math.max(0, (c.count - 1) / 999));
        const scale = minScale + normalized * (maxScale - minScale);

        const marker = new google.maps.Marker({
          position: { lat, lng },
          map: map.current,
          label: {
            text: String(c.count),
            color: "white",
            fontSize: "12px",
            fontWeight: "bold",
          },
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            fillColor: "#007bff",
            fillOpacity: 0.6,
            scale,
            strokeColor: "#fff",
            strokeWeight: 1,
          },
        });
        clusterMarkers.current.push(marker);
      });
    } catch (e) {
      if (currentFetchId === fetchCounter.current) setError(e.message);
    } finally {
      if (currentFetchId === fetchCounter.current) setLoading(false);
    }
  };

  // fetch individual restaurants
  const fetchIndividuals = async () => {
    const currentFetchId = ++fetchCounter.current;
    if (!map.current) return;

    const bounds = map.current.getBounds();
    if (!bounds) return;

    // expand bounding box
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

      if (currentFetchId !== fetchCounter.current) return;

      clearMarkers(individualMarkers);

      if (!infoWindowRef.current) {
        infoWindowRef.current = new google.maps.InfoWindow();
      }

      const { AdvancedMarkerElement, PinElement } =
        await google.maps.importLibrary("marker");

      (restaurants || []).forEach((r) => {
        const lat = parseFloat(r.latitude);
        const lng = parseFloat(r.longitude);
        if (!isNaN(lat) && !isNaN(lng)) {
          const numericStatus =
            typeof r.status === "string" ? parseInt(r.status, 10) : r.status;
          const color = getStatusColor(numericStatus);

          // Create a pin with custom color
          const pin = new PinElement({
            background: color,
            borderColor: "transparent",
            glyphColor: "#ffffff",
            scale: 0.9,
          });

          const advMarker = new AdvancedMarkerElement({
            map: map.current,
            position: { lat, lng },
            title: `Status: ${numericStatus}`,
            content: pin.element,
          });

          advMarker.element.style.cursor = "pointer";
          advMarker.element.addEventListener("mouseover", () => {
            pin.scale = 1.1;
          });
          advMarker.element.addEventListener("mouseout", () => {
            pin.scale = 0.9;
          });

          advMarker.element.addEventListener("click", () => {
            const detailsHtml = `
              <div style="min-width:220px; color:#fff; background:#222; padding:8px; border-radius:4px;">
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
              map: map.current,
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

  // map init
  useEffect(() => {
    (async () => {
      try {
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

        map.current = new google.maps.Map(mapRef.current, {
          center: { lat: 39.5, lng: -98.35 },
          zoom: initialZoomLevel,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          gestureHandling: "greedy",
          mapId: "YOUR_MAP_ID",
        });

        // first load
        google.maps.event.addListenerOnce(map.current, "idle", () => {
          fetchClusters(getMappedZoom(map.current.getZoom()));
        });

        // handle zoom changes
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // handle toggling the "assign leads" mode
  function handleAssignLeads() {
    setShowAssign(!showAssign);
    setIsAssigning(!showAssign);
  }

  // set up or tear down drawing manager for assigning leads
  useEffect(() => {
    if (!map.current) return;
    if (isAssigning) {
      if (!google?.maps?.drawing) return;
      drawingManagerRef.current = new google.maps.drawing.DrawingManager({
        drawingMode: google.maps.drawing.OverlayType.POLYGON,
        drawingControl: false,
        polygonOptions: {
          fillColor: "#FF9800",
          fillOpacity: 0.35,
          strokeColor: "#FF9800",
          strokeWeight: 2,
          editable: true,
        },
      });
      drawingManagerRef.current.setMap(map.current);

      google.maps.event.addListener(
        drawingManagerRef.current,
        "overlaycomplete",
        (e) => {
          if (e.type === google.maps.drawing.OverlayType.POLYGON) {
            if (assignPolygon) {
              assignPolygon.setMap(null);
            }
            setAssignPolygon(e.overlay);
            drawingManagerRef.current.setDrawingMode(null);
          }
        }
      );
    } else {
      // Turn off polygon mode
      if (drawingManagerRef.current) {
        drawingManagerRef.current.setMap(null);
        drawingManagerRef.current = null;
      }
      // Optionally remove leftover polygon
      if (assignPolygon) {
        assignPolygon.setMap(null);
        setAssignPolygon(null);
      }
    }
  }, [isAssigning, assignPolygon]);

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

      {/* Pass new props to Sidebar for satellite toggle */}
      <Sidebar
        isExpanded={showSidebar}
        onToggle={setShowSidebar}
        onToggleSatelliteView={handleToggleSatelliteView}
        isSatelliteView={isSatelliteView}
      />
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
        polygon={assignPolygon}
        onAssignSuccess={() => {
          console.log("Assign success!");
          // Turn off polygon mode so the cursor goes back to normal
          setIsAssigning(false);
        }}
      />

      <Toolbar
        onPan={() => setShowSidebar(!showSidebar)}
        onFilterLeads={() => setShowFilter(!showFilter)}
        onToggleTerritoryMode={() => setShowTerritory(!showTerritory)}
        onAssignLeads={handleAssignLeads}
        onCreateLead={() => {}}
      />
    </div>
  );
}
