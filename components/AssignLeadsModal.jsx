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

  useEffect(() => {
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  function toggleModal() {
    onToggle && onToggle(false);
  }

  async function handleAssign() {
    if (!selectedUserId) {
      setAssignError("Please select a user to assign.");
      return;
    }

    if (!polygon) {
      setAssignError("No polygon defined.");
      return;
    }

    setIsAssigning(true);
    setAssignError(null);
    setAssignSuccess(null);

    try {
      const path = polygon
        .getPath()
        .getArray()
        .map((latlng) => ({
          latitude: parseFloat(latlng.lat().toFixed(7)),
          longitude: parseFloat(latlng.lng().toFixed(7))
        }));

      // Ensure polygon is closed
      if (
        path.length < 4 ||
        path[0].latitude !== path[path.length - 1].latitude ||
        path[0].longitude !== path[path.length - 1].longitude
      ) {
        path.push({ ...path[0] });
      }

      for (let point of path) {
        if (isNaN(point.latitude) || isNaN(point.longitude)) {
          throw new Error("Invalid coordinate detected in the polygon.");
        }
      }

      const polygonGeoJSON = {
        type: "Polygon",
        coordinates: [path.map((point) => [point.longitude, point.latitude])]
      };

      const { data, error } = await supabase.rpc(
        "assign_restaurants_within_polygon",
        {
          p_polygon: polygonGeoJSON,
          p_user_id: selectedUserId
        }
      );

      if (error) throw error;

      setAssignSuccess(
        `Successfully assigned restaurants to user. ${data} restaurants updated.`
      );
      onAssignSuccess && onAssignSuccess();

      polygon.setMap(null);

      setTimeout(() => {
        toggleModal();
      }, 2000);
    } catch (error) {
      console.error("Error assigning restaurants:", error);
      setAssignError(error.message || "Failed to assign restaurants. Please try again.");
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
            <h1 className="text-lg font-semibold">Assign Restaurants</h1>
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
            {assignError && <div className="mb-2 text-red-500">{assignError}</div>}
            {assignSuccess && <div className="mb-2 text-green-500">{assignSuccess}</div>}

            <label className="block mb-2 text-sm">
              Select User to Assign Restaurants:
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
              className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded disabled:opacity-50"
              disabled={isAssigning}
            >
              {isAssigning ? "Assigning..." : "Assign"}
            </button>
          </div>
        </>
      ) : (
        <div className="flex items-center p-4 hover:bg-gray-800 cursor-pointer" onClick={toggleModal}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
          <span className="ml-2 text-sm">Assign Restaurants</span>
        </div>
      )}
    </div>
  );
}
