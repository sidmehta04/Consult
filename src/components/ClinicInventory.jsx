import { useState, useEffect, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { 
  Package, 
  Search, 
  AlertTriangle, 
  Calendar,
  RefreshCw,
  Filter
} from "lucide-react";

const SPREADSHEET_ID = '17TbBtN9NkiXNnmASazjudB6ac9uIKG_o-OlRu3Iuh34';

// Cache configuration
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds
const CACHE_KEY = 'clinic_inventory_data';

// In-memory cache object
const inventoryCache = {
  data: null,
  timestamp: null,
  isValid() {
    return this.data && this.timestamp && (Date.now() - this.timestamp < CACHE_DURATION);
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
  }
};

const ClinicInventory = ({ currentUser }) => {
  const [allInventoryData, setAllInventoryData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [clinicCode, setClinicCode] = useState(null);
  const [cacheStatus, setCacheStatus] = useState('fresh'); // 'fresh', 'stale', 'expired'

  // Create index for faster clinic-based filtering with flexible matching
  const clinicInventoryIndex = useMemo(() => {
    const index = new Map();
    allInventoryData.forEach(item => {
      const clinic = item.clinicCode?.trim().toUpperCase();
      if (clinic) {
        // Extract the main clinic code (first part before space)
        const mainClinicCode = clinic.split(' ')[0];
        
        // Index by both full clinic code and main clinic code (avoid duplicates)
        const uniqueCodes = [...new Set([clinic, mainClinicCode])];
        uniqueCodes.forEach(code => {
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
        if (indexedCode.includes(normalizedClinicCode) || normalizedClinicCode.includes(indexedCode)) {
          items.forEach(item => allMatches.add(item));
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
        setCacheStatus('expired');
      } else if (inventoryCache.isValid()) {
        setCacheStatus('fresh');
      } else {
        setCacheStatus('stale');
      }
    };

    updateCacheStatus();
    const interval = setInterval(updateCacheStatus, 30000); // Check every 30 seconds
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
        setCacheStatus('fresh');
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
        `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}?key=${import.meta.env.VITE_SHEET_API}`
      );
      
      if (!sheetsResponse.ok) {
        throw new Error(`Failed to fetch sheet information: ${sheetsResponse.status}`);
      }

      const sheetsData = await sheetsResponse.json();
      
      // Find the most recent inventory sheet
      const inventorySheets = sheetsData.sheets
        .filter(sheet => sheet.properties.title.startsWith('Inventory_'))
        .sort((a, b) => {
          const dateA = new Date(a.properties.title.replace('Inventory_', '').replace(/_/g, '/'));
          const dateB = new Date(b.properties.title.replace('Inventory_', '').replace(/_/g, '/'));
          return dateB - dateA;
        });

      if (inventorySheets.length === 0) {
        throw new Error('No inventory sheets found');
      }

      const latestSheet = inventorySheets[0].properties.title;
      
      // Fetch data from the latest sheet
      const dataResponse = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${latestSheet}?key=${import.meta.env.VITE_SHEET_API}`
      );

      if (!dataResponse.ok) {
        throw new Error(`Failed to fetch inventory data: ${dataResponse.status}`);
      }

      const data = await dataResponse.json();
      
      if (!data.values || data.values.length === 0) {
        setAllInventoryData([]);
        return;
      }

      // Parse all data and store in state
      const rows = data.values.slice(1); // Skip header row
      
      const parsedData = rows
        .filter(row => row.length >= 3) // Ensure minimum required columns
        .map(row => ({
          clinicCode: (row[0] || '').toString().trim().toUpperCase(),
          medicineName: (row[1] || '').toString().trim(),
          quantity: parseInt(row[2]) || 0,
          lastUpdated: (row[3] || '').toString().trim(),
          // Store original clinic code for reference
          originalClinicCode: (row[0] || '').toString().trim()
        }))
        .filter(item => item.clinicCode && item.medicineName); // Filter out invalid entries

      const lastUpdatedDate = new Date(latestSheet.replace('Inventory_', '').replace(/_/g, '/'));

      // Cache the data
      inventoryCache.set({
        data: parsedData,
        lastUpdated: lastUpdatedDate
      });

      setAllInventoryData(parsedData);
      setLastUpdated(lastUpdatedDate);
      setCacheStatus('fresh');
      
    } catch (err) {
      setError(err.message);
      setCacheStatus('expired');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInventoryData();
  }, []);

  // Optimized filtering with memoization
  const filteredInventory = useMemo(() => {
    if (!inventoryData.length) return [];

    return inventoryData.filter(item => {
      // Fast text search using toLowerCase for case-insensitive matching
      const matchesSearch = !searchTerm || 
        item.medicineName.toLowerCase().includes(searchTerm.toLowerCase());
      
      if (!matchesSearch) return false;

      // Filter by stock status
      switch (filterType) {
        case 'low-stock':
          return item.quantity > 0 && item.quantity <= 10;
        case 'out-of-stock':
          return item.quantity === 0;
        default:
          return true;
      }
    });
  }, [inventoryData, searchTerm, filterType]);

  // Memoized statistics calculation
  const stats = useMemo(() => ({
    total: inventoryData.length,
    outOfStock: inventoryData.filter(item => item.quantity === 0).length,
    lowStock: inventoryData.filter(item => item.quantity > 0 && item.quantity <= 10).length,
    inStock: inventoryData.filter(item => item.quantity > 10).length
  }), [inventoryData]);

  const getQuantityBadge = (quantity) => {
    if (quantity === 0) {
      return <Badge className="bg-red-100 text-red-800 border-red-200">Out of Stock</Badge>;
    } else if (quantity <= 10) {
      return <Badge className="bg-orange-100 text-orange-800 border-orange-200">Low Stock</Badge>;
    } else {
      return <Badge className="bg-green-100 text-green-800 border-green-200">In Stock</Badge>;
    }
  };

  // Mock current user for testing if not provided
  const mockCurrentUser = currentUser || {
    role: 'nurse',
    clinicCode: 'ECMT872'
  };

  if (!mockCurrentUser || mockCurrentUser.role !== 'nurse') {
    return (
      <div className="p-8 max-w-md mx-auto bg-red-50 border border-red-200 rounded-lg my-8 text-center shadow-md">
        <h2 className="text-xl font-bold text-red-800 mb-2">Access Denied</h2>
        <p className="text-red-700">This page is only accessible to nurses</p>
      </div>
    );
  }

  const displayClinicCode = clinicCode || mockCurrentUser.clinicCode?.trim().toUpperCase();

  if (!displayClinicCode) {
    return (
      <div className="p-8 max-w-md mx-auto bg-orange-50 border border-orange-200 rounded-lg my-8 text-center shadow-md">
        <AlertTriangle className="h-12 w-12 text-orange-600 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-orange-800 mb-2">No Clinic Code</h2>
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
              Medicine inventory for clinic: <span className="font-semibold text-blue-600">{displayClinicCode}</span>
              {inventoryData.length > 0 && inventoryData[0].originalClinicCode !== displayClinicCode && (
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
                <span className={`ml-2 px-2 py-1 rounded-full text-xs ${
                  cacheStatus === 'fresh' ? 'bg-green-100 text-green-700' :
                  cacheStatus === 'stale' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-red-100 text-red-700'
                }`}>
                  {cacheStatus === 'fresh' ? '🟢 Fresh' : 
                   cacheStatus === 'stale' ? '🟡 Cached' : '🔴 Expired'}
                </span>
              </div>
            )}
            <button
              onClick={() => loadInventoryData(true)}
              disabled={loading}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Loading...' : 'Refresh'}
            </button>
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Package className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Medicines</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <Package className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">In Stock</p>
              <p className="text-2xl font-bold text-gray-900">{stats.inStock}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <div className="p-2 bg-orange-100 rounded-lg">
              <AlertTriangle className="h-6 w-6 text-orange-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Low Stock</p>
              <p className="text-2xl font-bold text-gray-900">{stats.lowStock}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertTriangle className="h-6 w-6 text-red-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Out of Stock</p>
              <p className="text-2xl font-bold text-gray-900">{stats.outOfStock}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search medicines..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Filter className="h-4 w-4 text-gray-400" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Items</option>
              <option value="out-of-stock">Out of Stock</option>
              <option value="low-stock">Low Stock</option>
            </select>
          </div>
        </div>
      </div>

      {/* Inventory Table */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin h-8 w-8 border-4 border-blue-500 rounded-full border-t-transparent"></div>
          </div>
        ) : error ? (
          <div className="p-8 text-center">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Error Loading Inventory</h3>
            <p className="text-gray-600 mb-4">{error}</p>
            <button
              onClick={() => loadInventoryData(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Try Again
            </button>
          </div>
        ) : filteredInventory.length === 0 ? (
          <div className="p-8 text-center">
            <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Inventory Found</h3>
            <p className="text-gray-600">
              {searchTerm ? 'No medicines match your search criteria.' : `No inventory data available for clinic ${displayClinicCode}.`}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Medicine Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Quantity
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Last Updated
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredInventory.map((item, index) => (
                  <tr key={`${item.medicineName}-${index}`} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {item.medicineName}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 font-semibold">
                        {item.quantity}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getQuantityBadge(item.quantity)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">
                        {item.lastUpdated}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Results Summary */}
      {!loading && !error && filteredInventory.length > 0 && (
        <div className="text-sm text-gray-600 text-center">
          Showing {filteredInventory.length} of {inventoryData.length} medicines
        </div>
      )}
    </div>
  );
};

export default ClinicInventory;