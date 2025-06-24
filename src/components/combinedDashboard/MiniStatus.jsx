import React from "react";

/**
 * A compact component for displaying doctor status with a colored indicator
 */
const DoctorMiniStatus = ({ status, lastUpdated }) => {
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
      case "on_holiday":
        return "bg-purple-100 text-purple-800";
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
      default: return "Unknown";
    }
  };
  
  // Format time for display
  const formatTime = (timestamp) => {
    if (!timestamp) return "";
    
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 60) {
      return `${diffMins} min${diffMins !== 1 ? 's' : ''} ago`;
    } else if (diffMins < 1440) {
      const hours = Math.floor(diffMins / 60);
      return `${hours} hr${hours !== 1 ? 's' : ''} ago`;
    } else {
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  };
  
  return (
    <div className="flex items-center">
      <div className={`w-2 h-2 rounded-full mr-2 ${
        status === "available" ? "bg-green-500" :
        status === "busy" ? "bg-yellow-500" :
        status === "on_break" ? "bg-blue-500" :
        "bg-red-500"
      }`}></div>
      <span className={`text-xs font-medium rounded-full px-2 py-1 ${getStatusBadgeColor(status)}`}>
        {formatStatus(status)}
      </span>
      {lastUpdated && (
        <span className="text-xs text-gray-500 ml-2">
          {formatTime(lastUpdated)}
        </span>
      )}
    </div>
  );
};

export default DoctorMiniStatus;