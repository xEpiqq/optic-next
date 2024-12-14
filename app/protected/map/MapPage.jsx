"use client";

import { useEffect, useRef, useState } from "react";
import CollapsibleSidebar from "@/components/Sidebar";
import TerritoryModal from "@/components/Territory";
import AssignLeadsModal from "@/components/AssignLeadsModal";
import Toolbar from "@/components/Toolbar";
import FilterModal from "@/components/FilterModal";
import debounce from "lodash/debounce";
import { createClient } from "@/utils/supabase/client";

export default function MapPage({ initialClusters = [], initialZoomLevel = 5, initialTerritories = [] }) {
  const supabase = createClient();
  
  const mapRef = useRef(null);
  const [map, setMap] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const [territories, setTerritories] = useState(initialTerritories);
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [territoryModalExpanded, setTerritoryModalExpanded] = useState(false);
  const [assignLeadsModalExpanded, setAssignLeadsModalExpanded] = useState(false);
  const [filterModalExpanded, setFilterModalExpanded] = useState(false);
  const [filters, setFilters] = useState([]);

  const [selectedPolygon, setSelectedPolygon] = useState(null);
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [selectedColor, setSelectedColor] = useState('#FF0000');

  const [clustersCache] = useState(new Map());
  const [polygons, setPolygons] = useState([]);
  const [clusterMarkers, setClusterMarkers] = useState([]);
  const [individualMarkers, setIndividualMarkers] = useState([]);
  const [drawingManager, setDrawingManager] = useState(null);
  const [infoWindow, setInfoWindow] = useState(null);
  const [isDisplayingIndividualMarkers, setIsDisplayingIndividualMarkers] = useState(false);
  const [individualMarkersCache, setIndividualMarkersCache] = useState([]);
  const [isAssignLeadsFlow, setIsAssignLeadsFlow] = useState(false);
  const [isAssignLeadsMode, setIsAssignLeadsMode] = useState(false);

  const ZOOM_THRESHOLD = 12;
  const [effectiveZoomLevel, setEffectiveZoomLevel] = useState(null);
  const previewPolygon = useRef(null);

  useEffect(() => {
    // Load Google Maps script first
    loadGoogleMaps(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY)
      .then(() => {
        initializeMap();
      })
      .catch((error) => {
        console.error("Error loading Google Maps:", error);
        setErrorMessage("Failed to load Google Maps. Please try again later.");
      });
  }, []);

  useEffect(() => {
    if (map && window.google) {
      setupDrawingManager();
      renderExistingTerritories(territories);

      // Once map is idle initially, fetch either clusters or markers
      window.google.maps.event.addListenerOnce(map, 'idle', async () => {
        const currentZoom = map.getZoom();
        if (currentZoom >= ZOOM_THRESHOLD) {
          await fetchIndividualMarkers();
          setIsDisplayingIndividualMarkers(true);
        } else {
          await fetchClusters(getMappedZoomLevel(currentZoom));
        }
      });
    }
  }, [map]);

  useEffect(() => {
    if (drawingManager && window.google) {
      setIsDrawingMode(drawingManager.getDrawingMode() === window.google.maps.drawing.OverlayType.POLYGON);
    }
  }, [drawingManager]);

  function loadGoogleMaps(key) {
    return new Promise((resolve, reject) => {
      if (typeof window === 'undefined') {
        reject(new Error("Window is undefined."));
        return;
      }
      if (window.google && window.google.maps) {
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=drawing,geometry`;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = (e) => reject(e);
      document.head.appendChild(script);
    });
  }

  function initializeMap() {
    if (!window.google) {
      setErrorMessage("Google Maps failed to load.");
      return;
    }
    if (!mapRef.current) {
      setErrorMessage("Map container not found.");
      return;
    }

    const options = {
      center: { lat: 39.50, lng: -98.35 },
      zoom: initialZoomLevel,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      zoomControl: false,
    };
    const m = new window.google.maps.Map(mapRef.current, options);
    setMap(m);
    m.addListener('idle', handleMapIdle);
  }

  function setupDrawingManager() {
    if (!map || !window.google) return;

    const manager = new window.google.maps.drawing.DrawingManager({
      drawingMode: null,
      drawingControl: false,
      polygonOptions: {
        fillColor: selectedColor,
        fillOpacity: 0.35,
        strokeColor: selectedColor,
        strokeOpacity: 0.8,
        strokeWeight: 2,
        clickable: false,
        editable: false,
        zIndex: 1,
      },
    });
    manager.setMap(map);
    setDrawingManager(manager);

    window.google.maps.event.addListener(manager, 'polygoncomplete', (polygon) => {
      setSelectedPolygon(polygon);
      previewPolygon.current = polygon;
      polygon.setOptions({ fillColor: selectedColor, strokeColor: selectedColor });

      if (isAssignLeadsFlow) {
        setAssignLeadsModalExpanded(true);
        setIsAssignLeadsFlow(false);
        setIsAssignLeadsMode(true);
        manager.setDrawingMode(null);
      } else {
        setTerritoryModalExpanded(true);
        manager.setDrawingMode(null);
      }
    });
  }

  function renderExistingTerritories(territories) {
    if (!map || !window.google) return;
    const newPolygons = [];
    for (const territory of territories) {
      const geom = territory.geom;
      const color = territory.color || "#FF0000";
      if (!geom || geom.type !== 'Polygon') continue;

      const path = geom.coordinates[0]
        .map(coord => {
          const lat = parseFloat(coord[1]);
          const lng = parseFloat(coord[0]);
          return isNaN(lat) || isNaN(lng) ? null : new window.google.maps.LatLng(lat, lng);
        })
        .filter(Boolean);

      if (path.length === 0) continue;

      const polygon = new window.google.maps.Polygon({
        paths: path,
        strokeColor: color,
        strokeOpacity: 0.8,
        strokeWeight: 2,
        fillColor: color,
        fillOpacity: 0.35,
      });

      polygon.setMap(map);
      newPolygons.push(polygon);
    }
    setPolygons((prev) => [...prev, ...newPolygons]);
  }

  function getMappedZoomLevel(zoom) {
    if (zoom >= 11) return 9;
    if (zoom >= 10) return 8;
    if (zoom >= 8) return 6;
    if (zoom >= 3) return 5;
    return Math.round(zoom);
  }

  function expandBounds(bounds, factor) {
    const ne = bounds.getNorthEast();
    const sw = bounds.getSouthWest();
    const latSpan = ne.lat() - sw.lat();
    const lngSpan = ne.lng() - sw.lng();
    const expandedNE = new window.google.maps.LatLng(ne.lat() + latSpan * (factor - 1), ne.lng() + lngSpan * (factor - 1));
    const expandedSW = new window.google.maps.LatLng(sw.lat() - latSpan * (factor - 1), sw.lng() - lngSpan * (factor - 1));
    return new window.google.maps.LatLngBounds(expandedSW, expandedNE);
  }

  async function fetchClusters(zoomLevel) {
    if (!map) return;
    const bounds = map.getBounds();
    if (!bounds) return;

    const expansionFactor = 2;
    const expandedBounds = expandBounds(bounds, expansionFactor);
    const isZoomLevel5 = zoomLevel === 5;
    const cacheKey = isZoomLevel5 ? `zoom_${zoomLevel}_all`
      : `zoom_${zoomLevel}_sw_${expandedBounds.getSouthWest().lat().toFixed(4)}_${expandedBounds.getSouthWest().lng().toFixed(4)}_ne_${expandedBounds.getNorthEast().lat().toFixed(4)}_${expandedBounds.getNorthEast().lng().toFixed(4)}`;

    if (clustersCache.has(cacheKey)) {
      addClusterMarkers(clustersCache.get(cacheKey));
      return;
    }

    const min_lat = isZoomLevel5 ? null : expandedBounds.getSouthWest().lat();
    const min_lon = isZoomLevel5 ? null : expandedBounds.getSouthWest().lng();
    const max_lat = isZoomLevel5 ? null : expandedBounds.getNorthEast().lat();
    const max_lon = isZoomLevel5 ? null : expandedBounds.getNorthEast().lng();

    try {
      setIsLoading(true);
      const { data, error } = await supabase.rpc('get_cached_clusters', {
        p_zoom_level: zoomLevel,
        p_min_lat: min_lat,
        p_min_lon: min_lon,
        p_max_lat: max_lat,
        p_max_lon: max_lon
      });
      if (error) throw error;

      const clusters = data || [];
      clustersCache.set(cacheKey, clusters);
      addClusterMarkers(clusters);
      setErrorMessage(null);
    } catch (error) {
      console.error("Error fetching clusters:", error);
      setErrorMessage("Failed to load clusters.");
    } finally {
      setIsLoading(false);
    }
  }

  function addClusterMarkers(clusters) {
    clearClusterMarkers();
    if (!map || !window.google) return;

    const newMarkers = clusters.map(cluster => {
      const lat = parseFloat(cluster.latitude);
      const lng = parseFloat(cluster.longitude);
      if (isNaN(lat) || isNaN(lng)) return null;

      const marker = new window.google.maps.Marker({
        position: { lat, lng },
        map,
        title: `Cluster of ${cluster.count}`,
        label: {
          text: String(cluster.count),
          color: 'white',
          fontSize: '12px',
          fontWeight: 'bold',
        },
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          fillColor: '#007bff',
          fillOpacity: 0.6,
          scale: calculateMarkerScale(cluster.count),
          strokeColor: '#fff',
          strokeWeight: 1,
        },
      });
      marker.addListener('click', () => {
        map.setZoom(map.getZoom() + 2);
        map.setCenter(marker.getPosition());
      });
      return marker;
    }).filter(Boolean);

    setClusterMarkers(newMarkers);
  }

  function calculateMarkerScale(count) {
    const minScale = 20, maxScale = 50;
    const normalized = Math.min(1, Math.max(0, (count - 1) / 999));
    return minScale + normalized * (maxScale - minScale);
  }

  function clearClusterMarkers() {
    clusterMarkers.forEach(m => m.setMap(null));
    setClusterMarkers([]);
  }

  async function fetchIndividualMarkers() {
    if (!map || !window.google) return;
    const bounds = map.getBounds();
    if (!bounds) return;

    const expandedBounds = expandBounds(bounds, 3);
    const min_lat = expandedBounds.getSouthWest().lat();
    const min_lon = expandedBounds.getSouthWest().lng();
    const max_lat = expandedBounds.getNorthEast().lat();
    const max_lon = expandedBounds.getNorthEast().lng();
    if ([min_lat, min_lon, max_lat, max_lon].some(isNaN)) {
      setErrorMessage('Invalid map bounds.');
      return;
    }

    if (isWithinCachedBounds(bounds)) {
      setIsDisplayingIndividualMarkers(true);
      return;
    }

    try {
      setIsLoading(true);
      let query = supabase
        .from('restaurants_with_latlng')
        .select('id, address, user_id, latitude, longitude')
        .lte('latitude', max_lat)
        .gte('latitude', min_lat)
        .lte('longitude', max_lon)
        .gte('longitude', min_lon);

      const operatorMap = {
        '=': 'eq',
        '!=': 'neq',
        '>': 'gt',
        '<': 'lt',
        '>=': 'gte',
        '<=': 'lte',
        'LIKE': 'like'
      };

      for (const filter of filters) {
        const { column, operator, value } = filter;
        const supabaseOperator = operatorMap[operator];
        if (!column || !supabaseOperator || value === undefined) {
          continue;
        }
        query = query[supabaseOperator](column, value);
      }

      const { data: restaurants, error } = await query;
      if (error) throw error;

      clearIndividualMarkers();
      if (!infoWindow) setInfoWindow(new window.google.maps.InfoWindow());

      const newMarkers = restaurants.map(r => {
        const lat = parseFloat(r.latitude);
        const lng = parseFloat(r.longitude);
        if (isNaN(lat) || isNaN(lng)) return null;

        const isAssigned = r.restaurant_user_id !== null && r.restaurant_user_id !== undefined;
        const markerIcon = isAssigned
          ? {
              path: window.google.maps.SymbolPath.CIRCLE,
              fillColor: '#0000FF',
              fillOpacity: 0.8,
              scale: 8,
              strokeColor: '#FFFFFF',
              strokeWeight: 2,
            }
          : null;

        const marker = new window.google.maps.Marker({
          position: { lat, lng },
          map,
          title: String(r.id),
          icon: markerIcon,
        });

        if (isAssignLeadsMode && isAssigned) {
          marker.addListener('click', () => {
            const contentString = `<div>
              <h3>Restaurant ID: ${r.id}</h3>
              <p>Assigned to: ${r.restaurant_user_id}</p>
            </div>`;
            infoWindow.setContent(contentString);
            infoWindow.open(map, marker);
          });
        }
        return marker;
      }).filter(Boolean);

      setIndividualMarkers(newMarkers);
      addToCache(bounds);
      setIsDisplayingIndividualMarkers(true);
      setErrorMessage(null);
    } catch (error) {
      console.error('Error fetching individual markers:', error);
      setErrorMessage('Failed to load individual markers.');
    } finally {
      setIsLoading(false);
    }
  }

  function clearIndividualMarkers() {
    individualMarkers.forEach(m => m.setMap(null));
    setIndividualMarkers([]);
  }

  function isWithinCachedBounds(currentBounds) {
    return individualMarkersCache.some(
      cachedBounds =>
        cachedBounds.contains(currentBounds.getSouthWest()) &&
        cachedBounds.contains(currentBounds.getNorthEast())
    );
  }

  function addToCache(newBounds) {
    setIndividualMarkersCache(prev => [...prev, newBounds]);
  }

  const handleMapIdle = debounce(async () => {
    if (!map) return;
    const newZoomLevel = map.getZoom();

    if (newZoomLevel >= ZOOM_THRESHOLD) {
      const bounds = map.getBounds();
      if (!bounds) return;
      if (isWithinCachedBounds(bounds)) {
        setIsDisplayingIndividualMarkers(true);
        return;
      }
      if (!isDisplayingIndividualMarkers) {
        await fetchIndividualMarkers();
        clearClusterMarkers();
      }
    } else {
      const newEffectiveZoomLevel = getMappedZoomLevel(newZoomLevel);
      if (effectiveZoomLevel !== newEffectiveZoomLevel) {
        await fetchClusters(newEffectiveZoomLevel);
        setEffectiveZoomLevel(newEffectiveZoomLevel);
        setIsDisplayingIndividualMarkers(false);
        clearIndividualMarkers();
        setIndividualMarkersCache([]);
      }
    }
  }, 500);

  function handleSidebarToggle(isExpanded) {
    setSidebarExpanded(isExpanded);
  }

  function handlePan() {
    if (map) map.setOptions({ draggable: true });
  }

  function handleFilterLeads() {
    setFilterModalExpanded(true);
  }

  async function handleApplyFilters(newFilters) {
    setFilters(newFilters);
    if (map && map.getZoom() >= ZOOM_THRESHOLD) {
      await fetchIndividualMarkers();
    }
  }

  function handleToggleTerritoryMode() {
    setTerritoryModalExpanded(true);
  }

  function handleAssignLeads() {
    if (!drawingManager) {
      setErrorMessage('Drawing tool not available.');
      return;
    }
    drawingManager.setDrawingMode(window.google.maps.drawing.OverlayType.POLYGON);
    setIsAssignLeadsFlow(true);
  }

  function handleCreateLead() {
    console.log('Create Lead clicked');
  }

  function handleAssignLeadsToggle(expanded) {
    setAssignLeadsModalExpanded(expanded);
    if (!expanded) {
      setIsAssignLeadsMode(false);
      if (map) {
        if (map.getZoom() >= ZOOM_THRESHOLD) fetchIndividualMarkers();
        else fetchClusters(getMappedZoomLevel(map.getZoom()));
      }
    }
  }

  function handleAssignSuccess() {
    if (selectedPolygon) {
      selectedPolygon.setMap(null);
      setSelectedPolygon(null);
    }
    if (map) {
      if (map.getZoom() >= ZOOM_THRESHOLD) fetchIndividualMarkers();
      else fetchClusters(getMappedZoomLevel(map.getZoom()));
    }
    setIsAssignLeadsMode(false);
  }

  function handleColorChange(color) {
    setSelectedColor(color);
    if (previewPolygon.current) previewPolygon.current.setOptions({ fillColor: color, strokeColor: color });
    if (drawingManager && window.google) {
      drawingManager.setOptions({
        polygonOptions: {
          ...drawingManager.get('polygonOptions'),
          fillColor: color,
          strokeColor: color,
        }
      });
    }
  }

  async function handleSaveTerritory({ name, color, polygon, user_id }) {
    previewPolygon.current = null;
    const path = polygon.getPath().getArray().map(latLng => ({
      lat: parseFloat(latLng.lat().toFixed(6)),
      lng: parseFloat(latLng.lng().toFixed(6))
    }));

    if (
      path.length < 4 ||
      path[0].lat !== path[path.length - 1].lat ||
      path[0].lng !== path[path.length - 1].lng
    ) {
      path.push({ ...path[0] });
    }

    for (let point of path) {
      if (isNaN(point.lat) || isNaN(point.lng)) {
        setErrorMessage('Invalid coordinate in polygon.');
        polygon.setMap(null);
        setTerritoryModalExpanded(false);
        return;
      }
    }

    try {
      setIsLoading(true);
      setErrorMessage(null);

      const geoJson = {
        type: 'Polygon',
        coordinates: [ path.map(coord => [coord.lng, coord.lat]) ]
      };

      const { data, error } = await supabase
        .from('territories')
        .insert([{ name, color, geom: geoJson }])
        .select();

      if (error) throw new Error(error.message);

      addTerritoryToMap(name, color, path);
      setTerritories(prev => [...prev, ...(data || [])]);
      setTerritoryModalExpanded(false);
      setSelectedPolygon(null);
    } catch (error) {
      console.error('Error saving territory:', error);
      alert(`Error: ${error.message}`);
      setErrorMessage(error.message);
      if (polygon) {
        polygon.setMap(null);
        setSelectedPolygon(null);
      }
    } finally {
      setIsLoading(false);
    }
  }

  function handleCancelTerritory() {
    if (previewPolygon.current) {
      previewPolygon.current.setMap(null);
      previewPolygon.current = null;
    }
    setSelectedPolygon(null);
    setTerritoryModalExpanded(false);
    setErrorMessage(null);
  }

  function addTerritoryToMap(name, color, path) {
    if (!map || !window.google) return;
    const googlePath = path.map(coord => new window.google.maps.LatLng(coord.lat, coord.lng));
    const polygon = new window.google.maps.Polygon({
      paths: googlePath,
      strokeColor: color,
      strokeOpacity: 0.8,
      strokeWeight: 2,
      fillColor: color,
      fillOpacity: 0.35,
    });
    polygon.setMap(map);
    setPolygons(prev => [...prev, polygon]);
  }

  function handleStartDrawing() {
    if (drawingManager) {
      drawingManager.setDrawingMode(window.google.maps.drawing.OverlayType.POLYGON);
    } else {
      setErrorMessage('Drawing tool not available.');
    }
  }

  function handleJumpToTerritory(territory) {
    if (!territory || !territory.geom || territory.geom.type !== 'Polygon') return;
    if (!map || !window.google) return;

    const coordinates = territory.geom.coordinates[0].map(
      coord => new window.google.maps.LatLng(parseFloat(coord[1]), parseFloat(coord[0]))
    );
    if (coordinates.length === 0) return;

    const bounds = new window.google.maps.LatLngBounds();
    coordinates.forEach(coord => bounds.extend(coord));
    map.fitBounds(bounds);

    clearClusterMarkers();
    clearIndividualMarkers();
    setIndividualMarkersCache([]);
    setIsDisplayingIndividualMarkers(false);

    const idleListener = window.google.maps.event.addListener(map, 'idle', async () => {
      const currentZoom = map.getZoom();
      if (currentZoom >= ZOOM_THRESHOLD) {
        await fetchIndividualMarkers();
        clearClusterMarkers();
      } else {
        const mappedZoomLevel = getMappedZoomLevel(currentZoom);
        await fetchClusters(mappedZoomLevel);
        clearIndividualMarkers();
      }
      window.google.maps.event.removeListener(idleListener);
    });
  }

  async function handleSearchZipCode(zipCode) {
    const enteredZip = zipCode.trim();
    if (!enteredZip) {
      setErrorMessage('Zip code cannot be empty.');
      return;
    }

    try {
      setIsLoading(true);
      setErrorMessage(null);

      const apiUrl = `https://nominatim.openstreetmap.org/search?city=Cedar%Fort&state=UT&country=&format=json&polygon_geojson=1`;
      const response = await fetch(apiUrl, { headers: { 'Accept-Language': 'en' } });
      if (!response.ok) throw new Error('Failed to fetch data.');
      const data = await response.json();
      if (data.length === 0) throw new Error('No results found.');

      const result = data[0];
      if (!result.geojson) throw new Error('No geojson data available.');

      let coordinates = [];
      if (result.geojson.type === 'Polygon') {
        coordinates = result.geojson.coordinates[0];
      } else if (result.geojson.type === 'MultiPolygon') {
        coordinates = result.geojson.coordinates[0][0];
      } else {
        throw new Error('Unsupported geojson type.');
      }

      const path = coordinates.map(coord => new window.google.maps.LatLng(coord[1], coord[0]));
      const zipPolygon = new window.google.maps.Polygon({
        paths: path,
        strokeColor: '#00FF00',
        strokeOpacity: 0.8,
        strokeWeight: 2,
        fillColor: '#00FF00',
        fillOpacity: 0.35,
      });

      zipPolygon.setMap(map);
      setPolygons(prev => [...prev, zipPolygon]);
      setSelectedPolygon(zipPolygon);

      const bounds = new window.google.maps.LatLngBounds();
      path.forEach(latLng => bounds.extend(latLng));
      map.fitBounds(bounds);
    } catch (error) {
      console.error('Error searching zip code:', error);
      setErrorMessage(error.message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col relative">
      <CollapsibleSidebar onToggle={handleSidebarToggle} isExpanded={sidebarExpanded} />
      <div className="flex-1 relative">
        <div ref={mapRef} id="map" className="w-full h-full"></div>
        
        {isLoading && (
          <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center bg-gray-200 bg-opacity-50">
            <div className="loader"></div>
          </div>
        )}
        {errorMessage && (
          <div className="error-overlay">
            {errorMessage}
          </div>
        )}
      </div>

      {(territoryModalExpanded || assignLeadsModalExpanded || filterModalExpanded) && (
        <div className="fixed-overlay">
          {territoryModalExpanded && (
            <TerritoryModal
              isExpanded={territoryModalExpanded}
              polygon={selectedPolygon}
              territories={territories}
              onToggle={setTerritoryModalExpanded}
              onSave={handleSaveTerritory}
              onCancel={handleCancelTerritory}
              onColorChange={handleColorChange}
              onStartDrawing={handleStartDrawing}
              onJumpToTerritory={handleJumpToTerritory}
              onSearchZipCode={handleSearchZipCode}
            />
          )}
          {assignLeadsModalExpanded && (
            <AssignLeadsModal
              isExpanded={assignLeadsModalExpanded}
              polygon={selectedPolygon}
              onToggle={handleAssignLeadsToggle}
              onAssignSuccess={handleAssignSuccess}
            />
          )}
          {filterModalExpanded && (
            <FilterModal
              isExpanded={filterModalExpanded}
              onToggle={setFilterModalExpanded}
              onApplyFilters={handleApplyFilters}
            />
          )}
        </div>
      )}

      <Toolbar
        className="fixed-toolbar"
        isDrawingMode={isDrawingMode}
        onPan={handlePan}
        onFilterLeads={handleFilterLeads}
        onToggleTerritoryMode={handleToggleTerritoryMode}
        onAssignLeads={handleAssignLeads}
        onCreateLead={handleCreateLead}
      />
    </div>
  );
}
