import React from "react";

const DoctorTableRow = ({ doctor, onViewDetails }) => {
  // Format date for display
  const formatDateTime = (timestamp) => {
    if (!timestamp) return "N/A";
    
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Format shift timing for display
  const formatShiftTiming = (shiftTiming) => {
    return shiftTiming || "Not set";
  };

  // Get status badge color based on doctor status
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
      case "on_holiday": return "On Holiday";
      default: return "Unknown";
    }
  };
  
  return (
    <tr>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center">
          <div>
            <div className="text-sm font-medium text-gray-900">
              {doctor.name}
            </div>
            <div className="text-sm text-gray-500">
              {doctor.empId && <span>ID: {doctor.empId}</span>}
            </div>
          </div>
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeColor(doctor.availabilityStatus)}`}>
          {formatStatus(doctor.availabilityStatus)}
        </span>
        {doctor.lastStatusUpdate && (
          <div className="text-xs text-gray-500 mt-1">
            Since {formatDateTime(doctor.lastStatusUpdate)}
          </div>
        )}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        <div>
          {formatShiftTiming(doctor.shiftTiming)}
        </div>
        <div className="text-xs text-gray-400">
          {doctor.shiftType || "Standard"}
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
        {doctor.todayCases}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
        <span className="text-green-600 font-medium">{doctor.completedCases}</span>
        <div className="text-xs text-gray-400">
          <span className="text-yellow-600">{doctor.pendingCases}</span> pending, 
          <span className="text-red-600"> {doctor.incompleteCases}</span> incomplete
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
        <span className="font-medium">{doctor.dailyTarget}</span>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
        <div className="flex flex-col items-center">
          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
            ${doctor.completionPercentage >= 100 ? "bg-green-100 text-green-800" : 
              doctor.completionPercentage >= 75 ? "bg-lime-100 text-lime-800" :
              doctor.completionPercentage >= 50 ? "bg-yellow-100 text-yellow-800" :
              "bg-red-100 text-red-800"}`}>
            {doctor.completionPercentage}%
          </span>
          <div className="w-16 bg-gray-200 rounded-full h-1.5 mt-1">
            <div 
              className={`h-1.5 rounded-full ${
                doctor.completionPercentage >= 100 ? "bg-green-500" : 
                doctor.completionPercentage >= 75 ? "bg-lime-500" :
                doctor.completionPercentage >= 50 ? "bg-yellow-500" :
                "bg-red-500"
              }`}
              style={{ width: `${Math.min(doctor.completionPercentage, 100)}%` }}
            ></div>
          </div>
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
        {doctor.averageTAT}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
        <button
          onClick={() => onViewDetails(doctor)}
          className="text-blue-600 hover:text-blue-900"
        >
          View Details
        </button>
      </td>
    </tr>
  );
};

export default DoctorTableRow;