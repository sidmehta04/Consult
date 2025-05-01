import React, { useState } from "react";

const DoctorStatusHistory = ({ availabilityHistory = [] }) => {
  const [showAll, setShowAll] = useState(false);
  
  // Sort history by date (most recent first)
  const sortedHistory = [...availabilityHistory].sort((a, b) => 
    b.changedAt?.toDate?.() - a.changedAt?.toDate?.() || 0
  );
  
  // Show only last 5 entries by default
  const displayHistory = showAll ? sortedHistory : sortedHistory.slice(0, 5);
  
  // Format date and time
  const formatDateTime = (timestamp) => {
    if (!timestamp) return "Unknown";
    
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  // Get status badge color
  const getStatusBadgeColor = (status) => {
    switch (status) {
      case "available":
        return "bg-green-100 text-green-800";
      case "busy":
        return "bg-yellow-100 text-yellow-800";
      case "on_break":
        return "bg-blue-100 text-blue-800";
      case "unavailable":
      default:
        return "bg-red-100 text-red-800";
    }
  };
  
  // Format status for display
  const formatStatus = (status) => {
    switch (status) {
      case "available": return "Available";
      case "busy": return "Busy";
      case "on_break": return "On Break";
      case "unavailable": return "Unavailable";
      default: return status || "Unknown";
    }
  };
  
  return (
    <div className="bg-white shadow-md rounded-lg p-4">
      <h3 className="text-lg font-semibold mb-4">Status History</h3>
      
      {displayHistory.length === 0 ? (
        <p className="text-gray-500 text-sm">No history available</p>
      ) : (
        <ul className="space-y-3">
          {displayHistory.map((entry, index) => (
            <li key={index} className="border-b border-gray-100 pb-2">
              <div className="flex justify-between items-start">
                <div>
                  <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeColor(entry.newStatus)}`}>
                    {formatStatus(entry.newStatus)}
                  </span>
                  {entry.expectedDuration && (
                    <span className="ml-2 text-xs text-gray-500">
                      ({entry.expectedDuration} min break)
                    </span>
                  )}
                </div>
                <span className="text-xs text-gray-500">
                  {formatDateTime(entry.changedAt)}
                </span>
              </div>
              
              {entry.reason && (
                <p className="text-sm text-gray-600 mt-1">
                  {entry.reason}
                </p>
              )}
              
              {entry.previousStatus && (
                <p className="text-xs text-gray-500 mt-1">
                  Previous: {formatStatus(entry.previousStatus)}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
      
      {sortedHistory.length > 5 && (
        <button 
          onClick={() => setShowAll(!showAll)} 
          className="mt-3 text-sm text-blue-600 hover:text-blue-800"
        >
          {showAll ? "Show less" : `Show all (${sortedHistory.length})`}
        </button>
      )}
    </div>
  );
};

export default DoctorStatusHistory;