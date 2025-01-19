"use client";

import { useEffect, useState, useRef } from "react";
import { createClient as createSupabaseClient } from "@/utils/supabase/client";
import { createClient as createSupabaseAnonClient } from "@supabase/supabase-js";

const ZOOM_THRESHOLD = 12;
const DEFAULT_COLOR = "#FF0000";

const supabaseAnon = createSupabaseAnonClient(
  "https://bdjxxtvhbfqgnwbuhzfo.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJkanh4dHZoYmZxZ253YnVoemZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQ1NTg2NjUsImV4cCI6MjA1MDEzNDY2NX0.n3lB7-JQAkrV06-RJ8vBTb019tWElhEw-iGis4Qla5U"
);

export default function Territory({ isExpanded = true, territories = [], onToggle, map }) {
  const supabase = createSupabaseClient();

  const [displayTerritories, setDisplayTerritories] = useState([]);
  const [isAdding, setIsAdding] = useState(false);
  const [territoryName, setTerritoryName] = useState("");
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTerritory, setSelectedTerritory] = useState(null);
  const [addMode, setAddMode] = useState("draw");
  const [zipCodeQuery, setZipCodeQuery] = useState("");
  const [polygonCoordinates, setPolygonCoordinates] = useState([]);

  const territoryPolygonsRef = useRef([]);
  const individualMarkersRef = useRef([]);
  const zoomListenerRef = useRef(null);
  const drawingManagerRef = useRef(null);
  const drawnPolygonRef = useRef(null);

  useEffect(() => setDisplayTerritories(territories), [territories]);

  useEffect(() => {
    if (drawingManagerRef.current) {
      drawingManagerRef.current.setOptions({ polygonOptions: polygonOptions(color, true) });
    }
    if (drawnPolygonRef.current) {
      drawnPolygonRef.current.setOptions({ fillColor: color, strokeColor: color });
    }
  }, [color]);

  useEffect(() => {
    if (map && !isAdding) drawAllTerritories();
  }, [displayTerritories, isAdding, map]);

  useEffect(() => {
    if (isAdding && addMode === "draw") startDrawingMode();
    else if (!isAdding) stopDrawingMode(false);
  }, [isAdding, addMode]);

  function polygonOptions(c, editable) {
    return {
      fillColor: c,
      fillOpacity: 0.35,
      strokeColor: c,
      strokeOpacity: 0.8,
      strokeWeight: 2,
      editable
    };
  }

  function clearMarkers() {
    individualMarkersRef.current.forEach(m => m.setMap(null));
    individualMarkersRef.current = [];
  }

  function removeZoomListener() {
    if (zoomListenerRef.current) {
      google.maps.event.removeListener(zoomListenerRef.current);
      zoomListenerRef.current = null;
    }
  }

  function clearTerritoryPolygons() {
    territoryPolygonsRef.current.forEach(p => p.setMap(null));
    territoryPolygonsRef.current = [];
  }

  function drawAllTerritories() {
    if (!map) return;
    clearTerritoryPolygons();
    displayTerritories.forEach(t => {
      if (!t.geom || !t.geom.coordinates) return;
      const coords = t.geom.coordinates[0].map(([lng, lat]) => ({ lat, lng }));
      const polygon = new google.maps.Polygon({
        paths: coords,
        fillColor: t.color || DEFAULT_COLOR,
        fillOpacity: 0.35,
        strokeColor: t.color || DEFAULT_COLOR,
        strokeOpacity: 0.8,
        strokeWeight: 2,
        editable: false,
        map
      });
      territoryPolygonsRef.current.push(polygon);
    });
  }

  async function fetchIndividualsForCurrentBounds(expansionFactor = 3) {
    if (!map) return;
    const bounds = map.getBounds();
    if (!bounds) return;
    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();
    const dLat = ne.lat() - sw.lat();
    const dLng = ne.lng() - sw.lng();
    const minLat = sw.lat() - dLat * (expansionFactor - 1);
    const minLon = sw.lng() - dLng * (expansionFactor - 1);
    const maxLat = ne.lat() + dLat * (expansionFactor - 1);
    const maxLon = ne.lng() + dLng * (expansionFactor - 1);

    try {
      const res = await fetch(`/api/restaurants?min_lat=${minLat}&min_lon=${minLon}&max_lat=${maxLat}&max_lon=${maxLon}`);
      if (!res.ok) throw new Error("Failed to fetch individuals");
      const { restaurants } = await res.json();
      clearMarkers();
      (restaurants || []).forEach(r => {
        const lat = parseFloat(r.latitude), lng = parseFloat(r.longitude);
        if (!isNaN(lat) && !isNaN(lng)) {
          individualMarkersRef.current.push(new google.maps.Marker({ position: { lat, lng }, map }));
        }
      });
      removeZoomListener();
      zoomListenerRef.current = google.maps.event.addListener(map, "zoom_changed", () => {
        if (map.getZoom() < ZOOM_THRESHOLD) {
          clearMarkers();
          removeZoomListener();
        }
      });
    } catch (err) {
      console.error("Error fetching individuals:", err);
    }
  }

  function handleTerritoryClick(territory) {
    setSelectedTerritory(territory);
    if (!map || !territory.geom || !territory.geom.coordinates) return;
    const bounds = new google.maps.LatLngBounds();
    territory.geom.coordinates[0].forEach(([lng, lat]) => bounds.extend({ lat, lng }));
    map.fitBounds(bounds);

    google.maps.event.addListenerOnce(map, "idle", async () => {
      const z = map.getZoom();
      if (z >= ZOOM_THRESHOLD) await fetchIndividualsForCurrentBounds(3);
      else clearMarkers();
    });
  }

  function cancelAdd() {
    setIsAdding(false);
    setPolygonCoordinates([]);
    setTerritoryName("");
    setColor(DEFAULT_COLOR);
    setZipCodeQuery("");
    stopDrawingMode(true);
  }

  async function saveNewTerritory() {
    if (!territoryName.trim()) {
      alert("Please provide a territory name.");
      return;
    }
    if (!polygonCoordinates || polygonCoordinates.length < 3) {
      alert("Please draw or provide a valid polygon.");
      return;
    }

    const newTempId = `temp-${Date.now()}`;
    const newTerritory = {
      id: newTempId,
      name: territoryName,
      color,
      geom: { type: 'Polygon', coordinates: [polygonCoordinates.map(coord => [coord.lng, coord.lat])] }
    };
    setDisplayTerritories(prev => [...prev, newTerritory]);

    try {
      const body = {
        name: territoryName,
        color,
        coordinates: polygonCoordinates
      };
      if (addMode === "zip" && zipCodeQuery.trim()) body.zipCode = zipCodeQuery.trim();

      const res = await fetch("/api/saveTerritory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        const data = await res.json();
        console.error("Failed to save territory:", data);
        alert("Failed to save territory.");
        setDisplayTerritories(prev => prev.filter(t => t.id !== newTempId));
        return;
      }

      const { data } = await res.json();
      if (data && data.length > 0) {
        const finalTerritory = data[0];
        setDisplayTerritories(prev => prev.map(t => t.id === newTempId ? finalTerritory : t));
        setSelectedTerritory(finalTerritory);
        if (drawnPolygonRef.current) {
          drawnPolygonRef.current.setMap(null);
          drawnPolygonRef.current = null;
        }
      }

      alert("Territory saved successfully.");
      setIsAdding(false);
      setPolygonCoordinates([]);
      stopDrawingMode(true);
    } catch (err) {
      console.error("Error saving territory:", err);
      alert("Error saving territory.");
    }
  }

  function startDrawingMode() {
    if (!map || !google?.maps?.drawing) return;
    stopDrawingMode(true);
    drawingManagerRef.current = new google.maps.drawing.DrawingManager({
      drawingMode: google.maps.drawing.OverlayType.POLYGON,
      drawingControl: false,
      polygonOptions: polygonOptions(color, true)
    });
    drawingManagerRef.current.setMap(map);
    google.maps.event.addListener(drawingManagerRef.current, 'overlaycomplete', (e) => {
      if (e.type === google.maps.drawing.OverlayType.POLYGON) {
        if (drawnPolygonRef.current) drawnPolygonRef.current.setMap(null);
        drawnPolygonRef.current = e.overlay;
        drawingManagerRef.current.setDrawingMode(null);
        updatePolygonCoordinates();
        attachPolygonListeners(drawnPolygonRef.current);
      }
    });
  }

  function attachPolygonListeners(polygon) {
    const path = polygon.getPath();
    google.maps.event.addListener(path, 'set_at', updatePolygonCoordinates);
    google.maps.event.addListener(path, 'insert_at', updatePolygonCoordinates);
    google.maps.event.addListener(path, 'remove_at', updatePolygonCoordinates);
  }

  function stopDrawingMode(removePolygon) {
    if (drawingManagerRef.current) {
      drawingManagerRef.current.setMap(null);
      drawingManagerRef.current = null;
    }
    if (removePolygon && drawnPolygonRef.current) {
      drawnPolygonRef.current.setMap(null);
      drawnPolygonRef.current = null;
    }
  }

  function updatePolygonCoordinates() {
    if (!drawnPolygonRef.current) return;
    const path = drawnPolygonRef.current.getPath();
    const coords = [];
    for (let i = 0; i < path.getLength(); i++) {
      const latLng = path.getAt(i);
      coords.push({ lat: latLng.lat(), lng: latLng.lng() });
    }
    setPolygonCoordinates(coords);
  }

  // Parse the WKT POLYGON string into an array of {lat, lng}
  function parseWktPolygon(wkt) {
    const inner = wkt.replace(/^POLYGON\s*\(\(|\)\)$/g, '');
    return inner.split(',').map(pair => {
      const [lng, lat] = pair.trim().split(/\s+/).map(Number);
      return { lat, lng };
    });
  }

  async function handleZipSearch() {
    if (!zipCodeQuery.trim()) {
      alert("Please enter a zip code.");
      return;
    }

    try {
      const { data, error } = await supabaseAnon
        .from('zctas')
        .select('*')
        .eq('ZCTA5CE20', zipCodeQuery.trim())
        .single();

      if (error || !data) {
        console.error("No polygon found for that zip code:", error);
        alert("No polygon found for that zip code.");
        return;
      }

      if (!data.geometry || !data.geometry.startsWith("POLYGON")) {
        alert("No valid polygon found for that zip code.");
        return;
      }

      const poly = parseWktPolygon(data.geometry);
      if (!poly || poly.length < 3) {
        alert("Polygon not valid for that zip code.");
        return;
      }

      setPolygonCoordinates(poly);
      if (drawnPolygonRef.current) drawnPolygonRef.current.setMap(null);
      if (map) {
        drawnPolygonRef.current = new google.maps.Polygon({
          ...polygonOptions(color, true),
          paths: poly,
          map
        });
        attachPolygonListeners(drawnPolygonRef.current);
      }
    } catch (err) {
      console.error("Error searching zip code:", err);
      alert("Error searching zip code.");
    }
  }

  const filteredTerritories = displayTerritories.filter((t) =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div
      className={`fixed z-50 right-4 top-4 bg-gray-900 text-white rounded-lg shadow-lg transition-all duration-300 flex flex-col ${
        isExpanded ? "w-80" : "w-0"
      }`}
      style={{ height: "90vh" }}
    >
      {isExpanded ? (
        <>
          <div className="flex items-center justify-between p-4">
            <h2 className="text-lg font-semibold">
              {selectedTerritory
                ? selectedTerritory.name
                : isAdding
                ? "Add New Territory"
                : "Territory Management"}
            </h2>
            <button onClick={() => onToggle && onToggle(false)} className="p-1 hover:bg-gray-700 rounded">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M10 8.586L15.95 2.636l1.414 1.414L11.414 10l5.95 5.95-1.414 1.414L10 11.414l-5.95 5.95-1.414-1.414L8.586 10 2.636 4.05l1.414-1.414L10 8.586z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>
          <div className="border-t border-gray-700"></div>
          <div className="p-4 flex-1 overflow-y-auto scroll-container">
            {selectedTerritory ? (
              <div className="space-y-4">
                <button onClick={() => setSelectedTerritory(null)} className="flex items-center text-gray-300 hover:text-white">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                  </svg>
                  Back to List
                </button>
                <div>
                  <h3 className="text-md font-medium">Details for {selectedTerritory.name}</h3>
                  <p className="text-sm text-gray-400">Stats and other info about this territory.</p>
                </div>
              </div>
            ) : isAdding ? (
              <div className="p-4 space-y-4">
                <h3 className="text-md font-medium">Add New Territory</h3>
                <div className="flex space-x-2">
                  <button
                    onClick={() => setAddMode("draw")}
                    className={`px-3 py-1 rounded text-white ${addMode === "draw" ? "bg-blue-600" : "bg-gray-700 hover:bg-gray-600"}`}
                  >
                    Draw
                  </button>
                  <button
                    onClick={() => setAddMode("zip")}
                    className={`px-3 py-1 rounded text-white ${addMode === "zip" ? "bg-blue-600" : "bg-gray-700 hover:bg-gray-600"}`}
                  >
                    Zip Code
                  </button>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300">Territory Name</label>
                  <input
                    type="text"
                    value={territoryName}
                    onChange={(e) => setTerritoryName(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 bg-gray-800 text-white border border-gray-700 rounded-md"
                    placeholder="Enter territory name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300">Territory Color</label>
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="mt-1 block w-full h-10 p-0 border-0"
                  />
                </div>

                {addMode === "zip" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-300">Zip Code</label>
                    <div className="flex space-x-2 mt-1">
                      <input
                        type="text"
                        value={zipCodeQuery}
                        onChange={(e) => setZipCodeQuery(e.target.value)}
                        className="flex-1 px-3 py-2 bg-gray-800 text-white border border-gray-700 rounded-md"
                        placeholder="Enter zip code"
                      />
                      <button onClick={handleZipSearch} className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-500">
                        Search
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex justify-end space-x-2">
                  <button onClick={cancelAdd} className="px-3 py-1 bg-gray-700 text-white rounded hover:bg-gray-600">
                    Cancel
                  </button>
                  <button onClick={saveNewTerritory} className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-500">
                    Save
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col space-y-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-md font-medium">Existing Territories</h3>
                  <button
                    onClick={() => {
                      onToggle && onToggle(true);
                      setIsAdding(true);
                      setSelectedTerritory(null);
                      clearMarkers();
                      removeZoomListener();
                      setAddMode("draw");
                      setColor(DEFAULT_COLOR);
                    }}
                    className="px-2 py-1 bg-green-500 text-white rounded hover:bg-green-400 text-sm"
                  >
                    Add
                  </button>
                </div>
                <div>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search territories..."
                    className="w-full px-3 py-2 bg-gray-800 text-white border border-gray-700 rounded-md"
                  />
                </div>
                {filteredTerritories.length > 0 ? (
                  <ul className="space-y-3">
                    {filteredTerritories.map((territory) => (
                      <li
                        key={territory.id}
                        className="flex items-center justify-between p-2 bg-gray-800 rounded cursor-pointer hover:bg-gray-700"
                        onClick={() => {
                          clearMarkers();
                          removeZoomListener();
                          handleTerritoryClick(territory);
                        }}
                      >
                        <div className="flex items-center">
                          <span className="w-4 h-4 rounded-full mr-2" style={{ backgroundColor: territory.color }}></span>
                          <span>{territory.name}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-gray-400 text-sm">No territories found.</p>
                )}
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="flex items-center p-4 hover:bg-gray-800 cursor-pointer" onClick={() => onToggle && onToggle(true)}>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" stroke="currentColor">
            <path d="M..." />
          </svg>
          <span className="ml-2 text-sm">Territory</span>
        </div>
      )}
      <style jsx>{`
        .scroll-container::-webkit-scrollbar {
          width: 6px;
        }
        .scroll-container::-webkit-scrollbar-track {
          background: #1f2937;
        }
        .scroll-container::-webkit-scrollbar-thumb {
          background: #374151;
          border-radius: 3px;
        }
        .scroll-container:hover::-webkit-scrollbar-thumb {
          background: #4b5563;
        }
      `}</style>
    </div>
  );
}
