"use client";

import { useState } from "react";

export default function Sidebar({
  isExpanded = false,
  onToggle,
  onToggleSatelliteView,
  isSatelliteView
}) {
  // This component does not fetch from Supabase directly, no changes needed.
  // It just shows/hides navigation links and now includes a Settings toggle.

  const [showSettings, setShowSettings] = useState(false);

  const menuItems = [
    { name: "Map", route: "/protected/map" },
    { name: "Import", route: "/protected/import" },
    { name: "Onboard", route: "/protected/onboard" },
    { name: "View Reports", route: "/protected/reports" },
  ];

  function toggleSidebar() {
    onToggle && onToggle(!isExpanded);
  }

  return (
    <div
      className={`fixed z-50 left-4 top-4 bg-gray-900 text-white rounded-lg shadow-lg transition-all duration-300 ${
        isExpanded ? "w-64" : "w-auto"
      } overflow-hidden`}
    >
      {isExpanded ? (
        <>
          <div className="flex items-center justify-between p-2">
            <h1 className="text-sm font-semibold">Navigation</h1>
            <button onClick={toggleSidebar} className="p-1 hover:bg-gray-700 rounded">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>

          <div className="border-t border-gray-700 mt-1"></div>

          <div className="max-h-32 overflow-y-auto">
            {menuItems
              .filter(
                (item) =>
                  item.route !==
                  (typeof window !== "undefined" ? window.location.pathname : "")
              )
              .map((item) => (
                <div
                  key={item.route}
                  className="flex items-center p-2 hover:bg-gray-800 cursor-pointer text-sm"
                >
                  <a href={item.route} className="w-full text-white">
                    {item.name}
                  </a>
                </div>
              ))}
          </div>

          {/* A divider before the new Settings option */}
          <div className="border-t border-gray-700 mt-1"></div>
          <div
            className="flex items-center p-2 hover:bg-gray-800 cursor-pointer text-sm"
            onClick={() => setShowSettings(!showSettings)}
          >
            <span className="w-full text-white">Settings</span>
          </div>
          {showSettings && (
            <div className="p-2">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={isSatelliteView}
                  onChange={onToggleSatelliteView}
                />
                <span>Satellite View</span>
              </label>
            </div>
          )}
        </>
      ) : (
        <div
          className="flex items-center p-2 hover:bg-gray-800 cursor-pointer"
          onClick={toggleSidebar}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
          <span className="ml-2 text-sm">Navigation</span>
        </div>
      )}
    </div>
  );
}
