"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@/utils/supabase/client";

export default function Territory({
  isExpanded = true,
  polygon = null,
  territories = [],
  onToggle,
  onStartDrawing,
  onSave,
  onCancel,
  onSearchZipCode,
  onColorChange,
  onJumpToTerritory
}) {
  const supabase = createClient();
  const [territoryName, setTerritoryName] = useState("");
  const [color, setColor] = useState("#FF0000");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const [users, setUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(null);

  const [assignError, setAssignError] = useState("");
  const [assignSuccess, setAssignSuccess] = useState("");

  const [showZipInput, setShowZipInput] = useState(false);
  const [zipCode, setZipCode] = useState("");
  const [isZipLoading, setIsZipLoading] = useState(false);
  const [zipError, setZipError] = useState("");

  const [selectedTerritory, setSelectedTerritory] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (isExpanded) {
      fetchUsers();
      if (territories.length === 0) {
        // Mock data if needed
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isExpanded]);

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

  function startDrawing() {
    onStartDrawing && onStartDrawing();
  }

  async function saveTerritory() {
    if (!territoryName.trim()) {
      setSaveError("Territory name is required.");
      return;
    }

    if (!polygon && !showZipInput) {
      setSaveError("No territory defined. Please draw a territory or enter a zip code.");
      return;
    }

    if (!selectedUserId) {
      setSaveError("Please select a user to assign the territory.");
      return;
    }

    setSaveError("");
    setIsSaving(true);

    try {
      await onSave && onSave({ name: territoryName, color, polygon, user_id: selectedUserId });
      setIsAdding(false);
    } catch (error) {
      setSaveError("Failed to save territory. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  function cancelTerritory() {
    setTerritoryName("");
    setColor("#FF0000");
    setSelectedUserId(null);
    setSaveError("");
    setZipCode("");
    setZipError("");
    setShowZipInput(false);
    setIsAdding(false);
    onCancel && onCancel();
  }

  function handleTerritoryClick(territory) {
    onJumpToTerritory && onJumpToTerritory(territory);
    setSelectedTerritory(territory);
  }

  function handleBackToList() {
    setSelectedTerritory(null);
  }

  useEffect(() => {
    onColorChange && onColorChange(color);
  }, [color, onColorChange]);

  const filteredTerritories = territories.filter((t) =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  async function handleZipSearch() {
    if (!zipCode.trim()) {
      setZipError("Zip code is required.");
      return;
    }

    setZipError("");
    setIsZipLoading(true);
    onSearchZipCode && onSearchZipCode(zipCode);
    setIsZipLoading(false);
  }

  return (
    <div
      className={`fixed z-50 right-4 top-4 bg-gray-900 text-white rounded-lg shadow-lg transition-all duration-300 overflow-hidden flex flex-col ${
        isExpanded ? "w-80" : "w-0"
      }`}
      style={{ height: "90vh" }}
    >
      {isExpanded && (
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
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
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
                <button onClick={handleBackToList} className="flex items-center text-gray-300 hover:text-white">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5 mr-2"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                  </svg>
                  Back to List
                </button>
                <div>
                  <h3 className="text-md font-medium">Details for {selectedTerritory.name}</h3>
                  <p className="text-sm text-gray-400">Stats and other information will appear here.</p>
                </div>
              </div>
            ) : isAdding ? (
              <div className="p-4 space-y-4">
                <h3 className="text-md font-medium">Add New Territory</h3>
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
                <div>
                  <label className="block text-sm font-medium text-gray-300">Assign to User</label>
                  <select
                    value={selectedUserId || ""}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 bg-gray-800 text-white border border-gray-700 rounded-md"
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
                </div>
                <div>
                  <label className="inline-flex items-center">
                    <input
                      type="checkbox"
                      checked={showZipInput}
                      onChange={(e) => setShowZipInput(e.target.checked)}
                      className="form-checkbox h-5 w-5 text-blue-600"
                    />
                    <span className="ml-2 text-sm text-gray-300">Use Zip Code</span>
                  </label>
                </div>
                {showZipInput && (
                  <div>
                    <label className="block text-sm font-medium text-gray-300">Zip Code</label>
                    <div className="flex items-center space-x-2">
                      <input
                        type="text"
                        value={zipCode}
                        onChange={(e) => setZipCode(e.target.value)}
                        placeholder="e.g., 83616"
                        className="mt-1 block w-full px-3 py-2 bg-gray-800 text-white border border-gray-700 rounded-md"
                        aria-label="Zip Code"
                      />
                      <button
                        onClick={handleZipSearch}
                        className="px-3 py-2 bg-purple-600 text-white rounded hover:bg-purple-500 flex items-center"
                        disabled={isZipLoading}
                      >
                        {isZipLoading ? "Searching..." : "Search"}
                      </button>
                    </div>
                    {zipError && <p className="text-red-500 text-xs mt-1">{zipError}</p>}
                  </div>
                )}
                {saveError && <p className="text-red-500 text-xs">{saveError}</p>}
                <div className="flex justify-end space-x-2">
                  <button
                    onClick={cancelTerritory}
                    className="px-3 py-1 bg-gray-700 text-white rounded hover:bg-gray-600"
                    disabled={isSaving}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveTerritory}
                    className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-500 flex items-center"
                    disabled={isSaving}
                  >
                    {isSaving ? "Saving..." : "Save"}
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
                      startDrawing();
                      setIsAdding(true);
                      setSelectedTerritory(null);
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
                        onClick={() => handleTerritoryClick(territory)}
                      >
                        <div className="flex items-center">
                          <span
                            className="w-4 h-4 rounded-full mr-2"
                            style={{ backgroundColor: territory.color }}
                          ></span>
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
      )}
      {!isExpanded && (
        <div className="flex items-center p-4 hover:bg-gray-800 cursor-pointer" onClick={() => onToggle && onToggle(true)}>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
          <span className="ml-2 text-sm">Territory</span>
        </div>
      )}
    </div>
  );
}
