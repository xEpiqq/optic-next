"use client";

import React, { useState } from "react";
import { supabase } from "@/lib/supabaseClient"; // Adjust path as needed

/**
 * Instead of batching, we process each row in a serial loop, waiting 2s per row.
 * This drastically slows the import but might reveal exactly where 500 errors occur.
 */
const DELAY_PER_ROW = 100;
const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

export default function Page() {
  const [file, setFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("");

  // Keep track of detailed errors for more verbose reporting
  const [detailedErrors, setDetailedErrors] = useState([]);

  /**
   * Handle file selection
   */
  const handleFileUpload = (e) => {
    setFile(e.target.files[0]);
    setUploadMessage("");
    setDetailedErrors([]);
  };

  /**
   * Start the import/upload process (one row at a time)
   */
  const startUpload = async () => {
    if (!file) {
      setUploadMessage("No file selected. Please choose a CSV file first.");
      return;
    }
    setIsProcessing(true);
    setUploadMessage("Processing...");
    setDetailedErrors([]);

    try {
      // Read file contents as text
      const csv = await readFileAsText(file);
      if (!csv) {
        setUploadMessage("The file appears to be empty or could not be read.");
        return;
      }

      // Parse CSV into structured data
      const addresses = parseCSV(csv);

      if (!addresses || addresses.length === 0) {
        setUploadMessage(
          "No valid address rows were found in the CSV. Make sure your CSV has 'ADDRESS', 'CITY', 'STATE', and 'ZIP_5' columns."
        );
        return;
      }

      let successCount = 0;
      let failureCount = 0;
      const newErrors = [];

      // Process addresses in a serial loop (each row = geocode, insert, then wait 2s)
      for (let i = 0; i < addresses.length; i++) {
        const row = addresses[i];
        const { rowIndex, address, city, state, zip5 } = row;

        // Geocode
        let geocodeData = null;
        try {
          const geoResult = await geocodeAddress(row);
          if (!geoResult.success) {
            // Geocode failed
            failureCount++;
            newErrors.push({
              row: rowIndex,
              error: `Geocoding failed. 
                      Address: [${address}, ${city}, ${state}, ${zip5}],
                      status: ${geoResult.status || "UNKNOWN"}`
            });
            // Move to next row
            await sleep(DELAY_PER_ROW);
            continue;
          } else {
            geocodeData = geoResult.data;
          }
        } catch (geoErr) {
          // Unexpected geocode error
          failureCount++;
          newErrors.push({
            row: rowIndex,
            error: `Error in geocodeAddress: ${geoErr.message}`
          });
          await sleep(DELAY_PER_ROW);
          continue;
        }

        // Insert into DB
        try {
          const { data, error } = await supabase.from("restaurants").insert({
            address: geocodeData.address,
            city: geocodeData.city,
            state: geocodeData.state,
            zip5: geocodeData.zip5,
            zip9: geocodeData.zip9 || null,
            location: {
              type: "Point",
              coordinates: [geocodeData.longitude, geocodeData.latitude]
            },
            status: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });

          if (error) {
            // DB Insert error
            failureCount++;
            newErrors.push({
              row: rowIndex,
              error: `Database insert error: ${error.message}`
            });
          } else {
            successCount++;
          }
        } catch (dbErr) {
          failureCount++;
          newErrors.push({
            row: rowIndex,
            error: `Unexpected DB error: ${dbErr.message}`
          });
        }

        // Update UI
        setUploadMessage(
          `Processed ${successCount + failureCount} of ${addresses.length} rows...
           Successful: ${successCount}, Failed: ${failureCount}`
        );

        // Wait 2 seconds before the next row
        await sleep(DELAY_PER_ROW);
      }

      // Done
      setDetailedErrors(newErrors);
      setUploadMessage(
        `Upload completed!
        Successfully uploaded: ${successCount},
        Failed: ${failureCount}.
        See detailed errors below if any.`
      );
    } catch (error) {
      console.error("Error during upload:", error);
      setUploadMessage(`An error occurred: ${error.message}`);
      setDetailedErrors([
        {
          row: "General",
          error: error.message || "Unidentified error during upload"
        }
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * Reads file contents as text (returns a Promise)
   */
  const readFileAsText = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (err) => reject(err);
      reader.readAsText(file);
    });

  /**
   * Parse CSV text into a list of address objects
   */
  const parseCSV = (csv) => {
    const lines = csv.trim().split("\n");
    if (lines.length < 2) {
      // No header or no data lines
      return [];
    }

    const headers = lines[0].split(",").map((h) => h.trim().toUpperCase());

    return lines
      .slice(1)
      .map((line, idx) => {
        // Safely map columns
        const values = line.split(",").map((v) => v.trim());

        // Basic column extraction
        const address = values[headers.indexOf("ADDRESS")] || "";
        const city = values[headers.indexOf("CITY")] || "";
        const state = values[headers.indexOf("STATE")] || "";
        const zip5 = values[headers.indexOf("ZIP_5")] || "";
        const zip9 = headers.indexOf("ZIP_9") > -1
          ? values[headers.indexOf("ZIP_9")]
          : null;

        // Return row structure including row index (for debugging)
        return {
          rowIndex: idx + 2, // +2 because line[0] is header, lines start at 1
          address,
          city,
          state,
          zip5,
          zip9
        };
      })
      .filter((row) => row.address && row.city && row.state && row.zip5);
  };

  /**
   * Geocode a single address object using the Google Maps Geocoding API
   */
  const geocodeAddress = async ({ address, city, state, zip5, zip9 }) => {
    const fullAddress = `${address}, ${city}, ${state} ${zip5}, USA`;
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
      fullAddress
    )}&key=${apiKey}`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        return {
          success: false,
          status: `HTTP error: ${response.status}`
        };
      }

      const data = await response.json();
      if (data.status === "OK" && data.results.length > 0) {
        const loc = data.results[0].geometry.location;
        return {
          success: true,
          data: {
            address,
            city,
            state,
            zip5,
            zip9,
            latitude: loc.lat,
            longitude: loc.lng
          }
        };
      }
      // Either zero results or a non-OK status from geocode
      return {
        success: false,
        status: data.status || "No results / Unknown status"
      };
    } catch (error) {
      return {
        success: false,
        status: `Fetch error: ${error.message}`
      };
    }
  };

  /**
   * Sleep helper to wait between each row
   */
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <div className="text-center flex flex-col">
        <svg
          className="mx-auto h-12 w-12 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            vectorEffect="non-scaling-stroke"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"
          />
        </svg>

        <h3 className="mt-2 text-sm font-semibold text-gray-300">
          Import Leads
        </h3>
        <p className="mt-1 text-sm text-gray-400">
          Select a CSV file from your device
        </p>

        <div className="mt-6">
          <label
            htmlFor="file-upload"
            className="relative cursor-pointer bg-gray-800 rounded-md font-medium text-blue-400 hover:text-blue-300 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500"
          >
            <span className="inline-flex items-center px-4 py-2 border border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-300 bg-gray-800 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
              Choose file
            </span>
            <input
              id="file-upload"
              name="file-upload"
              type="file"
              accept=".csv"
              className="sr-only"
              onChange={handleFileUpload}
            />
          </label>
        </div>

        {file && (
          <>
            <p className="mt-2 text-sm text-gray-500">{file.name}</p>
            <button
              className="mt-6 bg-blue-600 text-white py-2 px-4 rounded flex justify-center items-center disabled:opacity-50"
              onClick={startUpload}
              disabled={isProcessing}
            >
              {isProcessing && (
                <svg className="animate-spin h-5 w-5 mr-3" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v8z"
                  ></path>
                </svg>
              )}
              {isProcessing ? "Uploading..." : "Start Upload"}
            </button>
          </>
        )}

        {uploadMessage && (
          <p className="mt-4 text-sm text-gray-400 whitespace-pre-line">
            {uploadMessage}
          </p>
        )}

        {/* Show detailed error list, if any */}
        {detailedErrors.length > 0 && (
          <div className="mt-4 text-left bg-gray-800 p-4 rounded-md text-red-300 max-w-xl mx-auto">
            <h4 className="text-md font-semibold mb-2">Detailed Errors:</h4>
            <ul className="space-y-2 text-xs">
              {detailedErrors.map((errItem, idx) => (
                <li key={idx} className="bg-gray-700 p-2 rounded">
                  <strong>Row:</strong> {errItem.row} <br />
                  <strong>Error:</strong> {errItem.error}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
