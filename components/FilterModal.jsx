"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";

export default function FilterModal({
  isExpanded = false,
  onToggle,
  onApplyFilters
}) {
  const supabase = createClient();
  const [columns, setColumns] = useState([]);
  const [selectedFilters, setSelectedFilters] = useState([]);
  const [availableOperators] = useState(["=", "!=", ">", "<", ">=", "<=", "LIKE"]);
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isExpanded) {
      fetchColumns();
    }
  }, [isExpanded]);

  async function fetchColumns() {
    try {
      setIsLoading(true);
      setErrorMessage("");

      const response = await fetch("/api/restaurantColumns");
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch columns.");
      }
      const data = await response.json();
      setColumns(data.columns);
    } catch (error) {
      console.error("Error fetching columns:", error);
      setErrorMessage(error.message);
    } finally {
      setIsLoading(false);
    }
  }

  function addFilter() {
    setSelectedFilters((prev) => [...prev, { column: "", operator: "=", value: "" }]);
  }

  function removeFilter(index) {
    setSelectedFilters((prev) => prev.filter((_, i) => i !== index));
  }

  function applyFilters() {
    onApplyFilters && onApplyFilters(selectedFilters);
    onToggle && onToggle(false);
  }

  function cancelFilters() {
    onToggle && onToggle(false);
  }

  return (
    <div
      className={`fixed z-50 right-4 top-4 bg-gray-900 text-white rounded-lg shadow-lg transition-all duration-300 overflow-hidden flex flex-col ${
        isExpanded ? "w-80" : "w-0"
      }`}
      style={{ height: "90vh" }}
    >
      {isExpanded ? (
        <>
          <div className="flex items-center justify-between p-4">
            <h2 className="text-lg font-semibold">Filter Restaurants</h2>
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
            {errorMessage ? (
              <p className="text-red-500">{errorMessage}</p>
            ) : isLoading ? (
              <p>Loading columns...</p>
            ) : (
              <div className="space-y-4">
                {selectedFilters.map((filter, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <select
                      value={filter.column}
                      onChange={(e) => {
                        const newFilters = [...selectedFilters];
                        newFilters[index].column = e.target.value;
                        setSelectedFilters(newFilters);
                      }}
                      className="w-1/3 px-3 py-2 bg-gray-800 text-white border border-gray-700 rounded-md focus:outline-none focus:ring focus:border-blue-500"
                    >
                      <option value="" disabled>
                        Select column
                      </option>
                      {columns.map((column) => (
                        <option key={column} value={column}>
                          {column}
                        </option>
                      ))}
                    </select>
                    <select
                      value={filter.operator}
                      onChange={(e) => {
                        const newFilters = [...selectedFilters];
                        newFilters[index].operator = e.target.value;
                        setSelectedFilters(newFilters);
                      }}
                      className="w-1/4 px-3 py-2 bg-gray-800 text-white border border-gray-700 rounded-md focus:outline-none focus:ring focus:border-blue-500"
                    >
                      {availableOperators.map((op) => (
                        <option key={op} value={op}>
                          {op}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={filter.value}
                      onChange={(e) => {
                        const newFilters = [...selectedFilters];
                        newFilters[index].value = e.target.value;
                        setSelectedFilters(newFilters);
                      }}
                      placeholder="Value"
                      className="w-1/3 px-3 py-2 bg-gray-800 text-white border border-gray-700 rounded-md focus:outline-none focus:ring focus:border-blue-500"
                    />
                    <button onClick={() => removeFilter(index)} className="text-red-500 hover:text-red-700">
                      &times;
                    </button>
                  </div>
                ))}
                <button onClick={addFilter} className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-500">
                  Add Filter
                </button>
              </div>
            )}
          </div>
          <div className="border-t border-gray-700"></div>
          <div className="p-4 flex justify-end space-x-2">
            <button
              onClick={cancelFilters}
              className="px-3 py-1 bg-gray-700 text-white rounded hover:bg-gray-600"
            >
              Cancel
            </button>
            <button
              onClick={applyFilters}
              className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-500"
            >
              Apply
            </button>
          </div>
        </>
      ) : (
        <div className="flex items-center p-4 hover:bg-gray-800 cursor-pointer" onClick={() => onToggle && onToggle(true)}>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path /* Just a placeholder icon */ strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M..." />
          </svg>
          <span className="ml-2 text-sm">Filter</span>
        </div>
      )}
    </div>
  );
}
