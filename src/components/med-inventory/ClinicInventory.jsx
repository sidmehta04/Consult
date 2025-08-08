import { useState, useEffect, useMemo } from "react";
import { Package, Calendar, RefreshCw, AlertTriangle } from "lucide-react";
import MedicineModal from "../MedicineModal";
import { collection, getDocs, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "../../firebase";
import { useGetMedicine } from "../../hooks/useGetMedicine";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import InventoryTable from "./InventoryTable";
import RequestedOrderTable from "./RequestedOrderTable";
import ApprovedOrderTable from "./ApprovedOrderTable";

const SPREADSHEET_ID = "17TbBtN9NkiXNnmASazjudB6ac9uIKG_o-OlRu3Iuh34";

// Cache configuration
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds

// In-memory cache object
const inventoryCache = {
  data: null,
  timestamp: null,
  isValid() {
    return (
      this.data &&
      this.timestamp &&
      Date.now() - this.timestamp < CACHE_DURATION
    );
  },
  set(data) {
    this.data = data;
    this.timestamp = Date.now();
  },
  get() {
    return this.isValid() ? this.data : null;
  },
  clear() {
    this.data = null;
    this.timestamp = null;
  },
};

const ClinicInventory = ({ currentUser }) => {
  const [allInventoryData, setAllInventoryData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [clinicCode, setClinicCode] = useState(null);
  const [cacheStatus, setCacheStatus] = useState("fresh");
  const [open, setOpen] = useState(false);
  const { fetchMedicinesFromDrive } = useGetMedicine();
  const [inventoriesData, setInventoriesData] = useState([]);
  const [activeTab, setActiveTab] = useState("allMedicineTable");
  // Create index for faster clinic-based filtering with flexible matching
  const clinicInventoryIndex = useMemo(() => {
    const index = new Map();
    allInventoryData.forEach((item) => {
      const clinic = item.clinicCode?.trim().toUpperCase();
      if (clinic) {
        // Extract the main clinic code (first part before space)
        const mainClinicCode = clinic.split(" ")[0];

        // Index by both full clinic code and main clinic code (avoid duplicates)
        const uniqueCodes = [...new Set([clinic, mainClinicCode])];
        uniqueCodes.forEach((code) => {
          if (code) {
            if (!index.has(code)) {
              index.set(code, []);
            }
            index.get(code).push(item);
          }
        });
      }
    });
    return index;
  }, [allInventoryData]);

  // Get inventory data for current clinic with flexible matching
  const inventoryData = useMemo(() => {
    if (!clinicCode) return [];
    const normalizedClinicCode = clinicCode.trim().toUpperCase();

    // Try exact match first
    let matches = clinicInventoryIndex.get(normalizedClinicCode) || [];

    // If no exact match, try partial matching
    if (matches.length === 0) {
      const allMatches = new Set();

      // Check all indexed clinic codes for partial matches
      for (const [indexedCode, items] of clinicInventoryIndex.entries()) {
        if (
          indexedCode.includes(normalizedClinicCode) ||
          normalizedClinicCode.includes(indexedCode)
        ) {
          items.forEach((item) => allMatches.add(item));
        }
      }

      matches = Array.from(allMatches);
    }

    return matches;
  }, [clinicInventoryIndex, clinicCode]);

  // Get clinic code from current user data
  useEffect(() => {
    if (currentUser && currentUser.clinicCode) {
      setClinicCode(currentUser.clinicCode.trim().toUpperCase());
    }
  }, [currentUser]);

  // Check cache status
  useEffect(() => {
    const updateCacheStatus = () => {
      if (!inventoryCache.data) {
        setCacheStatus("expired");
      } else if (inventoryCache.isValid()) {
        setCacheStatus("fresh");
      } else {
        setCacheStatus("stale");
      }
    };

    updateCacheStatus();
    const interval = setInterval(updateCacheStatus, 30000);
    return () => clearInterval(interval);
  }, [allInventoryData]);

  // Load data from cache or fetch new data
  const loadInventoryData = async (forceRefresh = false) => {
    // Check cache first unless forced refresh
    if (!forceRefresh) {
      const cachedData = inventoryCache.get();
      if (cachedData) {
        setAllInventoryData(cachedData.data);
        setLastUpdated(cachedData.lastUpdated);
        setLoading(false);
        setCacheStatus("fresh");
        return;
      }
    }

    // Fetch fresh data
    await fetchInventoryData();
  };

  // Fetch inventory data from Google Sheets
  const fetchInventoryData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Get the latest sheet (most recent date)
      const sheetsResponse = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}?key=${
          import.meta.env.VITE_SHEET_API
        }`
      );

      if (!sheetsResponse.ok) {
        throw new Error(
          `Failed to fetch sheet information: ${sheetsResponse.status}`
        );
      }

      const sheetsData = await sheetsResponse.json();

      // Find the most recent inventory sheet
      const inventorySheets = sheetsData.sheets
        .filter((sheet) => sheet.properties.title.startsWith("Inventory_"))
        .sort((a, b) => {
          const dateA = new Date(
            a.properties.title.replace("Inventory_", "").replace(/_/g, "/")
          );
          const dateB = new Date(
            b.properties.title.replace("Inventory_", "").replace(/_/g, "/")
          );
          return dateB - dateA;
        });

      if (inventorySheets.length === 0) {
        throw new Error("No inventory sheets found");
      }

      const latestSheet = inventorySheets[0].properties.title;

      // Fetch data from the latest sheet
      const dataResponse = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${latestSheet}?key=${
          import.meta.env.VITE_SHEET_API
        }`
      );

      if (!dataResponse.ok) {
        throw new Error(
          `Failed to fetch inventory data: ${dataResponse.status}`
        );
      }

      const data = await dataResponse.json();

      if (!data.values || data.values.length === 0) {
        setAllInventoryData([]);
        return;
      }

      // Parse all data and store in state
      const rows = data.values.slice(1); // Skip header row

      const parsedData = rows
        .filter((row) => row.length >= 3)
        .map((row) => ({
          clinicCode: (row[0] || "").toString().trim().toUpperCase(),
          medicineName: (row[1] || "").toString().trim(),
          quantity: parseInt(row[2]) || 0,
          lastUpdated: (row[3] || "").toString().trim(),
          originalClinicCode: (row[0] || "").toString().trim(),
        }))
        .filter((item) => item.clinicCode && item.medicineName);

      const lastUpdatedDate = new Date(
        latestSheet.replace("Inventory_", "").replace(/_/g, "/")
      );

      // Cache the data
      inventoryCache.set({
        data: parsedData,
        lastUpdated: lastUpdatedDate,
      });

      setAllInventoryData(parsedData);
      setLastUpdated(lastUpdatedDate);
      setCacheStatus("fresh");
    } catch (err) {
      setError(err.message);
      setCacheStatus("expired");
    } finally {
      setLoading(false);
    }
  };

  // Real-time listener for medicine requests
  const setupMedicineRequestsListener = () => {
    try {
      // Create query with ordering for consistent results
      const inventoryQuery = query(
        collection(db, "Inventory"),
        orderBy("createdAt", "desc")
      );

      // Setup real-time listener
      const unsubscribe = onSnapshot(inventoryQuery, (querySnapshot) => {
        let inventoryData = [];
        
        querySnapshot.forEach((doc) => {
          inventoryData.push({
            id: doc.id,
            ...doc.data(),
          });
        });

        // Filter for current user's clinic
        const userClinicCode = currentUser?.clinicCode?.trim().toUpperCase();
        if (userClinicCode) {
          inventoryData = inventoryData.filter((item) => 
            item.clinicCode?.trim().toUpperCase() === userClinicCode
          );
        }

        setInventoriesData(inventoryData);
        console.log(`🔄 Real-time update: Received ${inventoryData.length} medicine requests for clinic ${userClinicCode}`);
      }, (error) => {
        console.error("❌ Error in medicine requests listener:", error);
      });

      return unsubscribe;
    } catch (error) {
      console.error("❌ Error setting up medicine requests listener:", error);
      return null;
    }
  };

  useEffect(() => {
    fetchMedicinesFromDrive();
    loadInventoryData();
    
    // Setup real-time listener for medicine requests
    const unsubscribe = setupMedicineRequestsListener();
    
    // Cleanup listener on component unmount
    return () => {
      if (unsubscribe) {
        unsubscribe();
        console.log("🔄 Medicine requests listener cleaned up");
      }
    };
  }, [currentUser]);

  const handleClose = () => {
    setOpen(false);
  };

  // Mock current user for testing if not provided
  const mockCurrentUser = currentUser || {
    role: "nurse",
    clinicCode: "ECMT872",
  };

  if (!mockCurrentUser || mockCurrentUser.role !== "nurse") {
    return (
      <div className="p-8 max-w-md mx-auto bg-red-50 border border-red-200 rounded-lg my-8 text-center shadow-md">
        <h2 className="text-xl font-bold text-red-800 mb-2">Access Denied</h2>
        <p className="text-red-700">This page is only accessible to nurses</p>
      </div>
    );
  }

  const displayClinicCode =
    clinicCode || mockCurrentUser.clinicCode?.trim().toUpperCase();

  if (!displayClinicCode) {
    return (
      <div className="p-8 max-w-md mx-auto bg-orange-50 border border-orange-200 rounded-lg my-8 text-center shadow-md">
        <AlertTriangle className="h-12 w-12 text-orange-600 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-orange-800 mb-2">
          No Clinic Code
        </h2>
        <p className="text-orange-700">No clinic code found in your profile</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center">
              <Package className="h-7 w-7 text-blue-600 mr-3" />
              Clinic Inventory
            </h1>
            <p className="text-gray-600 mt-1">
              Medicine inventory for clinic:{" "}
              <span className="font-semibold text-blue-600">
                {displayClinicCode}
              </span>
              {inventoryData.length > 0 &&
                inventoryData[0].originalClinicCode !== displayClinicCode && (
                  <span className="text-sm text-gray-500 block">
                    Matching: {inventoryData[0].originalClinicCode}
                  </span>
                )}
            </p>
          </div>

          <div className="flex items-center space-x-3">
            {lastUpdated && (
              <div className="text-sm text-gray-500 flex items-center">
                <Calendar className="h-4 w-4 mr-1" />
                Last updated: {lastUpdated.toLocaleDateString()}
                <span
                  className={`ml-2 px-2 py-1 rounded-full text-xs ${
                    cacheStatus === "fresh"
                      ? "bg-green-100 text-green-700"
                      : cacheStatus === "stale"
                      ? "bg-yellow-100 text-yellow-700"
                      : "bg-red-100 text-red-700"
                  }`}
                >
                  {cacheStatus === "fresh"
                    ? "🟢 Fresh"
                    : cacheStatus === "stale"
                    ? "🟡 Cached"
                    : "🔴 Expired"}
                </span>
              </div>
            )}

            {/* <div>
              <button
                onClick={() => setOpen(true)}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                Request for Medicine
              </button>
              <MedicineModal
                fetchInventoriesData={() => {}} // No longer needed as we have real-time updates
                open={open}
                onClose={handleClose}
                currentUser={currentUser}
                inventoryData={inventoryData}
              />
            </div> */}

            <button
              onClick={() => loadInventoryData(true)}
              disabled={loading}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <RefreshCw
                className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`}
              />
              {loading ? "Loading..." : "Refresh"}
            </button>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="allMedicineTable">All Medicine</TabsTrigger>
          <TabsTrigger value="approvedMedTable">
            My Medicine Requests
          </TabsTrigger>
        </TabsList>

        {/* All Medicine Table Tab */}
        <TabsContent value="allMedicineTable">
          <InventoryTable 
            inventoryData={inventoryData}
            loading={loading}
            error={error}
            displayClinicCode={displayClinicCode}
            lastUpdated={lastUpdated}
            cacheStatus={cacheStatus}
            loadInventoryData={loadInventoryData}
            currentUser={currentUser}
          />
        </TabsContent>

        {/* Medicine Requests Tab */}
        <TabsContent value="approvedMedTable">
          <div className="space-y-6">
            <RequestedOrderTable 
              inventoriesData={inventoriesData} 
              currentUser={currentUser} 
            />
            <ApprovedOrderTable 
              inventoriesData={inventoriesData} 
              currentUser={currentUser} 
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ClinicInventory;