"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";

export default function AssignLeadsModal({
  isExpanded = true,
  polygon = null,
  onToggle,
  onAssignSuccess
}) {
  const supabase = createClient();

  const [users, setUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [isAssigning, setIsAssigning] = useState(false);
  const [assignError, setAssignError] = useState(null);
  const [assignSuccess, setAssignSuccess] = useState(null);

  // Stats for the polygon
  const [pinCount, setPinCount] = useState(0);
  const [userCounts, setUserCounts] = useState([]); 
  // userCounts will be an array of: { the_user_id, first_name, last_name, total }

  // Fetch the list of possible users (for the dropdown)
  useEffect(() => {
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Whenever 'polygon' changes, fetch stats for that polygon
  useEffect(() => {
    if (!polygon) {
      setPinCount(0);
      setUserCounts([]);
      return;
    }
    const path = polygon.getPath();
    if (!path || path.getLength() < 3) {
      setPinCount(0);
      setUserCounts([]);
      return;
    }

    // Convert polygon to standard GeoJSON
    const coords = [];
    for (let i = 0; i < path.getLength(); i++) {
      const latLng = path.getAt(i);
      coords.push([latLng.lng(), latLng.lat()]);
    }
    // Close the polygon
    coords.push([...coords[0]]);

    const polygonGeoJSON = { type: "Polygon", coordinates: [coords] };
    fetchPolygonStats(polygonGeoJSON);
  }, [polygon]);

  async function fetchUsers() {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name")
        .order("first_name", { ascending: true });

      if (error) throw error;
      setUsers(data);
    } catch (error) {
      console.error("Error fetching users:", error);
      setAssignError("Failed to load users. Please try again.");
    }
  }

  async function fetchPolygonStats(polygonGeoJSON) {
    try {
      setAssignError(null);
      const { data, error } = await supabase.rpc(
        "get_restaurant_counts_by_polygon",
        { p_polygon: polygonGeoJSON }
      );
      if (error) throw error;
      // data => [{ the_user_id, first_name, last_name, total }, ...]
      setUserCounts(data || []);
      // Sum the total field for overall pin count
      const sum = (data || []).reduce((acc, row) => acc + row.total, 0);
      setPinCount(sum);
    } catch (err) {
      console.error("Error fetching polygon stats:", err);
      setAssignError("Failed to load polygon stats.");
      setPinCount(0);
      setUserCounts([]);
    }
  }

  function toggleModal() {
    onToggle && onToggle(false);
  }

  async function handleAssign() {
    if (!selectedUserId) {
      setAssignError("Please select a user to assign.");
      return;
    }
    if (!polygon) {
      setAssignError("No polygon drawn. Please draw one first.");
      return;
    }
    const path = polygon.getPath();
    if (!path || path.getLength() < 3) {
      setAssignError("Polygon is not complete—needs at least 3 points.");
      return;
    }

    setIsAssigning(true);
    setAssignError(null);
    setAssignSuccess(null);

    try {
      // Convert path to lat/lng array
      const coords = path.getArray().map((latlng) => ({
        latitude: parseFloat(latlng.lat().toFixed(7)),
        longitude: parseFloat(latlng.lng().toFixed(7))
      }));
      // Force close
      if (
        coords[0].latitude !== coords[coords.length - 1].latitude ||
        coords[0].longitude !== coords[coords.length - 1].longitude
      ) {
        coords.push({ ...coords[0] });
      }

      const polygonGeoJSON = {
        type: "Polygon",
        coordinates: [coords.map((pt) => [pt.longitude, pt.latitude])]
      };

      // RPC to assign leads
      const { data, error } = await supabase.rpc(
        "assign_restaurants_within_polygon",
        {
          p_polygon: polygonGeoJSON,
          p_user_id: selectedUserId
        }
      );
      if (error) throw error;

      setAssignSuccess(
        `Successfully assigned ${data || 0} pins to user.`
      );
      // Let the parent know we succeeded
      onAssignSuccess && onAssignSuccess();
      // Remove the polygon from the map
      polygon.setMap(null);

      // Close after a brief delay
      setTimeout(() => {
        toggleModal();
      }, 2000);
    } catch (error) {
      console.error("Error assigning leads:", error);
      setAssignError(
        error.message || "Failed to assign leads. Please try again."
      );
    } finally {
      setIsAssigning(false);
    }
  }

  return (
    <div
      className={`fixed z-50 right-4 top-4 bg-gray-900 text-white rounded-lg shadow-lg transition-all duration-300 ${
        isExpanded ? "w-80" : "w-0"
      } overflow-hidden`}
    >
      {isExpanded ? (
        <>
          <div className="flex items-center justify-between p-4">
            <h1 className="text-lg font-semibold">Assign Leads</h1>
            <button onClick={toggleModal} className="p-1 hover:bg-gray-700 rounded">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10 8.586L15.95 2.636l1.414 1.414L11.414 10l5.95 5.95-1.414 1.414L10 11.414l-5.95 5.95-1.414-1.414L8.586 10 2.636 4.05l1.414-1.414L10 8.586z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>
          <div className="border-t border-gray-700"></div>
          <div className="p-4">
            {assignError && (
              <div className="mb-2 text-red-500">{assignError}</div>
            )}
            {assignSuccess && (
              <div className="mb-2 text-green-500">{assignSuccess}</div>
            )}

            {/* Display polygon stats */}
            <div className="text-sm mb-4">
              <p>
                <strong>Total Pins in Polygon:</strong> {pinCount}
              </p>
              {userCounts.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {userCounts.map((uc, idx) => {
                    // If there's no user, or user_id is null
                    if (!uc.the_user_id) {
                      return (
                        <li key={`unassigned-${idx}`}>
                          No assigned user: {uc.total} pin(s)
                        </li>
                      );
                    }
                    // If user is assigned, show name if available
                    const name = (uc.first_name && uc.last_name)
                      ? `${uc.first_name} ${uc.last_name}`
                      : `Unknown user (${uc.the_user_id})`;
                    return (
                      <li key={uc.the_user_id}>
                        {name} - {uc.total} pin(s)
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* User dropdown */}
            <label className="block mb-2 text-sm">
              Select User to Assign Leads:
              <select
                value={selectedUserId || ""}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="w-full mt-1 p-2 bg-gray-800 text-white rounded"
              >
                <option value="" disabled>
                  Select a user
                </option>
                {users.map((user) => (
                  <option key={user.user_id} value={user.user_id}>
                    {user.first_name} {user.last_name}
                  </option>
                ))}
              </select>
            </label>

            <button
              onClick={handleAssign}
              disabled={isAssigning}
              className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded disabled:opacity-50"
            >
              {isAssigning ? "Assigning..." : "Assign"}
            </button>
          </div>
        </>
      ) : (
        <div
          className="flex items-center p-4 hover:bg-gray-800 cursor-pointer"
          onClick={toggleModal}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
          <span className="ml-2 text-sm">Assign Leads</span>
        </div>
      )}
    </div>
  );
}
