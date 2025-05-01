import React from "react";

const DashboardHeader = ({ 
  viewMode, 
  setViewMode, 
  refreshInterval, 
  setRefreshInterval, 
  onRefresh 
}) => {
  return (
    <div className="flex justify-between items-center flex-wrap gap-4">
      <h2 className="text-2xl font-bold text-gray-800">Doctor Dashboard</h2>
      
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex border rounded overflow-hidden">
          <button 
            onClick={() => setViewMode("table")} 
            className={`px-3 py-1 text-sm ${viewMode === "table" ? "bg-blue-500 text-white" : "bg-gray-100"}`}
          >
            Table View
          </button>
          <button 
            onClick={() => setViewMode("cards")} 
            className={`px-3 py-1 text-sm ${viewMode === "cards" ? "bg-blue-500 text-white" : "bg-gray-100"}`}
          >
            Card View
          </button>
        </div>
        
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-500">Auto-refresh:</span>
          <select 
            className="border rounded p-1 text-sm"
            value={refreshInterval}
            onChange={(e) => setRefreshInterval(Number(e.target.value))}
          >
            <option value={30000}>30 seconds</option>
            <option value={60000}>1 minute</option>
            <option value={300000}>5 minutes</option>
          </select>
        </div>
        
        <button 
          onClick={onRefresh}
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-1 px-3 rounded text-sm"
        >
          Refresh Now
        </button>
      </div>
    </div>
  );
};

export default DashboardHeader;