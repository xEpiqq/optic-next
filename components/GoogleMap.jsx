"use client";
export const dynamic = "force-dynamic";

import { useEffect } from "react";

// This component doesn't fetch from Supabase; it just loads Google Maps.
// No changes to Supabase usage here.

export default function GoogleMap({ clusters = [] }) {
  let map;
  let markers = [];
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  async function loadGoogleMaps(apiKey) {
    return new Promise((resolve, reject) => {
      if (typeof window === "undefined") {
        reject(new Error("Window is undefined"));
        return;
      }

      if (window.google && window.google.maps) {
        resolve();
        return;
      }

      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}`;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = (e) => reject(e);
      document.head.appendChild(script);
    });
  }

  function clearMarkers() {
    markers.forEach((marker) => marker.setMap(null));
    markers = [];
  }

  function addMarkers(clusterData) {
    clusterData.forEach((cluster) => {
      const marker = new window.google.maps.Marker({
        position: { lat: cluster.latitude, lng: cluster.longitude },
        map: map,
        label: {
          text: String(cluster.count),
          color: "white",
          fontSize: "12px",
          fontWeight: "bold"
        },
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          fillColor: "#007bff",
          fillOpacity: 0.6,
          scale: Math.max(20, Math.min(cluster.count / 100, 50)),
          strokeColor: "#fff",
          strokeWeight: 1
        }
      });

      marker.addListener("click", () => {
        map.setZoom(map.getZoom() + 2);
        map.setCenter(marker.getPosition());
      });

      markers.push(marker);
    });
  }

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        await loadGoogleMaps(apiKey);
        if (!isMounted) return;

        const mapElement = document.getElementById("map");
        map = new window.google.maps.Map(mapElement, {
          center: { lat: 39.5, lng: -98.35 },
          zoom: 4,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          zoomControl: false
        });

        addMarkers(clusters);
      } catch (error) {
        console.error("Error loading Google Maps:", error);
      }
    })();

    return () => {
      isMounted = false;
      clearMarkers();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div id="map" style={{ width: "100%", height: "100vh" }} />;
}
