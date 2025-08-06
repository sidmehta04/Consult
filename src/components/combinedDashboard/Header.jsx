import React, { useState, useCallback } from "react";
import { Loader2 } from "lucide-react";

const DashboardHeader = ({ 
  viewMode, 
  setViewMode,
  doctorPharmacist,
  setDoctorPharmacist, 
  refreshInterval, 
  setRefreshInterval, 
  onRefresh,
  isRefreshing = false
}) => {
  const [isTransitioning, setIsTransitioning] = useState(false);
  
  const role = doctorPharmacist.charAt(0).toUpperCase() + doctorPharmacist.slice(1);
  
  // Optimized view mode handler with loading state
  const handleViewModeChange = useCallback(async (newViewMode) => {
    if (newViewMode === viewMode) return;
    
    // Show loading state for case transfer
    if (newViewMode === "cases") {
      setIsTransitioning(true);
      
      // Use requestAnimationFrame to ensure UI updates
      requestAnimationFrame(() => {
        setTimeout(() => {
          setViewMode(newViewMode);
          setIsTransitioning(false);
        }, 50); // Minimal delay to show loading state
      });
    } else {
      // Immediate transition for other views
      setViewMode(newViewMode);
    }
  }, [viewMode, setViewMode]);

  // Optimized doctor/pharmacist toggle
  const handleDoctorPharmacistChange = useCallback((type) => {
    if (type !== doctorPharmacist) {
      setDoctorPharmacist(type);
    }
  }, [doctorPharmacist, setDoctorPharmacist]);

  // Optimized refresh interval change
  const handleRefreshIntervalChange = useCallback((e) => {
    const newInterval = Number(e.target.value);
    if (newInterval !== refreshInterval) {
      setRefreshInterval(newInterval);
    }
  }, [refreshInterval, setRefreshInterval]);
  
  return (
    <div className="flex justify-between items-center flex-wrap gap-4">
      <div className="flex items-center">
        <h2 className="text-2xl font-bold text-gray-800">
{`${role} Dashboard`}
        </h2>
        {/* Show loading indicator during transition */}
        {isTransitioning && (
          <div className="ml-3 flex items-center text-blue-600">
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            <span className="text-sm">Loading...</span>
          </div>
        )}
      </div>
      
      <div className="flex flex-wrap gap-2 items-center">
        {/* Doctor/Pharmacist Toggle - only show when not in cases view */}
        {viewMode !== "cases" && (
          <div className="flex border rounded overflow-hidden">
            <button 
              onClick={() => handleDoctorPharmacistChange("doctor")}
              disabled={isRefreshing}
              className={`px-3 py-1 text-sm transition-colors duration-200 ${
                doctorPharmacist === "doctor" 
                  ? "bg-blue-500 text-white" 
                  : "bg-gray-100 hover:bg-gray-200"
              } ${isRefreshing ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              Doctors
            </button>
            <button 
              onClick={() => handleDoctorPharmacistChange("pharmacist")}
              disabled={isRefreshing}
              className={`px-3 py-1 text-sm transition-colors duration-200 ${
                doctorPharmacist === "pharmacist" 
                  ? "bg-blue-500 text-white" 
                  : "bg-gray-100 hover:bg-gray-200"
              } ${isRefreshing ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              Pharmacists
            </button>
          </div>
        )}

        {/* View Mode Toggle with optimized transitions */}
        <div className="flex border rounded overflow-hidden">
          <button 
            onClick={() => handleViewModeChange("table")}
            disabled={isTransitioning}
            className={`px-3 py-1 text-sm transition-colors duration-200 ${
              viewMode === "table" 
                ? "bg-blue-500 text-white" 
                : "bg-gray-100 hover:bg-gray-200"
            } ${isTransitioning ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            Table View
          </button>
          <button 
            onClick={() => handleViewModeChange("cards")}
            disabled={isTransitioning}
            className={`px-3 py-1 text-sm transition-colors duration-200 ${
              viewMode === "cards" 
                ? "bg-blue-500 text-white" 
                : "bg-gray-100 hover:bg-gray-200"
            } ${isTransitioning ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            Card View
          </button>
      
        </div>
        
        {/* Auto-refresh controls - only show when not in cases view */}
        {viewMode !== "cases" && (
          <>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-500">Auto-refresh:</span>
              <select 
                className="border rounded p-1 text-sm transition-colors duration-200 hover:border-blue-300 focus:border-blue-500 focus:outline-none"
                value={refreshInterval}
                onChange={handleRefreshIntervalChange}
                disabled={isRefreshing}
              >
                <option value={15000}>15 seconds</option>
                <option value={30000}>30 seconds</option>
                <option value={60000}>1 minute</option>
                <option value={300000}>5 minutes</option>
              </select>
            </div>
            
            <button 
              onClick={onRefresh}
              disabled={isRefreshing}
              className={`bg-blue-500 hover:bg-blue-700 text-white font-bold py-1 px-3 rounded text-sm transition-colors duration-200 flex items-center ${
                isRefreshing ? "opacity-50 cursor-not-allowed" : ""
              }`}
            >
              {isRefreshing ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  Refreshing...
                </>
              ) : (
                "Refresh Now"
              )}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default React.memo(DashboardHeader);