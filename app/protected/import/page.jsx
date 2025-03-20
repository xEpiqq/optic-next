"use client";

import React, { useState } from "react";
import { supabase } from "@/lib/supabaseClient"; // Adjust path as needed

const BATCH_SIZE = 50;
const DELAY = 1000; // 1 second
const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

export default function Page() {
  const [file, setFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("");

  const handleFileUpload = (e) => {
    setFile(e.target.files[0]);
    setUploadMessage("");
  };

  const startUpload = async () => {
    if (!file) return;
    setIsProcessing(true);
    setUploadMessage("Processing...");

    try {
      const csv = await readFileAsText(file);
      const addresses = parseCSV(csv);
      let successCount = 0;
      let failureCount = 0;

      for (let i = 0; i < addresses.length; i += BATCH_SIZE) {
        const batch = addresses.slice(i, i + BATCH_SIZE);
        const { success, failure } = await processBatch(batch);
        successCount += success;
        failureCount += failure;
        setUploadMessage(
          `Processed ${successCount + failureCount} records...`
        );
        await sleep(DELAY);
      }

      setUploadMessage(
        `Upload completed! Successfully uploaded: ${successCount}, Failed: ${failureCount}`
      );
    } catch (error) {
      console.error("Error during upload:", error);
      setUploadMessage(`An error occurred: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const readFileAsText = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (err) => reject(err);
      reader.readAsText(file);
    });

  const parseCSV = (csv) => {
    const lines = csv.trim().split("\n");
    const headers = lines[0].split(",").map((h) => h.trim().toUpperCase());

    return lines
      .slice(1)
      .map((line) => {
        const values = line.split(",").map((v) => v.trim());
        return {
          address: values[headers.indexOf("ADDRESS")] || "",
          city: values[headers.indexOf("CITY")] || "",
          state: values[headers.indexOf("STATE")] || "",
          zip5: values[headers.indexOf("ZIP_5")] || "",
          zip9: values[headers.indexOf("ZIP_9")] || null
        };
      })
      .filter((row) => row.address && row.city && row.state && row.zip5);
  };

  const processBatch = async (batch) => {
    let success = 0;
    let failure = 0;
    const geocodes = await Promise.all(batch.map(geocodeAddress));

    const inserts = geocodes.map(async (res) => {
      if (!res.success) return failure++;
      const { data, error } = await supabase.from("restaurants").insert({
        address: res.data.address,
        city: res.data.city,
        state: res.data.state,
        zip5: res.data.zip5,
        zip9: res.data.zip9,
        location: {
          type: "Point",
          coordinates: [res.data.longitude, res.data.latitude]
        },
        status: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
      error ? failure++ : success++;
    });

    await Promise.all(inserts);
    return { success, failure };
  };

  const geocodeAddress = async ({ address, city, state, zip5, zip9 }) => {
    const fullAddress = `${address}, ${city}, ${state} ${zip5}, USA`;
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
      fullAddress
    )}&key=${apiKey}`;
    try {
      const response = await fetch(url);
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
            zip9: zip9 || null,
            latitude: loc.lat,
            longitude: loc.lng
          }
        };
      }
      console.error("Geocoding failed:", fullAddress, data.status);
      return { success: false };
    } catch (error) {
      console.error("Geocoding error:", fullAddress, error);
      return { success: false };
    }
  };

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      {/* Example: <Sidebar /> if you have one */}
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
          <p className="mt-4 text-sm text-gray-400">{uploadMessage}</p>
        )}
      </div>
    </div>
  );
}
